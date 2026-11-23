"""Фоновый воркер (контейнер worker): напоминания, удаление неактивных аккаунтов, сердцебиение.

Запуск: python -m app.worker
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import delete, select, update

from . import alerts, billing, partner, reminders  # noqa: F401 — регистрируют команды бота
from .bot.client import Bot, BotError
from .bot.handlers import UPDATES, handle_update, setup_bot
from .config import get_settings
from .db import Consent, Entry, PartnerGrant, ReminderJob, User, engine, get_db
from .security import Cipher

log = logging.getLogger("kodtela.worker")

TICK = 30
HEARTBEAT = Path("/tmp/worker-heartbeat")
INACTIVE = timedelta(days=3 * 365)  # политика: неактивные 3 года — удаляем


def _aware(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


async def send_due(bot: Bot, now_utc: datetime) -> int:
    """Отправить наступившие напоминания. Возвращает число обработанных."""
    c = Cipher(get_settings().data_key)
    n = 0
    db = next(get_db())
    try:
        for job in reminders.due_jobs(db, now_utc):
            try:
                await reminders.fire(db, c, bot, job, now_utc)
            except Exception:
                log.exception("reminder %s failed", job.kind)
            user = db.get(User, job.user_id)
            db.delete(job)
            if user is not None and job.kind != reminders.SNOOZE:
                reminders.replan(db, c, user, now_utc + timedelta(seconds=1))
            db.commit()
            n += 1
    finally:
        db.close()
    return n


def purge_inactive(now_utc: datetime) -> int:
    db = next(get_db())
    try:
        cutoff = now_utc - INACTIVE
        old = [u for u in db.scalars(select(User)).all() if _aware(u.last_seen_at) < cutoff]
        for u in old:
            db.execute(delete(Entry).where(Entry.subject_id == u.subject_id))
            db.execute(delete(ReminderJob).where(ReminderJob.user_id == u.id))
            db.execute(delete(PartnerGrant).where(PartnerGrant.owner_id == u.id))
            db.execute(update(Consent).where(Consent.user_id == u.id).values(user_id=None))
            db.add(Consent(user_id=None, version=u.consent_version or "", action="expired"))
            db.delete(u)
        db.commit()
        if old:
            log.info("purged %d inactive accounts", len(old))
        return len(old)
    finally:
        db.close()


async def poll_updates(bot: Bot) -> None:
    """Long polling: сами забираем апдейты у Telegram (исходящие соединения с сервера работают)"""
    s = get_settings()
    while True:
        try:
            await setup_bot(bot, s, webhook=False)
            break
        except BotError as e:
            log.warning("bot setup failed, retry: %s", e)
            await asyncio.sleep(10)
    offset = None
    while True:
        try:
            updates = await bot.call("getUpdates", offset=offset, timeout=25, allowed_updates=UPDATES)
        except BotError as e:
            log.warning("getUpdates failed: %s", e)
            await asyncio.sleep(5)
            continue
        for u in updates:
            offset = u["update_id"] + 1
            db = next(get_db())
            try:
                await handle_update(bot, db, s, u)
            except Exception:
                log.exception("update handling failed")
            finally:
                db.close()


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    alerts.install("worker")
    s = get_settings()
    bot = Bot(s.bot_token)
    engine()
    if s.bot_mode == "polling" and s.bot_token:
        asyncio.create_task(poll_updates(bot))
    last_purge = None
    log.info("worker started")
    while True:
        started = time.monotonic()
        now_utc = datetime.now(timezone.utc)
        try:
            await send_due(bot, now_utc)
            if last_purge != now_utc.date():
                purge_inactive(now_utc)
                last_purge = now_utc.date()
            HEARTBEAT.write_text(str(int(time.time())))
        except Exception:
            log.exception("worker tick failed")
        await asyncio.sleep(max(1.0, TICK - (time.monotonic() - started)))


if __name__ == "__main__":
    asyncio.run(main())
