"""Server side of CASE-029 and CASE-030 (add / remove a field, save, share).

Place in server/tests/. Run from the project root:
    uv run --project server pytest server/tests/test_room_flow.py

Two different things can be "added" in the customize form:
  * Add Field      -> session field. It becomes a log column and is repeated on every row.
  * User Inputs +  -> input label. This is what the viewer join form shows.
"""
import json

import pytest
from livekit import api

import log_session
import main
from conftest import LOCAL


@pytest.fixture(autouse=True)
def clean_log():
    log_session.reset()
    yield
    log_session.reset()


BASE_ROOM = {
    "room_size": "30",
    "fields": [{"name": "Section", "value": "BSIT 4C"}, {"name": "Subject", "value": "Math"}],
    "user_inputs": ["First Name", "Last Name"],
}


def share(client, room):
    """What Rooms.handleShareScreen posts when the host clicks Share Screen."""
    body = {
        "user_inputs": room["userInputs"],
        "fields": room["fields"],
        "room_size": int(room["roomSize"]),
    }
    r = client.post("/room-config", json=body, headers=LOCAL)
    assert r.status_code == 200
    return r.json()


def student_attributes(client, answers):
    token = client.get(
        "/token",
        params={"role": "student", "identity": "s1", "name": "Ana", "answers": json.dumps(answers)},
    ).text
    return api.TokenVerifier(main.API_KEY, main.API_SECRET).verify(token).attributes


class TestAddFieldAndSave:
    def test_new_field_is_stored_listed_and_returned_by_the_server(self, client, real_db):
        room = {**BASE_ROOM, "fields": [*BASE_ROOM["fields"], {"name": "Instructor", "value": "Cruz"}]}

        created = client.post("/rooms", json=room, headers=LOCAL)

        assert created.status_code == 200
        assert created.json()["fields"][-1] == {"name": "Instructor", "value": "Cruz"}
        listed = client.get("/rooms", headers=LOCAL).json()
        assert listed[0]["fields"][-1] == {"name": "Instructor", "value": "Cruz"}

    def test_new_field_becomes_a_log_column_after_the_room_is_shared(self, client, real_db):
        room = client.post(
            "/rooms",
            json={**BASE_ROOM, "fields": [*BASE_ROOM["fields"], {"name": "Instructor", "value": "Cruz"}]},
            headers=LOCAL,
        ).json()

        share(client, room)

        assert client.get("/room-config").json()["fields"][-1] == {"name": "Instructor", "value": "Cruz"}
        snap = client.get("/logs/snapshot", headers=LOCAL).json()
        assert snap["columns"][-1] == "Instructor"
        assert snap["field_values"][-1] == "Cruz"

    def test_new_user_input_is_what_the_join_form_reads_and_the_token_keeps(self, client, real_db):
        room = client.post(
            "/rooms",
            json={**BASE_ROOM, "user_inputs": [*BASE_ROOM["user_inputs"], "Student ID"]},
            headers=LOCAL,
        ).json()

        share(client, room)

        assert client.get("/room-config").json()["user_inputs"] == ["First Name", "Last Name", "Student ID"]
        attrs = student_attributes(
            client, {"First Name": "Ana", "Last Name": "Cruz", "Student ID": "2024-001"}
        )
        assert attrs == {"First Name": "Ana", "Last Name": "Cruz", "Student ID": "2024-001"}

    def test_editing_an_existing_room_keeps_its_id_and_stores_the_new_field(self, client, real_db):
        room = client.post("/rooms", json=BASE_ROOM, headers=LOCAL).json()

        updated = client.put(
            f"/rooms/{room['id']}",
            json={**BASE_ROOM, "fields": [*BASE_ROOM["fields"], {"name": "Instructor", "value": ""}]},
            headers=LOCAL,
        ).json()

        assert updated["id"] == room["id"]
        assert [f["name"] for f in updated["fields"]] == ["Section", "Subject", "Instructor"]


class TestRemoveFieldAndSave:
    def test_removed_field_is_gone_from_the_stored_room(self, client, real_db):
        room = client.post("/rooms", json=BASE_ROOM, headers=LOCAL).json()

        updated = client.put(
            f"/rooms/{room['id']}",
            json={**BASE_ROOM, "fields": [BASE_ROOM["fields"][0]]},
            headers=LOCAL,
        )

        assert updated.status_code == 200
        assert updated.json()["fields"] == [{"name": "Section", "value": "BSIT 4C"}]
        assert client.get("/rooms", headers=LOCAL).json()[0]["fields"] == [
            {"name": "Section", "value": "BSIT 4C"}
        ]

    def test_removed_field_is_no_longer_a_log_column_after_sharing(self, client, real_db):
        room = client.post("/rooms", json=BASE_ROOM, headers=LOCAL).json()
        room = client.put(
            f"/rooms/{room['id']}", json={**BASE_ROOM, "fields": [BASE_ROOM["fields"][0]]}, headers=LOCAL
        ).json()

        share(client, room)

        snap = client.get("/logs/snapshot", headers=LOCAL).json()
        assert "Subject" not in snap["columns"]
        assert snap["columns"][-1] == "Section"
        assert snap["field_values"] == ["BSIT 4C"]

    def test_removed_user_input_is_dropped_from_the_join_form_and_the_token(self, client, real_db):
        room = client.post("/rooms", json=BASE_ROOM, headers=LOCAL).json()
        room = client.put(
            f"/rooms/{room['id']}", json={**BASE_ROOM, "user_inputs": ["First Name"]}, headers=LOCAL
        ).json()

        share(client, room)

        assert client.get("/room-config").json()["user_inputs"] == ["First Name"]
        attrs = student_attributes(client, {"First Name": "Ana", "Last Name": "Cruz"})
        assert attrs == {"First Name": "Ana"}  # the removed label's answer is ignored

    def test_removing_every_field_leaves_an_empty_field_list(self, client, real_db):
        room = client.post("/rooms", json=BASE_ROOM, headers=LOCAL).json()

        updated = client.put(f"/rooms/{room['id']}", json={**BASE_ROOM, "fields": []}, headers=LOCAL).json()
        share(client, updated)

        assert updated["fields"] == []
        assert client.get("/room-config").json()["fields"] == []
        assert client.get("/logs/snapshot", headers=LOCAL).json()["columns"][-1] == "Last Name"