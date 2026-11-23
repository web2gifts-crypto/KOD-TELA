"""Подписка «Код Тела+» за звёзды Telegram (XTR).

Месяц — нативная подписка Stars (subscription_period = 30 дней, автопродление, отмена — в приложении или в Telegram).
Год — разовый платёж на 365 дней.
Поток: POST /v1/billing/invoice → createInvoiceLink → приложение открывает счёт (openInvoice) →
бот получает pre_checkout_query (проверяем) → successful_payment (записываем, продлеваем).

Принцип: всё базовое для здоровья — бесплатно. Платно — то, что стоит денег (ИИ, распознавание) и приятные extras.
"""

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from .bot.client import BotError
from .bot.handlers import Ctx, special
from .config import Settings, get_settings
from .db import Subscription, Usage, User
from .deps import DbDep, SettingsDep, UserDep

log = logging.getLogger("kodtela.billing")
router = APIRouter()

MONTH = 30 * 24 * 3600


def plans(s: Settings) -> dict[str, dict]:
    return {
        "plus_month": {"title": "Код Тела+ на месяц", "stars": s.plus_month_stars, "days": 30, "recurring": True},
        "plus_year": {"title": "Код Тела+ на год", "stars": s.plus_year_stars, "days": 365, "recurring": False},
    }


FEATURES = [
    "Больше вопросов ИИ-ассистенту: {plus_ai} в день вместо {free_ai}",
    "До {plus_p} партнёров вместо {free_p}",
    "Распознавание анализов по фото — скоро",
    "Расширенный отчёт для врача с графиками — скоро",
]


def _aware(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


@dataclass
class Entitlement:
    plan: Literal["free", "plus"]
    until: datetime | None
    recurring: bool
    canceled: bool
    ai_per_day: int
    partners: int


def entitlement(db: Session, user: User, now: datetime | None = None, s: Settings | None = None) -> Entitlement:
    s = s or get_settings()
    now = now or datetime.now(timezone.utc)
    subs = db.scalars(select(Subscription).where(Subscription.user_id == user.id, Subscription.refunded.is_(False))).all()
    active = [x for x in subs if _aware(x.starts_at) <= now < _aware(x.expires_at)]
    if not active:
        return Entitlement("free", None, False, False, s.ai_per_day_free, s.partners_free)
    until = max(_aware(x.expires_at) for x in subs if not x.refunded)
    last = max(active, key=lambda x: _aware(x.expires_at))
    return Entitlement("plus", until, last.recurring, last.canceled, s.ai_per_day_plus, s.partners_plus)


def use(db: Session, user: User, kind: str, limit: int, today: date | None = None) -> int:
    """Учесть использование; HTTP 429 с кодом limit, если дневной лимит исчерпан. Возвращает остаток."""
    day = (today or datetime.now(timezone.utc).date()).isoformat()
    u = db.get(Usage, (user.id, day, kind))
    if u is None:
        u = Usage(user_id=user.id, day=day, kind=kind, count=0)
        db.add(u)
    if u.count >= limit:
        raise HTTPException(429, {"code": "limit", "kind": kind, "limit": limit})
    u.count += 1
    db.commit()
    return limit - u.count


# ---------- API ----------


@router.get("/v1/billing")
def billing(user: UserDep, db: DbDep, settings: SettingsDep) -> dict:
    e = entitlement(db, user, s=settings)
    f = {"plus_ai": settings.ai_per_day_plus, "free_ai": settings.ai_per_day_free, "plus_p": settings.partners_plus, "free_p": settings.partners_free}
    return {
        "plan": e.plan,
        "until": e.until.isoformat() if e.until else None,
        "recurring": e.recurring,
        "canceled": e.canceled,
        "plans": [{"id": k, **v} for k, v in plans(settings).items()],
        "features": [x.format(**f) for x in FEATURES],
    }


class InvoiceIn(BaseModel):
    plan: Literal["plus_month", "plus_year"]


@router.post("/v1/billing/invoice")
async def invoice(body: InvoiceIn, user: UserDep, settings: SettingsDep) -> dict:
    from .main import get_bot

    p = plans(settings)[body.plan]
    try:
        link = await get_bot().call(
            "createInvoiceLink",
            title=p["title"],
            description="Больше вопросов ИИ, больше партнёров и новые функции по мере появления. Основные функции остаются бесплатными.",
            payload=f"{body.plan}:{user.id}",
            currency="XTR",
            prices=[{"label": p["title"], "amount": p["stars"]}],
            subscription_period=MONTH if p["recurring"] else None,
        )
    except BotError as e:
        log.warning("invoice failed: %s", e)
        raise HTTPException(502, "telegram error") from e
    return {"link": link}


@router.post("/v1/billing/cancel")
async def cancel(user: UserDep, db: DbDep) -> dict:
    """Отменить автопродление: доступ сохраняется до конца оплаченного периода"""
    from .main import get_bot

    sub = db.scalar(
        select(Subscription).where(Subscription.user_id == user.id, Subscription.recurring.is_(True), Subscription.canceled.is_(False)).order_by(Subscription.expires_at.desc())
    )
    if sub is None:
        raise HTTPException(404, "no active subscription")
    try:
        await get_bot().call("editUserStarSubscription", user_id=user.tg_id, telegram_payment_charge_id=sub.charge_id, is_canceled=True)
    except BotError as e:
        raise HTTPException(502, "telegram error") from e
    sub.canceled = True
    db.commit()
    return {"ok": True, "until": _aware(sub.expires_at).isoformat()}


# ---------- бот: оплата ----------


def _parse_payload(payload: str) -> tuple[str, str] | None:
    plan, _, uid = (payload or "").partition(":")
    return (plan, uid) if plan in ("plus_month", "plus_year") and uid else None


@special("pre_checkout_query")
async def on_pre_checkout(ctx: Ctx) -> None:
    q = ctx.update["pre_checkout_query"]
    parsed = _parse_payload(q.get("invoice_payload", ""))
    user = ctx.user()
    ok = bool(parsed and user and str(user.id) == parsed[1] and q.get("currency") == "XTR" and q.get("total_amount") == plans(ctx.settings)[parsed[0]]["stars"])
    await ctx.bot.call(
        "answerPreCheckoutQuery",
        pre_checkout_query_id=q["id"],
        ok=ok,
        error_message=None if ok else "Не получилось оформить оплату. Открой приложение и попробуй ещё раз.",
    )


@special("successful_payment")
async def on_paid(ctx: Ctx) -> None:
    pay = ctx.message["successful_payment"]
    parsed = _parse_payload(pay.get("invoice_payload", ""))
    user = ctx.user()
    if not parsed or not user:
        log.error("payment without user/payload")
        return
    db = ctx.db
    if db.scalar(select(Subscription).where(Subscription.charge_id == pay["telegram_payment_charge_id"])):
        return  # повтор апдейта
    plan = plans(ctx.settings)[parsed[0]]
    now = datetime.now(timezone.utc)
    # продление встаёт в очередь после текущего оплаченного периода
    current = entitlement(db, user, now, ctx.settings)
    start = current.until if current.until and current.until > now else now
    if pay.get("subscription_expiration_date"):
        expires = datetime.fromtimestamp(pay["subscription_expiration_date"], timezone.utc)
    else:
        expires = start + timedelta(days=plan["days"])
    db.add(
        Subscription(
            user_id=user.id,
            plan=parsed[0],
            stars=pay.get("total_amount", plan["stars"]),
            charge_id=pay["telegram_payment_charge_id"],
            recurring=bool(pay.get("is_recurring") or plan["recurring"]),
            starts_at=start if not pay.get("subscription_expiration_date") else now,
            expires_at=expires,
        )
    )
    db.commit()
    renewal = pay.get("is_recurring") and not pay.get("is_first_recurring")
    await ctx.reply(
        ("🔄 Подписка продлена" if renewal else "💜 Спасибо! Код Тела+ активен")
        + f" до {expires.strftime('%d.%m.%Y')}.\n\nУправлять подпиской: Профиль → Код Тела+.",
        reply_markup=ctx.app_button("Открыть приложение", "/plus"),
    )
