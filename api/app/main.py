"""Код Тела API (api.kodtela.tech).

Авторизация: заголовок `Authorization: tma <initData>` — подписанные Telegram данные Mini App.
Аккаунт создаётся только после согласия на обработку данных (POST /v1/consent).
"""

import json
import logging
from typing import Annotated, Any

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, select, update

from contextlib import asynccontextmanager

from .bot.client import Bot, BotError, webhook_secret
from .bot.handlers import MENU, handle_update
from .ai.base import ChatReply, ChatRequest, ProviderUnavailable
from .ai.providers import get_provider
from .ai.safety import emergency_reply, is_emergency, violates_policy
from . import alerts, billing, entries, partner, reminders
from .config import get_settings
from .db import Consent, Entry, PartnerGrant, Subscription, Usage, User, now
from .security import Cipher

log = logging.getLogger("kodtela")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
alerts.install("api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    s = get_settings()
    if s.bot_webhook and s.bot_token:
        try:
            bot = get_bot()
            await bot.call(
                "setWebhook",
                url=f"{s.public_api_url}/bot/webhook",
                secret_token=webhook_secret(s.bot_token),
                allowed_updates=["message", "callback_query", "pre_checkout_query"],
                drop_pending_updates=False,
            )
            await bot.call("setMyCommands", commands=[{"command": c, "description": d} for c, d in MENU])
            log.info("bot webhook set")
        except BotError as e:
            log.warning("bot setup failed: %s", e)
    yield


app = FastAPI(title="Код Тела API", version="1.0.0", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().allowed_origins.split(",") if o.strip()],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)
app.include_router(partner.router)
app.include_router(billing.router)

from .deps import CipherDep, DbDep, SettingsDep, TgDep, UserDep, _hits, rate_limit  # noqa: E402,F401


# ---------- служебное ----------


@app.get("/health")
def health() -> str:
    return "ok"


@app.get("/v1/config")
def config(settings: SettingsDep) -> dict:
    return {"ai_enabled": settings.ai_enabled, "consent_version": settings.consent_version}


# ---------- аккаунт и согласие ----------


@app.get("/v1/me")
def me(tg: TgDep, db: DbDep, settings: SettingsDep) -> dict:
    user = db.scalar(select(User).where(User.tg_id == tg.id))
    accepted = user.consent_version if user else None
    return {
        "registered": user is not None and accepted is not None,
        "consent_version": accepted,
        "needs_consent": accepted != settings.consent_version,
        "current_consent_version": settings.consent_version,
    }


class ConsentIn(BaseModel):
    version: str = Field(max_length=32)
    # отдельное согласие на обработку данных о здоровье (специальная категория, ст. 10 152-ФЗ)
    health_data: bool


@app.post("/v1/consent")
def accept_consent(body: ConsentIn, tg: TgDep, db: DbDep, settings: SettingsDep) -> dict:
    if body.version != settings.consent_version:
        raise HTTPException(409, "outdated consent version")
    if not body.health_data:
        raise HTTPException(422, "health data consent is required")
    user = db.scalar(select(User).where(User.tg_id == tg.id))
    if user is None:
        user = User(tg_id=tg.id)
        db.add(user)
        db.flush()
    user.consent_version = body.version
    user.consent_at = now()
    db.add(Consent(user_id=user.id, version=body.version, action="accepted"))
    db.commit()
    return {"ok": True, "consent_version": user.consent_version}


@app.delete("/v1/me")
def delete_me(user: UserDep, db: DbDep) -> dict:
    """Отзыв согласия = удаление всех данных сразу (152-ФЗ, ст. 9 и 21). В журнале остаётся обезличенный факт."""
    db.execute(delete(Entry).where(Entry.subject_id == user.subject_id))
    reminders.delete_user_jobs(db, user.id)
    db.execute(delete(PartnerGrant).where(PartnerGrant.owner_id == user.id))
    db.execute(delete(Usage).where(Usage.user_id == user.id))
    db.execute(update(Subscription).where(Subscription.user_id == user.id).values(user_id=None))
    db.execute(update(Consent).where(Consent.user_id == user.id).values(user_id=None))
    db.add(Consent(user_id=None, version=user.consent_version or "", action="deleted"))
    db.delete(user)
    db.commit()
    log.info("account deleted")
    return {"ok": True}


# ---------- данные дневника ----------


def _entry_out(e: Entry, c: Cipher, subject) -> dict:
    return entries.decode(e, c)


@app.get("/v1/data")
def get_data(user: UserDep, db: DbDep, c: CipherDep) -> dict:
    rows = db.scalars(select(Entry).where(Entry.subject_id == user.subject_id)).all()
    return {"entries": {e.key: _entry_out(e, c, user.subject_id) for e in rows}}


class EntryIn(BaseModel):
    data: Any
    # версия, от которой клиент делал изменения; null — записи ещё нет
    baseVersion: int | None = None


@app.put("/v1/data/{key}")
def put_data(key: str, body: EntryIn, user: UserDep, db: DbDep, c: CipherDep, settings: SettingsDep):
    if key not in entries.DATA_KEYS:
        raise HTTPException(404, "unknown key")
    if entries.raw_size(body.data) > settings.max_entry_bytes:
        raise HTTPException(413, "entry too large")
    try:
        e = entries.write(db, c, user.subject_id, key, body.data, body.baseVersion)
    except entries.Conflict as conflict:
        # на другом устройстве (или ботом) данные уже поменялись — отдаём актуальные, клиент объединит
        db.rollback()
        cur = conflict.current
        return JSONResponse(status_code=409, content={"conflict": True, "current": entries.decode(cur, c) if cur else None})
    if key in reminders.TRIGGER_KEYS:
        reminders.replan(db, c, user)
    db.commit()
    return {"version": e.version, "updatedAt": e.updated_at.isoformat()}


@app.get("/v1/me/export")
def export_all(user: UserDep, db: DbDep, c: CipherDep) -> dict:
    """Все данные пользователя в машиночитаемом виде (право на доступ к своим данным, ст. 14 152-ФЗ)."""
    rows = db.scalars(select(Entry).where(Entry.subject_id == user.subject_id)).all()
    return {
        "account": {"created_at": user.created_at.isoformat(), "consent_version": user.consent_version, "consent_at": user.consent_at.isoformat() if user.consent_at else None},
        "data": {e.key: json.loads(c.decrypt(user.subject_id, e.key, e.data_enc)) for e in rows},
    }


# ---------- отправка файла в чат с ботом ----------


class FileIn(BaseModel):
    filename: str = Field(pattern=r"^[\w.\-]{1,80}\.(html|json)$")
    content: str = Field(max_length=2_000_000)


@app.post("/v1/export")
async def send_file(body: FileIn, user: UserDep, settings: SettingsDep) -> dict:
    rate_limit("export", user.tg_id, settings.export_per_hour)
    is_json = body.filename.endswith(".json")
    mime = "application/json" if is_json else "text/html"
    caption = "Все твои данные из «Код Тела» 🔒" if is_json else "Твой отчёт «Мой код тела» 💜"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"https://api.telegram.org/bot{settings.bot_token}/sendDocument",
                data={"chat_id": str(user.tg_id), "caption": caption},
                files={"document": (body.filename, body.content.encode(), mime)},
            )
    except httpx.HTTPError as e:
        raise HTTPException(502, "telegram unavailable") from e
    if r.status_code != 200:
        log.warning("sendDocument failed: %s", r.status_code)
        raise HTTPException(502, "telegram error")
    return {"ok": True}


# ---------- чат с Юви (ИИ) ----------


@app.post("/v1/chat", response_model=ChatReply, response_model_exclude_none=True)
async def chat(body: ChatRequest, user: UserDep, db: DbDep, settings: SettingsDep):
    # красные флаги — всегда, даже если ИИ выключен
    if is_emergency(body.symptom) or any(is_emergency(m.text) for m in body.history if m.role == "user"):
        return emergency_reply(body.symptom)
    if not settings.ai_enabled:
        raise HTTPException(503, "ai disabled")
    rate_limit("chat", user.tg_id, settings.chat_per_hour)
    billing.use(db, user, "ai", billing.entitlement(db, user, s=settings).ai_per_day)
    try:
        reply = await get_provider(settings).reply(body)
    except ProviderUnavailable as e:
        log.warning("ai unavailable: %s", e)
        raise HTTPException(503, "ai unavailable") from e
    v = reply.verdict
    text = "\n".join([reply.text, *([v.title, v.explanation, *v.plan, *v.whenDoctor] if v else [])])
    if violates_policy(text):
        log.warning("ai reply blocked by policy")
        raise HTTPException(502, "reply blocked")
    return reply


# ---------- безопасность ----------


@app.post("/v1/security/pin-reset")
async def pin_reset(user: UserDep, settings: SettingsDep) -> dict:
    """Код-пароль сброшен на устройстве — сообщаем владельцу в чат (вдруг это сделал не он)"""
    rate_limit("pinreset", user.tg_id, 5)
    try:
        await get_bot().send(
            user.tg_id,
            "🔐 В приложении «Код Тела» сбросили код-пароль.\n\nЕсли это была не ты — включи код заново: Профиль → Код-пароль.",
        )
    except BotError:
        pass
    return {"ok": True}


# ---------- бот ----------

_bot: Bot | None = None


def get_bot() -> Bot:
    global _bot
    if _bot is None:
        _bot = Bot(get_settings().bot_token)
    return _bot


@app.post("/bot/webhook")
async def bot_webhook(
    request: Request,
    db: DbDep,
    settings: SettingsDep,
    x_telegram_bot_api_secret_token: Annotated[str | None, Header()] = None,
) -> dict:
    if not settings.bot_token or x_telegram_bot_api_secret_token != webhook_secret(settings.bot_token):
        raise HTTPException(403, "forbidden")
    update = await request.json()
    await handle_update(get_bot(), db, settings, update)
    return {"ok": True}


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "internal error"})
