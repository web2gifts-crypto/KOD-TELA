"""Проверка Telegram initData и шифрование данных.

initData: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
  secret = HMAC_SHA256(key="WebAppData", msg=bot_token)
  hash   = hex(HMAC_SHA256(key=secret, msg=data_check_string))
"""

import base64
import hashlib
import hmac
import json
import os
import time
import uuid
from dataclasses import dataclass
from urllib.parse import parse_qsl

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class InitDataError(Exception):
    pass


@dataclass(frozen=True)
class TgUser:
    id: int
    language_code: str | None = None


def validate_init_data(init_data: str, bot_token: str, max_age: int, now: float | None = None) -> TgUser:
    if not bot_token:
        raise InitDataError("bot token is not configured")
    try:
        pairs = dict(parse_qsl(init_data, keep_blank_values=True, strict_parsing=True))
    except ValueError as e:
        raise InitDataError("malformed init data") from e
    received = pairs.pop("hash", None)
    if not received:
        raise InitDataError("no hash")
    # все остальные поля (включая signature) входят в data_check_string
    check = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received):
        raise InitDataError("bad signature")
    try:
        auth_date = int(pairs.get("auth_date", "0"))
    except ValueError as e:
        raise InitDataError("bad auth_date") from e
    if (now or time.time()) - auth_date > max_age:
        raise InitDataError("init data expired")
    try:
        user = json.loads(pairs["user"])
        return TgUser(id=int(user["id"]), language_code=user.get("language_code"))
    except (KeyError, ValueError, TypeError) as e:
        raise InitDataError("no user") from e


def sign_init_data(fields: dict[str, str], bot_token: str) -> str:
    """Подписать initData (для тестов и локальной разработки)."""
    from urllib.parse import urlencode

    check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    h = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode({**fields, "hash": h})


class Cipher:
    """AES-256-GCM. Формат: nonce(12) | ciphertext+tag. AAD привязывает шифротекст к владельцу и ключу записи,
    поэтому чужую запись нельзя «подложить» другому пользователю."""

    def __init__(self, key_b64: str):
        try:
            key = base64.b64decode(key_b64, validate=True)
        except ValueError as e:
            raise ValueError("DATA_KEY must be base64") from e
        if len(key) != 32:
            raise ValueError("DATA_KEY must be 32 bytes (base64)")
        self._aes = AESGCM(key)

    @staticmethod
    def _aad(subject: uuid.UUID, key: str) -> bytes:
        return f"{subject}:{key}".encode()

    def encrypt(self, subject: uuid.UUID, key: str, data: bytes) -> bytes:
        nonce = os.urandom(12)
        return nonce + self._aes.encrypt(nonce, data, self._aad(subject, key))

    def decrypt(self, subject: uuid.UUID, key: str, blob: bytes) -> bytes:
        return self._aes.decrypt(blob[:12], blob[12:], self._aad(subject, key))
