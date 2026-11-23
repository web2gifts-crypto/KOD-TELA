from app.bot.client import webhook_secret
from tests.conftest import BOT


def send_update(client, update, secret=None):
    return client.post("/bot/webhook", json=update, headers={"X-Telegram-Bot-Api-Secret-Token": secret or webhook_secret(BOT)})


def msg(text, tg_id=42, chat_type="private"):
    return {"update_id": 1, "message": {"message_id": 1, "from": {"id": tg_id}, "chat": {"id": tg_id, "type": chat_type}, "text": text}}


def test_webhook_requires_secret(client):
    assert send_update(client, msg("/start"), secret="wrong").status_code == 403
    assert client.post("/bot/webhook", json=msg("/start")).status_code == 403
    assert client.bot.calls == []


def test_start_shows_app_button(client):
    assert send_update(client, msg("/start")).status_code == 200
    [m] = client.bot.sent()
    assert m["chat_id"] == 42
    assert "Юви" in m["text"]
    assert m["reply_markup"]["inline_keyboard"][0][0]["web_app"]["url"].startswith("https://app.kodtela.tech/")


def test_unknown_text_gets_help(client):
    send_update(client, msg("привет"))
    assert "/reminders" in client.bot.sent()[0]["text"]


def test_privacy_opens_my_data(client):
    send_update(client, msg("/privacy@kodtela_app"))
    assert client.bot.sent()[0]["reply_markup"]["inline_keyboard"][0][0]["web_app"]["url"].endswith("#/data")


def test_silent_in_groups(client):
    send_update(client, msg("/start", chat_type="group"))
    assert client.bot.calls == []


def test_pin_reset_notifies_owner(client):
    from tests.conftest import auth, register

    register(client)
    assert client.post("/v1/security/pin-reset", headers=auth()).json() == {"ok": True}
    m = client.bot.sent()[-1]
    assert m["chat_id"] == 42 and "сбросили код" in m["text"]


def test_worker_polls_and_handles_updates(client, monkeypatch):
    """Long polling: воркер забирает апдейты сам и отвечает на /start"""
    import asyncio

    from app import worker

    calls = {"n": 0}

    class PollBot(type(client.bot)):
        async def call(self, method, **params):
            if method == "getUpdates":
                calls["n"] += 1
                if calls["n"] == 1:
                    return [{"update_id": 5, "message": {"message_id": 1, "from": {"id": 42}, "chat": {"id": 42, "type": "private"}, "text": "/start"}}]
                assert params["offset"] == 6
                raise asyncio.CancelledError
            return await super().call(method, **params)

    bot = PollBot()
    try:
        asyncio.run(worker.poll_updates(bot))
    except asyncio.CancelledError:
        pass
    methods = [m for m, _ in bot.calls]
    assert methods[:2] == ["deleteWebhook", "setMyCommands"]
    assert "partner" in [c["command"] for c in bot.calls[1][1]["commands"]]
    assert "Юви" in bot.sent()[-1]["text"]
