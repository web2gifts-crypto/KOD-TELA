"""Доступ для партнёра.

1. Владелец в приложении жмёт «Пригласить» → чат с ботом (/start partner или /partner).
2. Бот показывает кнопку «Выбрать контакт» (KeyboardButtonRequestUsers) — Telegram отдаёт ID выбранного человека.
3. Бот выдаёт ссылку t.me/<bot>?startapp=p_<token>. Открыть её может ТОЛЬКО выбранный аккаунт:
   API сверяет Telegram ID из подписанных initData с partner_tg_id. Переслать ссылку другому бесполезно.
4. Партнёр видит только разрешённое (scope): фазу и прогноз, фертильные дни, настроение.
"""

import hashlib
import json
import secrets
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select

from . import entries
from .bot.handlers import START_PAYLOADS, Ctx, command, special
from .config import get_settings
from .cycle import PHASE_NAMES, today_status
from .db import PartnerGrant, User, now
from .deps import CipherDep, DbDep, TgDep, UserDep
from .security import Cipher
from .billing import entitlement

router = APIRouter()

REQUEST_ID = 1
DEFAULT_SCOPE = {"cycle": True, "fertile": False, "mood": False}
MOOD_NAMES = ["", "Плохо", "Тревожно", "Ровно", "Хорошо", "Отлично"]


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_link(grant: PartnerGrant) -> str:
    """Выпустить новую ссылку (старая перестаёт работать)"""
    token = secrets.token_urlsafe(12)
    grant.token_hash = _hash(token)
    return f"https://t.me/{get_settings().bot_username}?startapp=p_{token}"


def scope_of(g: PartnerGrant) -> dict:
    try:
        return {**DEFAULT_SCOPE, **json.loads(g.scope)}
    except ValueError:
        return dict(DEFAULT_SCOPE)


# ---------- бот: выбор контакта ----------

PICK_KB = {
    "keyboard": [[{"text": "👤 Выбрать контакт", "request_users": {"request_id": REQUEST_ID, "user_is_bot": False, "max_quantity": 1, "request_name": True}}]],
    "resize_keyboard": True,
    "one_time_keyboard": True,
}


@command("partner")
async def cmd_partner(ctx: Ctx, arg: str) -> None:
    if not ctx.user():
        return await ctx.reply("Сначала открой приложение и прими согласие на обработку данных — это один раз.", reply_markup=ctx.app_button())
    await ctx.reply(
        "Выбери человека из контактов — я пришлю ссылку, которую сможет открыть <b>только он</b>.\n\n"
        "Что именно он увидит, настраивается в приложении: Профиль → Партнёр.",
        reply_markup=PICK_KB,
    )


async def _start_partner(ctx: Ctx, rest: str) -> None:
    await cmd_partner(ctx, rest)


START_PAYLOADS["partner"] = _start_partner


@special("users_shared")
async def on_users_shared(ctx: Ctx) -> None:
    owner = ctx.user()
    shared = ctx.message["users_shared"]
    remove = {"remove_keyboard": True}
    if not owner or shared.get("request_id") != REQUEST_ID:
        return await ctx.reply("Что-то пошло не так. Попробуй ещё раз: /partner", reply_markup=remove)
    users = shared.get("users") or [{"user_id": uid} for uid in shared.get("user_ids", [])]
    if not users:
        return
    picked = users[0]
    pid = int(picked["user_id"])
    name = " ".join(x for x in [picked.get("first_name"), picked.get("last_name")] if x)[:64] or "партнёр"
    if pid == owner.tg_id:
        return await ctx.reply("Нельзя выбрать себя 🙂 Выбери другого человека: /partner", reply_markup=remove)
    db = ctx.db
    g = db.scalar(select(PartnerGrant).where(PartnerGrant.owner_id == owner.id, PartnerGrant.partner_tg_id == pid))
    if g is None:
        count = db.scalar(select(func.count()).select_from(PartnerGrant).where(PartnerGrant.owner_id == owner.id)) or 0
        ent = entitlement(db, owner, s=ctx.settings)
        if count >= ent.partners:
            more = "" if ent.plan == "plus" else f" В Код Тела+ — до {ctx.settings.partners_plus}."
            return await ctx.reply(f"Сейчас можно дать доступ {ent.partners} {'человеку' if ent.partners == 1 else 'людям'}.{more} Убрать кого-нибудь можно в приложении: Профиль → Партнёр.", reply_markup=remove)
        g = PartnerGrant(owner_id=owner.id, partner_tg_id=pid, partner_name=name, scope=json.dumps(DEFAULT_SCOPE), token_hash="")
        db.add(g)
    else:
        g.partner_name = name
    link = new_link(g)
    db.commit()
    await ctx.reply(f"Готово! Доступ для <b>{_esc(name)}</b> создан.", reply_markup=remove)
    await ctx.reply(
        f"Перешли {_esc(name)} эту ссылку:\n\n{link}\n\n"
        "🔒 Открыть её сможет только этот человек — у других она не сработает. "
        "Отозвать доступ можно в приложении: Профиль → Партнёр.",
        reply_markup={"inline_keyboard": [[{"text": "Переслать ссылку", "url": f"https://t.me/share/url?url={link}"}]]},
    )


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ---------- API владельца ----------


def _grant_out(g: PartnerGrant) -> dict:
    return {
        "id": g.id,
        "name": g.partner_name,
        "scope": scope_of(g),
        "createdAt": g.created_at.isoformat(),
        "lastViewedAt": g.last_viewed_at.isoformat() if g.last_viewed_at else None,
    }


@router.get("/v1/partners")
def list_partners(user: UserDep, db: DbDep) -> dict:
    gs = db.scalars(select(PartnerGrant).where(PartnerGrant.owner_id == user.id).order_by(PartnerGrant.created_at)).all()
    return {"partners": [_grant_out(g) for g in gs], "max": entitlement(db, user).partners}


def _own(db, user: User, gid: int) -> PartnerGrant:
    g = db.get(PartnerGrant, gid)
    if g is None or g.owner_id != user.id:
        raise HTTPException(404, "not found")
    return g


class ScopeIn(BaseModel):
    cycle: bool = True
    fertile: bool = False
    mood: bool = False


@router.put("/v1/partners/{gid}")
def update_scope(gid: int, body: ScopeIn, user: UserDep, db: DbDep) -> dict:
    g = _own(db, user, gid)
    g.scope = json.dumps(body.model_dump())
    db.commit()
    return _grant_out(g)


@router.post("/v1/partners/{gid}/link")
def rotate_link(gid: int, user: UserDep, db: DbDep) -> dict:
    g = _own(db, user, gid)
    link = new_link(g)
    db.commit()
    return {"link": link}


@router.delete("/v1/partners/{gid}")
def revoke(gid: int, user: UserDep, db: DbDep) -> dict:
    db.delete(_own(db, user, gid))
    db.commit()
    return {"ok": True}


# ---------- что видит партнёр ----------


def partner_view(db, c: Cipher, g: PartnerGrant, today_utc: datetime) -> dict:
    owner = db.get(User, g.owner_id)
    data = entries.read_many(db, c, owner.subject_id, ["profile", "periodDays", "cycle", "moods", "mode", "reminders"])
    tz = (data.get("reminders") or {}).get("tz") or "Europe/Moscow"
    try:
        today = today_utc.astimezone(ZoneInfo(tz)).date()
    except (KeyError, ValueError):
        today = today_utc.date()
    scope = scope_of(g)
    out: dict = {"owner": ((data.get("profile") or {}).get("name") or "Партнёр")[:40], "scope": scope}
    mode = (data.get("mode") or {}).get("kind", "cycle")
    if mode == "pregnancy":
        lmp = (data.get("mode") or {}).get("pregnancyLmp")
        if scope["cycle"] and lmp:
            days = (today - date.fromisoformat(lmp)).days
            if 0 <= days <= 44 * 7:
                out["pregnancy"] = {"week": days // 7, "day": days % 7}
    elif scope["cycle"]:
        st = today_status(data.get("periodDays"), data.get("cycle"), today)
        if st:
            cyc = {
                "day": st.day,
                "phase": st.phase,
                "phaseName": PHASE_NAMES[st.phase],
                "period": st.mark == "period",
                "lateDays": st.late_days,
                "nextPeriod": st.next_period.isoformat() if st.next_period and not st.late_days else None,
                "periodInDays": (st.next_period - today).days if st.next_period and not st.late_days else None,
            }
            if scope["fertile"]:
                cyc["fertile"] = st.mark in ("fertile", "ovulation")
                cyc["ovulationInDays"] = (st.next_ovulation - today).days if st.next_ovulation else None
            out["cycle"] = cyc
    if scope["mood"]:
        m = (data.get("moods") or {}).get(today.isoformat())
        out["mood"] = {"value": m, "label": MOOD_NAMES[m]} if m else None
    return out


@router.get("/v1/partner/{token}")
def view_as_partner(token: str, tg: TgDep, db: DbDep, c: CipherDep) -> dict:
    g = db.scalar(select(PartnerGrant).where(PartnerGrant.token_hash == _hash(token)))
    # одинаковый ответ для «нет такой ссылки» и «ссылка не для тебя» — не раскрываем, что она существует
    if g is None or g.partner_tg_id != tg.id:
        raise HTTPException(404, "link not found")
    g.last_viewed_at = now()
    db.commit()
    return partner_view(db, c, g, datetime.now(timezone.utc))
