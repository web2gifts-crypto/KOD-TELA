from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from tests.conftest import auth, register
from tests.test_bot import send_update

TG = 42


def user_id():
    from app.db import User, get_db

    return str(next(get_db()).scalar(select(User).where(User.tg_id == TG)).id)


def pre_checkout(plan="plus_month", amount=149, uid=None, tg=TG):
    return {"update_id": 9, "pre_checkout_query": {"id": "pc1", "from": {"id": tg}, "currency": "XTR", "total_amount": amount, "invoice_payload": f"{plan}:{uid or user_id()}"}}


def paid(plan="plus_month", charge="ch1", amount=149, **extra):
    pay = {"currency": "XTR", "total_amount": amount, "invoice_payload": f"{plan}:{user_id()}", "telegram_payment_charge_id": charge, **extra}
    return {"update_id": 10, "message": {"message_id": 9, "from": {"id": TG}, "chat": {"id": TG, "type": "private"}, "successful_payment": pay}}


def test_free_by_default(client):
    register(client)
    b = client.get("/v1/billing", headers=auth()).json()
    assert b["plan"] == "free"
    assert [p["id"] for p in b["plans"]] == ["plus_month", "plus_year"]
    assert "5" in b["features"][0]


def test_invoice_link(client):
    register(client)
    r = client.post("/v1/billing/invoice", json={"plan": "plus_month"}, headers=auth())
    assert r.json()["link"].startswith("https://t.me/")
    [call] = client.bot.sent("createInvoiceLink")
    assert call["currency"] == "XTR" and call["prices"][0]["amount"] == 149 and call["subscription_period"] == 30 * 24 * 3600
    client.post("/v1/billing/invoice", json={"plan": "plus_year"}, headers=auth())
    assert client.bot.sent("createInvoiceLink")[-1]["subscription_period"] is None
    assert client.post("/v1/billing/invoice", json={"plan": "free_forever"}, headers=auth()).status_code == 422


def test_pre_checkout_validation(client):
    register(client)
    send_update(client, pre_checkout())
    assert client.bot.sent("answerPreCheckoutQuery")[-1]["ok"] is True
    # подмена суммы или чужой счёт — отказ
    send_update(client, pre_checkout(amount=1))
    assert client.bot.sent("answerPreCheckoutQuery")[-1]["ok"] is False
    send_update(client, pre_checkout(uid="someone-else"))
    assert client.bot.sent("answerPreCheckoutQuery")[-1]["ok"] is False


def test_successful_payment_activates_plus(client):
    register(client)
    exp = int((datetime.now(timezone.utc) + timedelta(days=30)).timestamp())
    send_update(client, paid(subscription_expiration_date=exp, is_recurring=True, is_first_recurring=True))
    b = client.get("/v1/billing", headers=auth()).json()
    assert b["plan"] == "plus" and b["recurring"] is True
    assert "активен" in client.bot.sent()[-1]["text"]
    # повтор того же апдейта не создаёт второй платёж
    send_update(client, paid(subscription_expiration_date=exp, is_recurring=True))
    from app.db import Subscription, get_db

    assert len(next(get_db()).scalars(select(Subscription)).all()) == 1


def test_year_extends_after_current_period(client):
    register(client)
    send_update(client, paid("plus_year", "y1", 1190))
    send_update(client, paid("plus_year", "y2", 1190))
    until = datetime.fromisoformat(client.get("/v1/billing", headers=auth()).json()["until"])
    assert 725 <= (until - datetime.now(timezone.utc)).days <= 730


def test_cancel_keeps_access(client):
    register(client)
    exp = int((datetime.now(timezone.utc) + timedelta(days=30)).timestamp())
    send_update(client, paid(subscription_expiration_date=exp, is_recurring=True))
    r = client.post("/v1/billing/cancel", headers=auth()).json()
    assert r["ok"] and client.bot.sent("editUserStarSubscription")[-1]["is_canceled"] is True
    b = client.get("/v1/billing", headers=auth()).json()
    assert b["plan"] == "plus" and b["canceled"] is True


def test_expired_is_free(client):
    from app import billing
    from app.db import User, get_db

    register(client)
    send_update(client, paid("plus_year", "y1", 1190))
    db = next(get_db())
    u = db.scalar(select(User).where(User.tg_id == TG))
    assert billing.entitlement(db, u, datetime.now(timezone.utc) + timedelta(days=400)).plan == "free"


def test_ai_daily_limit_by_plan(client, monkeypatch):
    from app import config

    register(client)
    monkeypatch.setenv("AI_ENABLED", "true")
    monkeypatch.setenv("AI_PER_DAY_FREE", "2")
    config.get_settings.cache_clear()
    req = {"symptom": "устала", "history": []}
    codes = [client.post("/v1/chat", json=req, headers=auth()).status_code for _ in range(3)]
    assert codes == [200, 200, 429]
    r = client.post("/v1/chat", json=req, headers=auth())
    assert r.json()["detail"]["code"] == "limit"
    # красные флаги — всегда, без лимита
    assert client.post("/v1/chat", json={"symptom": "не могу дышать", "history": []}, headers=auth()).status_code == 200
    # с подпиской лимит больше
    send_update(client, paid("plus_year", "y1", 1190))
    assert client.post("/v1/chat", json=req, headers=auth()).status_code == 200
