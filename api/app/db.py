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


class ReminderJob(Base):
    """Расписание напоминаний: только кому, когда и какой тип — без содержимого"""

    __tablename__ = "reminder_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(16))
    fire_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class PartnerGrant(Base):
    """Доступ партнёра: открыть ссылку может только этот Telegram-аккаунт.
    Хранится хеш ссылки (не сама ссылка), имя партнёра — чтобы владелец видел, кому дан доступ."""

    __tablename__ = "partner_grants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    partner_tg_id: Mapped[int] = mapped_column(BigInteger, index=True)
    partner_name: Mapped[str] = mapped_column(String(64), default="")
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    # что видит партнёр: {"cycle": true, "fertile": false, "mood": false}
    scope: Mapped[str] = mapped_column(String(200), default='{"cycle": true, "fertile": false, "mood": false}')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    last_viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class Subscription(Base):
    """Оплата «Код Тела+» звёздами Telegram — одна строка на платёж (продление — новая строка)"""

    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    plan: Mapped[str] = mapped_column(String(16))
    stars: Mapped[int] = mapped_column(Integer)
    charge_id: Mapped[str] = mapped_column(String(128), unique=True)
    recurring: Mapped[bool] = mapped_column(default=False)
    canceled: Mapped[bool] = mapped_column(default=False)
    refunded: Mapped[bool] = mapped_column(default=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class Usage(Base):
    """Счётчики лимитов по дням (вопросы ИИ и т.п.)"""

    __tablename__ = "usage"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    kind: Mapped[str] = mapped_column(String(16), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)


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
