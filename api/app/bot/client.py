"""Тонкий клиент Bot API. В тестах подменяется на FakeBot (см. tests/conftest.py)."""

import hashlib
import hmac
import logging
from typing import Any

import httpx

log = logging.getLogger("kodtela.bot")


class BotError(Exception):
    pass


class Bot:
    def __init__(self, token: str):
        self._base = f"https://api.telegram.org/bot{token}/"

    async def call(self, method: str, **params: Any) -> Any:
        params = {k: v for k, v in params.items() if v is not None}
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                r = await c.post(self._base + method, json=params)
            data = r.json()
        except (httpx.HTTPError, ValueError) as e:
            raise BotError(f"{method}: {e}") from e
        if not data.get("ok"):
            # 403 — пользователь заблокировал бота; это не ошибка сервера
            raise BotError(f"{method}: {data.get('error_code')} {data.get('description')}")
        return data["result"]

    async def send(self, chat_id: int, text: str, **kw: Any) -> Any:
        return await self.call("sendMessage", chat_id=chat_id, text=text, parse_mode="HTML", link_preview_options={"is_disabled": True}, **kw)


def webhook_secret(token: str) -> str:
    """Секрет для заголовка X-Telegram-Bot-Api-Secret-Token — выводится из токена, отдельно хранить не нужно."""
    return hmac.new(token.encode(), b"kodtela-webhook", hashlib.sha256).hexdigest()[:48]


# --- клавиатуры ---


def open_app_button(text: str, url: str) -> dict:
    return {"inline_keyboard": [[{"text": text, "web_app": {"url": url}}]]}


def inline(rows: list[list[tuple[str, str]]]) -> dict:
    """[[(текст, callback_data)]] → inline-клавиатура"""
    return {"inline_keyboard": [[{"text": t, "callback_data": d} for t, d in row] for row in rows]}
