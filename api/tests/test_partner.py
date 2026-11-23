import re
from datetime import date, timedelta

from tests.conftest import auth, register
from tests.test_bot import msg, send_update

OWNER, PARTNER, STRANGER = 42, 77, 99


def shared(user_id, tg=OWNER, name="Миша"):
    return {"update_id": 3, "message": {"message_id": 3, "from": {"id": tg}, "chat": {"id": tg, "type": "private"}, "users_shared": {"request_id": 1, "users": [{"user_id": user_id, "first_name": name}]}}}


def put(client, key, data, tg=OWNER):
    cur = client.get("/v1/data", headers=auth(tg)).json()["entries"].get(key)
    assert client.put(f"/v1/data/{key}", json={"data": data, "baseVersion": cur["version"] if cur else None}, headers=auth(tg)).status_code == 200


def invite(client, partner=PARTNER):
    send_update(client, shared(partner))
    text = client.bot.sent()[-1]["text"]
    return re.search(r"startapp=p_([\w-]+)", text).group(1)


def setup_owner(client):
    register(client, OWNER)
    today = date.today()
    start = today - timedelta(days=9)
    put(client, "periodDays", {(start + timedelta(days=i)).isoformat(): 2 for i in range(5)})
    put(client, "profile", {"name": "Аня"})
    put(client, "moods", {today.isoformat(): 4})


def test_partner_command_shows_contact_picker(client):
    register(client, OWNER)
    send_update(client, msg("/start partner", OWNER))
    kb = client.bot.sent()[-1]["reply_markup"]["keyboard"][0][0]
    assert kb["request_users"]["max_quantity"] == 1 and kb["request_users"]["user_is_bot"] is False


def test_link_works_only_for_chosen_person(client):
    setup_owner(client)
    token = invite(client)
    r = client.get(f"/v1/partner/{token}", headers=auth(PARTNER))
    assert r.status_code == 200
    v = r.json()
    assert v["owner"] == "Аня"
    assert v["cycle"]["day"] == 10 and v["cycle"]["phaseName"]
    # по умолчанию — без фертильности и настроения
    assert "fertile" not in v["cycle"] and "mood" not in v
    # переслали ссылку другому — не открывается
    assert client.get(f"/v1/partner/{token}", headers=auth(STRANGER)).status_code == 404
    # владелец по ссылке тоже не «партнёр»
    assert client.get(f"/v1/partner/{token}", headers=auth(OWNER)).status_code == 404
    assert client.get("/v1/partner/garbage", headers=auth(PARTNER)).status_code == 404


def test_partner_does_not_need_own_account_or_consent(client):
    setup_owner(client)
    token = invite(client)
    assert client.get(f"/v1/partner/{token}", headers=auth(PARTNER)).status_code == 200
    assert client.get("/v1/me", headers=auth(PARTNER)).json()["registered"] is False


def test_owner_controls_scope_and_revokes(client):
    setup_owner(client)
    token = invite(client)
    [g] = client.get("/v1/partners", headers=auth(OWNER)).json()["partners"]
    assert g["name"] == "Миша" and g["lastViewedAt"] is None
    client.put(f"/v1/partners/{g['id']}", json={"cycle": True, "fertile": True, "mood": True}, headers=auth(OWNER))
    v = client.get(f"/v1/partner/{token}", headers=auth(PARTNER)).json()
    assert v["mood"] == {"value": 4, "label": "Хорошо"} and "fertile" in v["cycle"]
    assert client.get("/v1/partners", headers=auth(OWNER)).json()["partners"][0]["lastViewedAt"]
    # другой пользователь не может менять чужие доступы
    register(client, STRANGER)
    assert client.delete(f"/v1/partners/{g['id']}", headers=auth(STRANGER)).status_code == 404
    assert client.delete(f"/v1/partners/{g['id']}", headers=auth(OWNER)).json() == {"ok": True}
    assert client.get(f"/v1/partner/{token}", headers=auth(PARTNER)).status_code == 404


def test_rotate_link_invalidates_old(client):
    setup_owner(client)
    old = invite(client)
    gid = client.get("/v1/partners", headers=auth(OWNER)).json()["partners"][0]["id"]
    new = client.post(f"/v1/partners/{gid}/link", headers=auth(OWNER)).json()["link"].split("p_")[1]
    assert client.get(f"/v1/partner/{old}", headers=auth(PARTNER)).status_code == 404
    assert client.get(f"/v1/partner/{new}", headers=auth(PARTNER)).status_code == 200


def test_limits_and_self(client):
    setup_owner(client)
    send_update(client, shared(OWNER))
    assert "себя" in client.bot.sent()[-1]["text"]
    # бесплатно — один партнёр, в Код Тела+ — до трёх
    invite(client, 1)
    send_update(client, shared(2))
    assert "Код Тела+" in client.bot.sent()[-1]["text"]
    assert client.get("/v1/partners", headers=auth(OWNER)).json()["max"] == 1


def test_pregnancy_mode_shows_weeks_only(client):
    setup_owner(client)
    lmp = (date.today() - timedelta(days=75)).isoformat()
    put(client, "mode", {"kind": "pregnancy", "pregnancyLmp": lmp})
    token = invite(client)
    v = client.get(f"/v1/partner/{token}", headers=auth(PARTNER)).json()
    assert v["pregnancy"] == {"week": 10, "day": 5} and "cycle" not in v


def test_owner_deletion_removes_grants(client):
    setup_owner(client)
    token = invite(client)
    client.delete("/v1/me", headers=auth(OWNER))
    assert client.get(f"/v1/partner/{token}", headers=auth(PARTNER)).status_code == 404
