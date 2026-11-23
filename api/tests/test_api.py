from tests.conftest import BOT, KEY, auth, register  # noqa: F401

import json

import pytest
from sqlalchemy import select


# ---------- авторизация ----------


def test_health(client):
    assert client.get("/health").json() == "ok"


@pytest.mark.parametrize(
    "headers",
    [{}, {"Authorization": "Bearer x"}, {"Authorization": "tma garbage"}, None, "expired"],
)
def test_rejects_bad_init_data(client, headers):
    if headers is None:
        headers = auth(token="999:other")  # подписано чужим ботом
    elif headers == "expired":
        headers = auth(age=2 * 24 * 3600)
    assert client.get("/v1/me", headers=headers).status_code == 401


def test_tampered_init_data(client):
    h = auth(42)["Authorization"].replace("%22id%22%3A+42", "%22id%22%3A+43")
    assert client.get("/v1/me", headers={"Authorization": h}).status_code == 401


# ---------- согласие ----------


def test_no_account_before_consent(client):
    r = client.get("/v1/me", headers=auth())
    assert r.json() == {"registered": False, "consent_version": None, "needs_consent": True, "current_consent_version": "v1"}
    assert client.get("/v1/data", headers=auth()).status_code == 403
    from app.db import User, get_db

    s = next(get_db())
    assert s.scalars(select(User)).all() == []  # без согласия ничего не храним


def test_consent_requires_health_and_current_version(client):
    assert client.post("/v1/consent", json={"version": "v1", "health_data": False}, headers=auth()).status_code == 422
    assert client.post("/v1/consent", json={"version": "old", "health_data": True}, headers=auth()).status_code == 409
    register(client)
    assert client.get("/v1/me", headers=auth()).json()["needs_consent"] is False


def test_new_consent_version_asks_again(client, monkeypatch):
    register(client)
    from app import config

    monkeypatch.setenv("CONSENT_VERSION", "v2")
    config.get_settings.cache_clear()
    assert client.get("/v1/me", headers=auth()).json()["needs_consent"] is True


# ---------- данные ----------


def test_data_roundtrip_and_versions(client):
    register(client)
    h = auth()
    moods = {"2026-11-01": 4, "2026-11-02": 2}
    r = client.put("/v1/data/moods", json={"data": moods, "baseVersion": None}, headers=h)
    assert r.json()["version"] == 1
    r = client.put("/v1/data/moods", json={"data": {**moods, "2026-11-03": 5}, "baseVersion": 1}, headers=h)
    assert r.json()["version"] == 2
    got = client.get("/v1/data", headers=h).json()["entries"]["moods"]
    assert got["version"] == 2 and got["data"]["2026-11-03"] == 5


def test_conflict_returns_current(client):
    register(client)
    h = auth()
    client.put("/v1/data/cycle", json={"data": {"cycleLength": 28}, "baseVersion": None}, headers=h)
    client.put("/v1/data/cycle", json={"data": {"cycleLength": 30}, "baseVersion": 1}, headers=h)
    # устройство со старой версией не затирает свежие данные
    r = client.put("/v1/data/cycle", json={"data": {"cycleLength": 26}, "baseVersion": 1}, headers=h)
    assert r.status_code == 409
    assert r.json()["current"]["data"] == {"cycleLength": 30}


def test_unknown_key_and_size_limit(client, monkeypatch):
    register(client)
    assert client.put("/v1/data/passwords", json={"data": 1}, headers=auth()).status_code == 404
    from app import config

    monkeypatch.setenv("MAX_ENTRY_BYTES", "100")
    config.get_settings.cache_clear()
    assert client.put("/v1/data/labs", json={"data": "x" * 200}, headers=auth()).status_code == 413


def test_users_are_isolated(client):
    register(client, 1)
    register(client, 2)
    client.put("/v1/data/moods", json={"data": {"d": 1}}, headers=auth(1))
    assert client.get("/v1/data", headers=auth(2)).json()["entries"] == {}


def test_health_data_encrypted_at_rest(client):
    register(client)
    client.put("/v1/data/labs", json={"data": [{"name": "Ферритин", "value": 14}]}, headers=auth())
    from app.db import Entry, User, get_db

    s = next(get_db())
    e = s.scalars(select(Entry)).one()
    assert b"14" not in e.data_enc and "Ферритин".encode() not in e.data_enc
    # запись привязана к псевдониму, а не к Telegram ID
    u = s.scalars(select(User)).one()
    assert e.subject_id == u.subject_id and e.subject_id != u.id


def test_ciphertext_bound_to_owner():
    import uuid

    from app.security import Cipher

    c = Cipher(KEY)
    a, b = uuid.uuid4(), uuid.uuid4()
    blob = c.encrypt(a, "labs", b"secret")
    assert c.decrypt(a, "labs", blob) == b"secret"
    with pytest.raises(Exception):
        c.decrypt(b, "labs", blob)  # подложить чужому пользователю нельзя
    with pytest.raises(Exception):
        c.decrypt(a, "moods", blob)


def test_export_and_delete(client):
    register(client)
    h = auth()
    client.put("/v1/data/moods", json={"data": {"d": 3}}, headers=h)
    ex = client.get("/v1/me/export", headers=h).json()
    assert ex["data"] == {"moods": {"d": 3}} and ex["account"]["consent_version"] == "v1"

    assert client.delete("/v1/me", headers=h).json() == {"ok": True}
    from app.db import Consent, Entry, User, get_db

    s = next(get_db())
    assert s.scalars(select(Entry)).all() == []
    assert s.scalars(select(User)).all() == []
    log = s.scalars(select(Consent)).all()
    assert [c.action for c in log] == ["accepted", "deleted"] and all(c.user_id is None for c in log)
    assert client.get("/v1/me", headers=h).json()["registered"] is False


# ---------- чат ----------


def test_chat_disabled_but_red_flags_work(client):
    register(client)
    h = auth()
    req = {"symptom": "болит живот", "answers": {}, "history": []}
    assert client.post("/v1/chat", json=req, headers=h).status_code == 503
    r = client.post("/v1/chat", json={**req, "symptom": "я беременна и болит живот"}, headers=h)
    assert r.status_code == 200 and r.json()["verdict"]["level"] == "emergency"
    r = client.post("/v1/chat", json={**req, "symptom": "не хочу жить"}, headers=h)
    assert "8-800-2000-122" in json.dumps(r.json(), ensure_ascii=False)


def test_chat_stub_and_policy_filter(client, monkeypatch):
    register(client)
    from app import config
    from app.ai import providers
    from app.ai.base import ChatReply

    monkeypatch.setenv("AI_ENABLED", "true")
    config.get_settings.cache_clear()
    req = {"symptom": "болит голова", "answers": {"duration": "Сегодня"}, "phase": "luteal", "cycleDay": 20, "history": []}
    r = client.post("/v1/chat", json=req, headers=auth())
    assert r.status_code == 200 and r.json()["verdict"]["level"] == "info"

    class Bad:
        name = "bad"

        async def reply(self, req):
            return ChatReply(text="Не переживай, это норма. Выпей ибупрофен 400 мг")

    monkeypatch.setitem(providers._cache, "stub", Bad())
    assert client.post("/v1/chat", json=req, headers=auth()).status_code == 502


def test_ai_prompt_has_no_personal_data():
    from app.ai.base import ChatRequest
    from app.ai.providers import build_messages

    msgs = build_messages(ChatRequest(symptom="устала", phase="luteal", cycleDay=21))
    text = json.dumps(msgs, ensure_ascii=False)
    assert "лютеиновая" in text and "21" in text
    assert "tg" not in text.lower() and "first_name" not in text


def test_rate_limit(client, monkeypatch):
    register(client)
    from app import config

    monkeypatch.setenv("AI_ENABLED", "true")
    monkeypatch.setenv("CHAT_PER_HOUR", "2")
    config.get_settings.cache_clear()
    req = {"symptom": "устала", "history": []}
    codes = [client.post("/v1/chat", json=req, headers=auth()).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_db_url_from_parts_escapes_password(monkeypatch):
    from app.config import Settings

    s = Settings(database_url="", db_host="192.168.0.5", db_password="p@ss:w/rd#1")
    assert s.db_url == "postgresql+psycopg://gen_user:p%40ss%3Aw%2Frd%231@192.168.0.5:5432/default_db"
