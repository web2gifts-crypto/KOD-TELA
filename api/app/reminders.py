"""Напоминания в Telegram.

Настройки — зашифрованная запись `reminders` (её пишет приложение, а бот меняет командами):
  {"tz": "Europe/Moscow", "muted": false,
   "period":  {"on": true,  "daysBefore": 2, "time": "10:00"},
   "fertile": {"on": false, "time": "10:00"},
   "mood":    {"on": true,  "time": "21:00"},
   "pill":    {"on": false, "time": "09:00"}}
Контрацепция — запись `pill`: {"regimen": "21_7" | "24_4" | "28" | "continuous", "packStart": "YYYY-MM-DD"},
отметки «выпила» — `pillLog`: {"YYYY-MM-DD": 1}.

В таблице reminder_jobs — только «кому / когда / какой тип», без содержимого.
Перед отправкой воркер ещё раз проверяет свежие данные: настроение уже отмечено, таблетка выпита,
месячные начались — не пишем.
"""

import logging
import uuid
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from . import entries
from .bot.client import Bot, BotError, inline, open_app_button
from .bot.handlers import Ctx, callback, command
from .config import get_settings
from .cycle import forecast
from .db import ReminderJob, User
from .security import Cipher

log = logging.getLogger("kodtela.reminders")

# изменения этих записей — пересчитать расписание
TRIGGER_KEYS = {"reminders", "pill", "periodDays", "cycle", "mode"}
KINDS = ("period", "fertile", "mood", "pill")
SNOOZE = "pill_snooze"

DEFAULTS: dict = {
    "tz": "Europe/Moscow",
    "muted": False,
    "period": {"on": True, "daysBefore": 2, "time": "10:00"},
    "fertile": {"on": False, "time": "10:00"},
    "mood": {"on": False, "time": "21:00"},
    "pill": {"on": False, "time": "09:00"},
}

LABELS = {"period": "Скоро месячные", "fertile": "Фертильные дни", "mood": "Отметить настроение", "pill": "Таблетка"}


def settings_of(raw: dict | None) -> dict:
    s = {k: (dict(v) if isinstance(v, dict) else v) for k, v in DEFAULTS.items()}
    for k, v in (raw or {}).items():
        if isinstance(v, dict) and isinstance(s.get(k), dict):
            s[k].update(v)
        else:
            s[k] = v
    return s


def _tz(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(name or "Europe/Moscow")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("Europe/Moscow")


def _hm(s: str | None, default: str) -> time:
    try:
        h, m = (s or default).split(":")
        return time(int(h) % 24, int(m) % 60)
    except ValueError:
        h, m = default.split(":")
        return time(int(h), int(m))


def pill_active(pill: dict | None, d: date) -> bool:
    """День приёма активной таблетки (в перерыв не напоминаем)"""
    if not pill or not pill.get("packStart"):
        return True
    regimen = pill.get("regimen", "21_7")
    try:
        start = date.fromisoformat(pill["packStart"])
    except ValueError:
        return True
    if d < start:
        return False
    idx = (d - start).days % 28
    if regimen == "21_7":
        return idx < 21
    return True  # 24_4 (с плацебо), 28, continuous — каждый день


def plan(data: dict, now_utc: datetime) -> list[tuple[str, datetime]]:
    """Ближайшие напоминания: [(тип, когда в UTC)]. Чистая функция — покрыта тестами."""
    s = settings_of(data.get("reminders"))
    if s.get("muted"):
        return []
    tz = _tz(s.get("tz"))
    local_now = now_utc.astimezone(tz)
    today = local_now.date()
    out: list[tuple[str, datetime]] = []

    def at(d: date, hm: str, default: str) -> datetime:
        return datetime.combine(d, _hm(hm, default), tz).astimezone(timezone.utc)

    def next_daily(hm: str, default: str, ok=lambda d: True) -> datetime | None:
        for i in range(0, 40):
            d = today + timedelta(days=i)
            t = at(d, hm, default)
            if t > now_utc and ok(d):
                return t
        return None

    if s["mood"].get("on"):
        t = next_daily(s["mood"].get("time"), "21:00")
        if t:
            out.append(("mood", t))
    if s["pill"].get("on"):
        t = next_daily(s["pill"].get("time"), "09:00", lambda d: pill_active(data.get("pill"), d))
        if t:
            out.append(("pill", t))

    # в режиме беременности прогноз цикла на паузе
    if (data.get("mode") or {}).get("kind") == "pregnancy":
        return out
    fc = forecast(data.get("periodDays"), data.get("cycle"), today)
    if s["period"].get("on") and fc.expected and not fc.late:
        before = max(0, min(7, int(s["period"].get("daysBefore", 2))))
        t = at(fc.expected - timedelta(days=before), s["period"].get("time"), "10:00")
        if t > now_utc:
            out.append(("period", t))
    if s["fertile"].get("on") and fc.ovulation:
        t = at(fc.ovulation - timedelta(days=5), s["fertile"].get("time"), "10:00")
        if t > now_utc:
            out.append(("fertile", t))
    return out


NEED = ["reminders", "periodDays", "cycle", "pill", "pillLog", "moods", "mode"]


def replan(db: Session, c: Cipher, user: User, now_utc: datetime | None = None) -> None:
    """Пересчитать расписание пользователя (снуз не трогаем). Коммит — на вызывающем."""
    now_utc = now_utc or datetime.now(timezone.utc)
    data = entries.read_many(db, c, user.subject_id, NEED)
    db.execute(delete(ReminderJob).where(ReminderJob.user_id == user.id, ReminderJob.kind != SNOOZE))
    for kind, t in plan(data, now_utc):
        db.add(ReminderJob(user_id=user.id, kind=kind, fire_at=t))


# ---------- отправка ----------


def _local_today(data: dict, now_utc: datetime) -> date:
    return now_utc.astimezone(_tz(settings_of(data.get("reminders")).get("tz"))).date()


def compose(kind: str, data: dict, now_utc: datetime, webapp_url: str) -> tuple[str, dict] | None:
    """Текст и кнопки напоминания или None, если уже неактуально."""
    today = _local_today(data, now_utc)
    iso = today.isoformat()
    if kind == "mood":
        if (data.get("moods") or {}).get(iso):
            return None
        return "Как ты сегодня? 💜 Отметь настроение — это займёт пару секунд.", open_app_button("Отметить настроение", f"{webapp_url}#/mood")
    if kind in ("pill", SNOOZE):
        if (data.get("pillLog") or {}).get(iso) or not pill_active(data.get("pill"), today):
            return None
        return "💊 Время принять таблетку.", inline([[("✅ Выпила", f"pill:taken:{iso}"), ("⏰ Через 30 мин", f"pill:snooze:{iso}")]])
    fc = forecast(data.get("periodDays"), data.get("cycle"), today)
    if kind == "period":
        if not fc.expected or fc.late or fc.started_recently:
            return None
        n = (fc.expected - today).days
        when = "завтра" if n == 1 else "сегодня" if n == 0 else f"примерно через {n} дн."
        return (
            f"🌸 По прогнозу месячные {when} — около {fc.expected.strftime('%d.%m')}.\nМожет, положить нужное в сумку?",
            open_app_button("Открыть календарь", f"{webapp_url}#/cycle"),
        )
    if kind == "fertile":
        return "📅 По прогнозу начинаются фертильные дни. Подробнее — в календаре.", open_app_button("Открыть календарь", f"{webapp_url}#/cycle")
    return None


async def fire(db: Session, c: Cipher, bot: Bot, job: ReminderJob, now_utc: datetime) -> None:
    user = db.get(User, job.user_id)
    if user is None or not user.consent_version:
        return
    data = entries.read_many(db, c, user.subject_id, NEED)
    if settings_of(data.get("reminders")).get("muted"):
        return
    msg = compose(job.kind, data, now_utc, get_settings().webapp_url)
    if msg is None:
        return
    text, markup = msg
    try:
        await bot.send(user.tg_id, text + "\n\n<i>Настроить: /reminders · выключить все: /mute</i>", reply_markup=markup)
    except BotError as e:
        if "403" in str(e):
            # заблокировали бота — выключаем напоминания, чтобы не долбиться
            _set_muted(db, c, user, True)
            log.info("bot blocked by user, reminders muted")
        else:
            raise


def _set_muted(db: Session, c: Cipher, user: User, muted: bool) -> dict:
    s = settings_of(entries.read(db, c, user.subject_id, "reminders"))
    s["muted"] = muted
    entries.write(db, c, user.subject_id, "reminders", s, force=True)
    replan(db, c, user)
    return s


# ---------- команды бота ----------


def _cipher() -> Cipher:
    return Cipher(get_settings().data_key)


NOT_REGISTERED = "Чтобы включить напоминания, открой приложение и прими согласие на обработку данных — это один раз."


def _status(s: dict) -> tuple[str, dict]:
    if s.get("muted"):
        text = "🔕 Все напоминания выключены."
    else:
        lines = [f"{'🔔' if s[k].get('on') else '▫️'} {LABELS[k]}" + (f" — {s[k].get('time')}" if s[k].get("on") else "") for k in KINDS]
        text = "Напоминания:\n" + "\n".join(lines)
    rows = [] if s.get("muted") else [[(f"{'Выкл' if s[k].get('on') else 'Вкл'}: {LABELS[k]}", f"rem:{k}")] for k in KINDS]
    rows.append([("🔔 Включить снова", "rem:unmute")] if s.get("muted") else [("🔕 Выключить все", "rem:mute")])
    kb = inline(rows)
    kb["inline_keyboard"].append([{"text": "⚙️ Время и детали", "web_app": {"url": f"{get_settings().webapp_url}#/reminders"}}])
    return text, kb


@command("reminders")
async def cmd_reminders(ctx: Ctx, arg: str) -> None:
    user = ctx.user()
    if not user:
        return await ctx.reply(NOT_REGISTERED, reply_markup=ctx.app_button())
    s = settings_of(entries.read(ctx.db, _cipher(), user.subject_id, "reminders"))
    text, kb = _status(s)
    await ctx.reply(text, reply_markup=kb)


@command("mute")
async def cmd_mute(ctx: Ctx, arg: str) -> None:
    user = ctx.user()
    if not user:
        return await ctx.reply("Напоминаний и так нет 🙂")
    _set_muted(ctx.db, _cipher(), user, True)
    ctx.db.commit()
    await ctx.reply("🔕 Все напоминания выключены. Включить снова — /reminders")


@callback("rem")
async def cb_reminders(ctx: Ctx, arg: str) -> None:
    user = ctx.user()
    if not user:
        return
    c = _cipher()
    if arg in ("mute", "unmute"):
        s = _set_muted(ctx.db, c, user, arg == "mute")
    elif arg in KINDS:
        s = settings_of(entries.read(ctx.db, c, user.subject_id, "reminders"))
        s[arg]["on"] = not s[arg].get("on")
        s["muted"] = False
        entries.write(ctx.db, c, user.subject_id, "reminders", s, force=True)
        replan(ctx.db, c, user)
    else:
        return
    ctx.db.commit()
    text, kb = _status(s)
    msg = ctx.callback.get("message") or {}
    await ctx.bot.call("editMessageText", chat_id=ctx.chat_id, message_id=msg.get("message_id"), text=text, reply_markup=kb)


@callback("pill")
async def cb_pill(ctx: Ctx, arg: str) -> None:
    user = ctx.user()
    if not user:
        return
    action, _, day = arg.partition(":")
    c = _cipher()
    msg = ctx.callback.get("message") or {}
    if action == "taken":
        log_ = entries.read(ctx.db, c, user.subject_id, "pillLog") or {}
        log_[day] = 1
        entries.write(ctx.db, c, user.subject_id, "pillLog", log_, force=True)
        ctx.db.execute(delete(ReminderJob).where(ReminderJob.user_id == user.id, ReminderJob.kind == SNOOZE))
        ctx.db.commit()
        await ctx.bot.call("editMessageText", chat_id=ctx.chat_id, message_id=msg.get("message_id"), text="✅ Отмечено: таблетка выпита. Молодец!")
    elif action == "snooze":
        ctx.db.add(ReminderJob(user_id=user.id, kind=SNOOZE, fire_at=datetime.now(timezone.utc) + timedelta(minutes=30)))
        ctx.db.commit()
        await ctx.bot.call("editMessageText", chat_id=ctx.chat_id, message_id=msg.get("message_id"), text="⏰ Хорошо, напомню через 30 минут.")


def due_jobs(db: Session, now_utc: datetime, limit: int = 100) -> list[ReminderJob]:
    return list(db.scalars(select(ReminderJob).where(ReminderJob.fire_at <= now_utc).order_by(ReminderJob.fire_at).limit(limit)).all())


def delete_user_jobs(db: Session, user_id: uuid.UUID) -> None:
    db.execute(delete(ReminderJob).where(ReminderJob.user_id == user_id))
