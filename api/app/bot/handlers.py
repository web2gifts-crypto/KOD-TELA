"""Обработка апдейтов бота (вебхук POST /bot/webhook).

Команды:
  /start      — приветствие и кнопка приложения (deep link: /start <payload>)
  /reminders  — настройки напоминаний
  /mute       — выключить все напоминания
  /help, /privacy
Остальные фичи (напоминания, партнёр, оплата) регистрируют свои обработчики через @command/@callback.
"""

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings
from ..db import User
from .client import Bot, BotError, open_app_button

log = logging.getLogger("kodtela.bot")


class Ctx:
    def __init__(self, bot: Bot, db: Session, settings: Settings, update: dict):
        self.bot = bot
        self.db = db
        self.settings = settings
        self.update = update
        msg = update.get("message") or update.get("callback_query", {}).get("message") or {}
        frm = (update.get("message") or update.get("callback_query") or update.get("pre_checkout_query") or {}).get("from") or {}
        self.chat_id: int | None = (msg.get("chat") or {}).get("id") or frm.get("id")
        self.tg_id: int | None = frm.get("id")
        self.message = update.get("message") or {}
        self.callback = update.get("callback_query")

    def user(self) -> User | None:
        """Зарегистрированный пользователь (дал согласие) или None"""
        if self.tg_id is None:
            return None
        u = self.db.scalar(select(User).where(User.tg_id == self.tg_id))
        return u if u and u.consent_version else None

    async def reply(self, text: str, **kw: Any) -> None:
        if self.chat_id is not None:
            await self.bot.send(self.chat_id, text, **kw)

    def app_button(self, text: str = "Открыть «Код Тела»", path: str = "/") -> dict:
        """Кнопка Mini App; path — экран приложения (hash-роутинг), например '/data'"""
        return open_app_button(text, f"{self.settings.webapp_url}#{path}")


Handler = Callable[[Ctx, str], Awaitable[None]]
COMMANDS: dict[str, Handler] = {}
CALLBACKS: dict[str, Handler] = {}
# прочие типы апдейтов: users_shared, pre_checkout_query, successful_payment
SPECIAL: dict[str, Callable[[Ctx], Awaitable[None]]] = {}

# список команд для меню бота (setMyCommands)
MENU = [
    ("start", "Открыть приложение"),
    ("reminders", "Напоминания"),
    ("mute", "Выключить все напоминания"),
    ("partner", "Доступ для партнёра"),
    ("help", "Помощь"),
    ("privacy", "Мои данные и конфиденциальность"),
]


def command(name: str):
    def deco(fn: Handler) -> Handler:
        COMMANDS[name] = fn
        return fn

    return deco


def callback(prefix: str):
    """callback_data вида '<prefix>:<arg>'"""

    def deco(fn: Handler) -> Handler:
        CALLBACKS[prefix] = fn
        return fn

    return deco


def special(kind: str):
    def deco(fn):
        SPECIAL[kind] = fn
        return fn

    return deco


async def handle_update(bot: Bot, db: Session, settings: Settings, update: dict) -> None:
    ctx = Ctx(bot, db, settings, update)
    try:
        if "pre_checkout_query" in update and "pre_checkout_query" in SPECIAL:
            return await SPECIAL["pre_checkout_query"](ctx)
        msg = update.get("message")
        if msg:
            if msg.get("chat", {}).get("type") != "private":
                return  # в группах бот молчит
            for kind in ("users_shared", "successful_payment"):
                if kind in msg and kind in SPECIAL:
                    return await SPECIAL[kind](ctx)
            text = (msg.get("text") or "").strip()
            if text.startswith("/"):
                cmd, _, arg = text[1:].partition(" ")
                cmd = cmd.split("@")[0].lower()
                fn = COMMANDS.get(cmd)
                if fn:
                    return await fn(ctx, arg.strip())
            return await COMMANDS["help"](ctx, "")
        cq = update.get("callback_query")
        if cq:
            prefix, _, arg = (cq.get("data") or "").partition(":")
            fn = CALLBACKS.get(prefix)
            if fn:
                await fn(ctx, arg)
            try:
                await bot.call("answerCallbackQuery", callback_query_id=cq["id"])
            except BotError:
                pass
    except BotError as e:
        log.warning("bot error: %s", e)


# ---------- базовые команды ----------


@command("start")
async def start(ctx: Ctx, arg: str) -> None:
    # deep link t.me/kodtela_app?start=<arg> — фичи могут перехватить свой payload
    for prefix, fn in START_PAYLOADS.items():
        if arg.startswith(prefix):
            return await fn(ctx, arg[len(prefix) :])
    await ctx.reply(
        "Привет! Я Юви 💜\n\n"
        "Здесь твой календарь цикла, настроение, дневник анализов и напоминания. "
        "Открой приложение кнопкой ниже или через меню.\n\n"
        "Напоминания настраиваются командой /reminders, выключить все — /mute.",
        reply_markup=ctx.app_button(),
    )


START_PAYLOADS: dict[str, Handler] = {}


@command("help")
async def help_(ctx: Ctx, arg: str) -> None:
    await ctx.reply(
        "Я умею:\n"
        "• открыть приложение — кнопка «Запустить» внизу или /start\n"
        "• напоминать о месячных, таблетках и отметках — /reminders\n"
        "• выключить все напоминания — /mute\n"
        "• рассказать, как хранятся твои данные — /privacy\n\n"
        "⚕️ Я не ставлю диагнозы. Если чувствуешь, что состояние опасное, — звони 103 или 112.",
        reply_markup=ctx.app_button(),
    )


@command("privacy")
async def privacy(ctx: Ctx, arg: str) -> None:
    await ctx.reply(
        "🔒 Данные хранятся на серверах в России, данные о здоровье — в зашифрованном виде. "
        "Скачать их или удалить можно в приложении: Профиль → «Мои данные».",
        reply_markup=ctx.app_button("Мои данные", "/data"),
    )


UPDATES = ["message", "callback_query", "pre_checkout_query"]


async def setup_bot(bot: Bot, settings: Settings, webhook: bool) -> None:
    """Меню команд и способ получения апдейтов"""
    from .client import webhook_secret

    if webhook:
        await bot.call("setWebhook", url=f"{settings.public_api_url}/bot/webhook", secret_token=webhook_secret(settings.bot_token), allowed_updates=UPDATES)
    else:
        await bot.call("deleteWebhook", drop_pending_updates=False)
    await bot.call("setMyCommands", commands=[{"command": c, "description": d} for c, d in MENU])
    log.info("bot ready (%s)", "webhook" if webhook else "polling")
