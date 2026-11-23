"""Технические алерты в Telegram: ошибки API и воркера уходят в ADMIN_CHAT_ID.
Без персональных данных — только тип ошибки и место. Одинаковые сообщения — не чаще раза в 10 минут."""

import logging
import time

import httpx

from .config import get_settings


class TelegramAlertHandler(logging.Handler):
    def __init__(self, token: str, chat_id: int, source: str):
        super().__init__(level=logging.ERROR)
        self._url = f"https://api.telegram.org/bot{token}/sendMessage"
        self._chat = chat_id
        self._source = source
        self._sent: dict[str, float] = {}

    def emit(self, record: logging.LogRecord) -> None:
        key = f"{record.name}:{record.getMessage()[:120]}"
        now = time.monotonic()
        if now - self._sent.get(key, -1e9) < 600:
            return
        self._sent[key] = now
        exc = record.exc_info[0].__name__ if record.exc_info and record.exc_info[0] else ""
        text = f"⚠️ kodtela {self._source}: {record.getMessage()[:300]}" + (f"\n{exc}" if exc else "")
        try:
            httpx.post(self._url, json={"chat_id": self._chat, "text": text}, timeout=5)
        except httpx.HTTPError:
            pass


def install(source: str) -> None:
    s = get_settings()
    if s.admin_chat_id and s.bot_token:
        logging.getLogger().addHandler(TelegramAlertHandler(s.bot_token, s.admin_chat_id, source))
