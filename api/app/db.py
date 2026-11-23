"""База данных.

Разделение данных (152-ФЗ, минимизация и псевдонимизация):
  users    — кто это: только Telegram ID и служебные даты. Имени, телефона и т.п. здесь нет.
  entries  — данные дневника (цикл, настроение, анализы, чаты…), ключ — subject_id (псевдоним),
             содержимое зашифровано AES-256-GCM ключом, который хранится только на сервере (DATA_KEY).
             По одной таблице entries нельзя понять, чьи это данные.
  consents — журнал согласий/отзывов (версия, время) — доказательство согласия.
"""

import uuid
from collections.abc import Iterator
from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, LargeBinary, String, Uuid, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from .config import get_settings


def now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tg_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    # псевдоним для данных о здоровье — не совпадает с id
    subject_id: Mapped[uuid.UUID] = mapped_column(Uuid, unique=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    consent_version: Mapped[str | None] = mapped_column(String(32), default=None)
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class Entry(Base):
    __tablename__ = "entries"

    subject_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), primary_key=True)
    data_enc: Mapped[bytes] = mapped_column(LargeBinary)
    # версия записи растёт при каждом сохранении — защита от затирания свежих данных старыми
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Consent(Base):
    __tablename__ = "consents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # при удалении аккаунта журнал обезличивается (user_id = NULL), но факт согласия остаётся
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    version: Mapped[str] = mapped_column(String(32))
    action: Mapped[str] = mapped_column(String(16))  # accepted | withdrawn | deleted
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


_engine = None
_Session: sessionmaker[Session] | None = None


def engine():
    global _engine, _Session
    if _engine is None:
        url = get_settings().db_url
        kw = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {"pool_pre_ping": True, "pool_size": 5}
        _engine = create_engine(url, **kw)
        _Session = sessionmaker(_engine, expire_on_commit=False)
    return _engine


def get_db() -> Iterator[Session]:
    engine()
    assert _Session is not None
    with _Session() as s:
        yield s


def reset_engine() -> None:
    """Для тестов: пересоздать подключение после смены настроек."""
    global _engine, _Session
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _Session = None
