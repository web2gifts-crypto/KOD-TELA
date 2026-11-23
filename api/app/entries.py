"""Чтение и запись зашифрованных записей дневника (общие для API, бота и воркера)."""

import json
import uuid
from typing import Any

from sqlalchemy.orm import Session

from .db import Entry, now
from .security import Cipher

# что клиент может хранить на сервере — фиксированный список, лишнего не принимаем
DATA_KEYS = {
    "profile", "cycle", "periodDays", "moods", "moodNotes", "symptoms", "labs", "chats", "prefs",
    # напоминания, контрацепция, расширенные отметки дня, режим (цель)
    "reminders", "pill", "pillLog", "dayLog", "mode",
}


class Conflict(Exception):
    def __init__(self, current: Entry | None):
        self.current = current


def read(db: Session, c: Cipher, subject: uuid.UUID, key: str) -> Any:
    e = db.get(Entry, (subject, key))
    return json.loads(c.decrypt(subject, key, e.data_enc)) if e else None


def read_many(db: Session, c: Cipher, subject: uuid.UUID, keys: list[str]) -> dict[str, Any]:
    return {k: read(db, c, subject, k) for k in keys}


def decode(e: Entry, c: Cipher) -> dict:
    return {"data": json.loads(c.decrypt(e.subject_id, e.key, e.data_enc)), "version": e.version, "updatedAt": e.updated_at.isoformat()}


def write(db: Session, c: Cipher, subject: uuid.UUID, key: str, data: Any, base_version: int | None = None, *, force: bool = False) -> Entry:
    """Записать с проверкой версии. force=True — правка с сервера (бот), версию не сверяем.
    Коммит — на вызывающем."""
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode()
    e = db.get(Entry, (subject, key))
    if not force and (e.version if e else None) != base_version:
        raise Conflict(e)
    if e is None:
        e = Entry(subject_id=subject, key=key, data_enc=c.encrypt(subject, key, raw), version=1, updated_at=now())
        db.add(e)
    else:
        e.data_enc = c.encrypt(subject, key, raw)
        e.version += 1
        e.updated_at = now()
    db.flush()
    return e


def raw_size(data: Any) -> int:
    return len(json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode())
