import base64
import json
import os
import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

BOT = "123456:TEST-token"
KEY = base64.b64encode(b"k" * 32).decode()


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}/t.db")
    monkeypatch.setenv("BOT_TOKEN", BOT)
    monkeypatch.setenv("DATA_KEY", KEY)
    monkeypatch.setenv("CONSENT_VERSION", "v1")
    from app import config, db

    config.get_settings.cache_clear()
    db.reset_engine()
    # схема — теми же миграциями, что и в проде
    from alembic import command
    from alembic.config import Config

    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "migrations"))
    command.upgrade(cfg, "head")

    import app.main as main

    main._hits.clear()
    main._bot = FakeBot()
    with TestClient(main.app) as c:
        c.bot = main._bot
        yield c
    db.reset_engine()
    config.get_settings.cache_clear()


def auth(tg_id=42, age=0, token=BOT):
    from app.security import sign_init_data

    data = sign_init_data({"auth_date": str(int(time.time()) - age), "user": json.dumps({"id": tg_id, "first_name": "A"}), "query_id": "q"}, token)
    return {"Authorization": f"tma {data}"}


def register(client, tg_id=42):
    r = client.post("/v1/consent", json={"version": "v1", "health_data": True}, headers=auth(tg_id))
    assert r.status_code == 200, r.text




class FakeBot:
    """Записывает вызовы Bot API вместо отправки в Telegram"""

    def __init__(self):
        self.calls: list[tuple[str, dict]] = []

    async def call(self, method, **params):
        self.calls.append((method, params))
        if method == "createInvoiceLink":
            return "https://t.me/$invoice"
        return {"message_id": len(self.calls)}

    async def send(self, chat_id, text, **kw):
        return await self.call("sendMessage", chat_id=chat_id, text=text, **kw)

    def sent(self, method="sendMessage"):
        return [p for m, p in self.calls if m == method]
