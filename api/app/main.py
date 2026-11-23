"""Код Тела API (api.kodtela.tech).

Авторизация: заголовок `Authorization: tma <initData>` — подписанные Telegram данные Mini App.
Аккаунт создаётся только после согласия на обработку данных (POST /v1/consent).
"""

import json
import logging
import time
from datetime import timezone
from collections import defaultdict, deque
from typing import Annotated, Any

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from .ai.base import ChatReply, ChatRequest, ProviderUnavailable
from .ai.providers import get_provider
from .ai.safety import emergency_reply, is_emergency, violates_policy
from .config import Settings, get_settings
from .db import Consent, Entry, User, get_db, now
from .security import Cipher, InitDataError, TgUser, validate_init_data

log = logging.getLogger("kodtela")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

# что клиент может хранить на сервере — фиксированный список, лишнего не принимаем
DATA_KEYS = {"profile", "cycle", "periodDays", "moods", "moodNotes", "symptoms", "labs", "chats", "prefs"}

app = FastAPI(title="Код Тела API", version="1.0.0", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().allowed_origins.split(",") if o.strip()],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)

SettingsDep = Annotated[Settings, Depends(get_settings)]
DbDep = Annotated[Session, Depends(get_db)]


# ---------- авторизация ----------


def tg_user(settings: SettingsDep, authorization: Annotated[str | None, Header()] = None) -> TgUser:
    if not authorization or not authorization.startswith("tma "):
        raise HTTPException(401, "unauthorized")
    try:
        return validate_init_data(authorization[4:], settings.bot_token, settings.init_data_ttl)
    except InitDataError as e:
        raise HTTPException(401, "unauthorized") from e


TgDep = Annotated[TgUser, Depends(tg_user)]


def consented_user(tg: TgDep, db: DbDep, settings: SettingsDep) -> User:
    user = db.scalar(select(User).where(User.tg_id == tg.id))
    if user is None or user.consent_version is None:
        raise HTTPException(403, "consent required")
    last = user.last_seen_at if user.last_seen_at.tzinfo else user.last_seen_at.replace(tzinfo=timezone.utc)
    if (now() - last).total_seconds() > 3600:
        user.last_seen_at = now()
        db.commit()
    return user


UserDep = Annotated[User, Depends(consented_user)]


def cipher(settings: SettingsDep) -> Cipher:
    return Cipher(settings.data_key)


CipherDep = Annotated[Cipher, Depends(cipher)]


# ---------- лимиты ----------

_hits: dict[str, deque[float]] = defaultdict(deque)


def rate_limit(bucket: str, user_id: int, per_hour: int) -> None:
    q = _hits[f"{bucket}:{user_id}"]
    t = time.monotonic()
    while q and t - q[0] > 3600:
        q.popleft()
    if len(q) >= per_hour:
        raise HTTPException(429, "too many requests")
    q.append(t)


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
    db.execute(update(Consent).where(Consent.user_id == user.id).values(user_id=None))
    db.add(Consent(user_id=None, version=user.consent_version or "", action="deleted"))
    db.delete(user)
    db.commit()
    log.info("account deleted")
    return {"ok": True}


# ---------- данные дневника ----------


def _entry_out(e: Entry, c: Cipher, subject) -> dict:
    return {"data": json.loads(c.decrypt(subject, e.key, e.data_enc)), "version": e.version, "updatedAt": e.updated_at.isoformat()}


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
    if key not in DATA_KEYS:
        raise HTTPException(404, "unknown key")
    raw = json.dumps(body.data, ensure_ascii=False, separators=(",", ":")).encode()
    if len(raw) > settings.max_entry_bytes:
        raise HTTPException(413, "entry too large")
    e = db.get(Entry, (user.subject_id, key))
    current = e.version if e else None
    if current != body.baseVersion:
        # на другом устройстве данные уже поменялись — отдаём актуальные, клиент решит
        return JSONResponse(status_code=409, content={"conflict": True, "current": _entry_out(e, c, user.subject_id) if e else None})
    if e is None:
        e = Entry(subject_id=user.subject_id, key=key, data_enc=c.encrypt(user.subject_id, key, raw), version=1)
        db.add(e)
    else:
        e.data_enc = c.encrypt(user.subject_id, key, raw)
        e.version += 1
        e.updated_at = now()
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
async def chat(body: ChatRequest, user: UserDep, settings: SettingsDep):
    # красные флаги — всегда, даже если ИИ выключен
    if is_emergency(body.symptom) or any(is_emergency(m.text) for m in body.history if m.role == "user"):
        return emergency_reply(body.symptom)
    if not settings.ai_enabled:
        raise HTTPException(503, "ai disabled")
    rate_limit("chat", user.tg_id, settings.chat_per_hour)
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


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "internal error"})
