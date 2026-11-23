"""Общие зависимости эндпоинтов: настройки, БД, авторизация Telegram, согласие, шифрование, лимиты."""

import time
from collections import defaultdict, deque
from datetime import timezone
from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .db import User, get_db, now
from .security import Cipher, InitDataError, TgUser, validate_init_data

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


