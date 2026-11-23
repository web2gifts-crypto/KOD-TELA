import asyncio
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app import reminders
from app.cycle import forecast
from tests.conftest import auth, register
from tests.test_bot import send_update

UTC = timezone.utc


def days(*starts, length=5):
    out = {}
    for s in starts:
        d = date.fromisoformat(s)
        for i in range(length):
            out[(d + timedelta(days=i)).isoformat()] = 2
    return out


# ---------- прогноз (паритет с web/src/lib/cycle.ts) ----------


def test_forecast_matches_frontend():
    f = forecast(days("2026-01-01", "2026-01-27", "2026-02-28", "2026-03-29"), {}, date(2026, 4, 1))
    # длины 26, 32, 29 → средняя 29 (как в cycle.test.ts)
    assert f.cycle_length == 29
    assert f.expected == date(2026, 4, 27)
    assert not f.late


def test_forecast_late_and_settings_fallback():
    f = forecast(days("2026-04-01"), {"cycleLength": 28}, date(2026, 5, 2))
    assert f.late and f.expected == date(2026, 4, 29)
    assert f.ovulation > date(2026, 5, 2)
    assert forecast({}, {}, date(2026, 1, 1)).expected is None


# ---------- план ----------


def at(s):
    return datetime.fromisoformat(s).replace(tzinfo=UTC)


def test_plan_daily_in_user_timezone():
    data = {"reminders": {"tz": "Asia/Yekaterinburg", "mood": {"on": True, "time": "21:00"}, "period": {"on": False}}}
    [(kind, t)] = reminders.plan(data, at("2026-11-23T10:00:00"))
    assert kind == "mood" and t == at("2026-11-23T16:00:00")  # 21:00 по Екатеринбургу = 16:00 UTC
    # уже прошло — завтра
    [(_, t)] = reminders.plan(data, at("2026-11-23T17:00:00"))
    assert t == at("2026-11-24T16:00:00")


def test_plan_period_before_expected():
    data = {"periodDays": days("2026-11-01"), "cycle": {"cycleLength": 28}, "reminders": {"period": {"on": True, "daysBefore": 2, "time": "10:00"}}}
    plan = dict(reminders.plan(data, at("2026-11-20T00:00:00")))
    assert plan["period"] == at("2026-11-27T07:00:00")  # 29.11 − 2 дня, 10:00 МСК
    # при задержке — не напоминаем
    assert "period" not in dict(reminders.plan(data, at("2026-12-01T00:00:00")))


def test_plan_pill_skips_break_week():
    data = {"reminders": {"period": {"on": False}, "pill": {"on": True, "time": "09:00"}}, "pill": {"regimen": "21_7", "packStart": "2026-11-01"}}
    # 21.11 — 21-й день, 22..28 — перерыв, 29.11 — новая пачка
    [(_, t)] = reminders.plan(data, at("2026-11-21T07:00:00"))
    assert t == at("2026-11-29T06:00:00")
    data["pill"]["regimen"] = "continuous"
    [(_, t)] = reminders.plan(data, at("2026-11-21T07:00:00"))
    assert t == at("2026-11-22T06:00:00")


def test_plan_muted_and_bad_values():
    assert reminders.plan({"reminders": {"muted": True, "mood": {"on": True}}}, at("2026-11-23T00:00:00")) == []
    data = {"reminders": {"tz": "Nowhere/City", "mood": {"on": True, "time": "мусор"}, "period": {"on": False}}}
    [(kind, t)] = reminders.plan(data, at("2026-11-23T00:00:00"))
    assert kind == "mood" and t == at("2026-11-23T18:00:00")  # дефолт 21:00 МСК


def test_compose_skips_when_already_done():
    now = at("2026-11-23T18:00:00")
    assert reminders.compose("mood", {"moods": {"2026-11-23": 4}}, now, "https://app/") is None
    assert reminders.compose("mood", {}, now, "https://app/") is not None
    assert reminders.compose("pill", {"pillLog": {"2026-11-23": 1}}, now, "https://app/") is None
    text, kb = reminders.compose("pill", {}, now, "https://app/")
    assert kb["inline_keyboard"][0][0]["callback_data"] == "pill:taken:2026-11-23"
    # месячные уже начались — напоминание о них не нужно
    data = {"periodDays": {**days("2026-10-27"), "2026-11-22": 3}, "cycle": {}}
    assert reminders.compose("period", data, now, "https://app/") is None


# ---------- через API и бота ----------


def put(client, key, data, tg=42):
    cur = client.get("/v1/data", headers=auth(tg)).json()["entries"].get(key)
    r = client.put(f"/v1/data/{key}", json={"data": data, "baseVersion": cur["version"] if cur else None}, headers=auth(tg))
    assert r.status_code == 200, r.text


def jobs():
    from app.db import ReminderJob, get_db

    return [(j.kind) for j in next(get_db()).scalars(select(ReminderJob)).all()]


def cq(data, tg=42):
    return {"update_id": 2, "callback_query": {"id": "c1", "from": {"id": tg}, "data": data, "message": {"message_id": 5, "chat": {"id": tg, "type": "private"}}}}


def test_saving_settings_schedules_jobs(client):
    register(client)
    put(client, "reminders", {"mood": {"on": True, "time": "21:00"}, "pill": {"on": True, "time": "09:00"}})
    assert sorted(jobs()) == ["mood", "pill"]


def test_mute_command_and_toggle(client):
    register(client)
    put(client, "reminders", {"mood": {"on": True}})
    send_update(client, {"update_id": 1, "message": {"message_id": 1, "from": {"id": 42}, "chat": {"id": 42, "type": "private"}, "text": "/mute"}})
    assert jobs() == []
    assert "выключены" in client.bot.sent()[-1]["text"]
    # приложение видит изменение (версия выросла)
    data = client.get("/v1/data", headers=auth()).json()["entries"]["reminders"]
    assert data["data"]["muted"] is True and data["version"] == 2
    send_update(client, cq("rem:unmute"))
    assert "mood" in jobs()
    edited = client.bot.sent("editMessageText")[-1]
    assert "Напоминания" in edited["text"]


def test_pill_taken_from_bot(client):
    register(client)
    send_update(client, cq("pill:taken:2026-11-23"))
    log_ = client.get("/v1/data", headers=auth()).json()["entries"]["pillLog"]["data"]
    assert log_ == {"2026-11-23": 1}
    send_update(client, cq("pill:snooze:2026-11-23"))
    assert "pill_snooze" in jobs()


def test_unregistered_user_gets_hint(client):
    send_update(client, {"update_id": 1, "message": {"message_id": 1, "from": {"id": 9}, "chat": {"id": 9, "type": "private"}, "text": "/reminders"}})
    assert "согласие" in client.bot.sent()[-1]["text"]


def test_worker_sends_and_reschedules(client):
    from app.worker import send_due

    register(client)
    put(client, "reminders", {"tz": "UTC", "mood": {"on": True, "time": "21:00"}, "period": {"on": False}})
    now = datetime.now(UTC)
    later = now + timedelta(days=1, minutes=1)
    n = asyncio.run(send_due(client.bot, later))
    assert n == 1
    sent = client.bot.sent()[-1]
    assert sent["chat_id"] == 42 and "настроение" in sent["text"]
    assert jobs() == ["mood"]  # следующее — запланировано заново


def test_worker_skips_if_mood_logged(client):
    from app.worker import send_due

    register(client)
    put(client, "reminders", {"tz": "UTC", "mood": {"on": True, "time": "00:00"}, "period": {"on": False}})
    fire_day = (datetime.now(UTC) + timedelta(days=1)).date().isoformat()
    put(client, "moods", {fire_day: 5})
    before = len(client.bot.sent())
    asyncio.run(send_due(client.bot, datetime.fromisoformat(fire_day + "T00:00:30+00:00")))
    assert len(client.bot.sent()) == before


def test_delete_account_removes_jobs(client):
    register(client)
    put(client, "reminders", {"mood": {"on": True}})
    client.delete("/v1/me", headers=auth())
    assert jobs() == []


def test_purge_inactive(client):
    from app.db import User, get_db
    from app.worker import purge_inactive

    register(client, 1)
    register(client, 2)
    db = next(get_db())
    u = db.scalar(select(User).where(User.tg_id == 1))
    u.last_seen_at = datetime(2020, 1, 1, tzinfo=UTC)
    db.commit()
    assert purge_inactive(datetime(2026, 1, 1, tzinfo=UTC)) == 1
    assert [x.tg_id for x in next(get_db()).scalars(select(User)).all()] == [2]


def test_pregnancy_mode_pauses_cycle_reminders():
    data = {"periodDays": days("2026-11-01"), "reminders": {"period": {"on": True}, "fertile": {"on": True}, "mood": {"on": True}}, "mode": {"kind": "pregnancy"}}
    assert [k for k, _ in reminders.plan(data, at("2026-11-05T00:00:00"))] == ["mood"]
