"""Unit tests for POST/GET /rooms in main.py (CASE-012 to CASE-017, CASE-029).
Uses a real SQLite database in a temp folder (see the `real_db` fixture)."""
import pytest

from conftest import LOCAL, REMOTE

FIELDS = [
    {"name": "Section", "value": "BSIT 4C"},
    {"name": "Subject", "value": "IT-ELEC 3"},
]


def payload(**overrides):
    body = {"room_size": "30", "fields": FIELDS, "user_inputs": ["First Name", "Last Name"]}
    body.update(overrides)
    return body


@pytest.fixture(autouse=True)
def _db(real_db):
    return real_db


class TestCreateRoom:
    # CASE-012
    def test_creates_a_room_with_a_valid_size(self, client):
        res = client.post("/rooms", json=payload(), headers=LOCAL)

        assert res.status_code == 200
        assert res.json() == {
            "id": 1,
            "label": "Room 1",
            "roomSize": "30",
            "fields": FIELDS,
            "userInputs": ["First Name", "Last Name"],
        }

    @pytest.mark.parametrize("size", ["1", "30", "50"])
    def test_accepts_sizes_inside_the_limit(self, client, size):
        res = client.post("/rooms", json=payload(room_size=size), headers=LOCAL)
        assert res.status_code == 200
        assert res.json()["roomSize"] == size

    def test_trims_whitespace_around_the_size(self, client):
        res = client.post("/rooms", json=payload(room_size=" 25 "), headers=LOCAL)
        assert res.status_code == 200
        assert res.json()["roomSize"] == "25"

    # CASE-013
    @pytest.mark.parametrize("size", ["51", "100", "0"])
    def test_rejects_sizes_outside_the_limit(self, client, size):
        res = client.post("/rooms", json=payload(room_size=size), headers=LOCAL)

        assert res.status_code == 400
        assert res.json()["detail"] == "Room size must be a number from 1 to 50"
        assert client.get("/rooms", headers=LOCAL).json() == []

    # CASE-014
    @pytest.mark.parametrize("size", ["abc", "12abc", "-5", "3.5", "1e2", "5 0"])
    def test_rejects_non_numeric_sizes(self, client, size):
        res = client.post("/rooms", json=payload(room_size=size), headers=LOCAL)

        assert res.status_code == 400
        assert res.json()["detail"] == "Room size must be a number from 1 to 50"
        assert client.get("/rooms", headers=LOCAL).json() == []

    # CASE-015
    @pytest.mark.parametrize("size", ["", "   "])
    def test_empty_size_string_falls_back_to_the_default(self, client, size):
        res = client.post("/rooms", json=payload(room_size=size), headers=LOCAL)

        assert res.status_code == 200
        assert res.json()["roomSize"] == "50"

    def test_missing_size_uses_the_default(self, client):
        body = payload()
        del body["room_size"]

        res = client.post("/rooms", json=body, headers=LOCAL)

        assert res.status_code == 200
        assert res.json()["roomSize"] == "50"

    # KNOWN DEFECT (see Rooms.customize.test.jsx): the frontend sends the number 50 when
    # the size input is empty. RoomIn.room_size is `str`, and Pydantic v2 does not coerce
    # int to str, so the request is rejected and the room is not saved.
    def test_numeric_size_in_json_is_rejected_by_the_model(self, client):
        res = client.post("/rooms", json=payload(room_size=50), headers=LOCAL)

        assert res.status_code == 422
        assert client.get("/rooms", headers=LOCAL).json() == []

    # CASE-016 / CASE-017 / CASE-029 / CASE-030
    def test_trims_field_names_and_values(self, client):
        fields = [{"name": "  Section  ", "value": "  BSIT 4C "}]
        res = client.post("/rooms", json=payload(fields=fields), headers=LOCAL)

        assert res.json()["fields"] == [{"name": "Section", "value": "BSIT 4C"}]

    def test_keeps_a_field_with_an_empty_value(self, client):
        fields = [{"name": "Section", "value": ""}, {"name": "Subject"}]
        res = client.post("/rooms", json=payload(fields=fields), headers=LOCAL)

        assert res.status_code == 200
        assert res.json()["fields"] == [
            {"name": "Section", "value": ""},
            {"name": "Subject", "value": ""},
        ]

    def test_drops_fields_without_a_name(self, client):
        fields = [{"name": "   ", "value": "x"}, {"name": "Section", "value": "A"}]
        res = client.post("/rooms", json=payload(fields=fields), headers=LOCAL)

        assert res.json()["fields"] == [{"name": "Section", "value": "A"}]

    def test_accepts_exactly_six_fields(self, client):
        fields = [{"name": f"F{i}", "value": ""} for i in range(6)]
        assert client.post("/rooms", json=payload(fields=fields), headers=LOCAL).status_code == 200

    def test_rejects_more_than_six_fields(self, client):
        fields = [{"name": f"F{i}", "value": ""} for i in range(7)]
        res = client.post("/rooms", json=payload(fields=fields), headers=LOCAL)

        assert res.status_code == 400
        assert res.json()["detail"] == "Max 6 fields; names 30 characters, values 50"

    @pytest.mark.parametrize(
        "field",
        [
            {"name": "n" * 31, "value": ""},
            {"name": "ok", "value": "v" * 51},
        ],
    )
    def test_rejects_overlong_field_names_and_values(self, client, field):
        res = client.post("/rooms", json=payload(fields=[field]), headers=LOCAL)
        assert res.status_code == 400

    def test_accepts_field_limits_exactly(self, client):
        field = {"name": "n" * 30, "value": "v" * 50}
        assert client.post("/rooms", json=payload(fields=[field]), headers=LOCAL).status_code == 200

    def test_rejects_duplicate_field_names_ignoring_case(self, client):
        fields = [{"name": "Section", "value": ""}, {"name": "section", "value": ""}]
        res = client.post("/rooms", json=payload(fields=fields), headers=LOCAL)

        assert res.status_code == 400
        assert res.json()["detail"] == "Duplicate field names"

    # User inputs (CASE-019, CASE-020)
    def test_drops_blank_user_inputs_and_trims_the_rest(self, client):
        res = client.post("/rooms", json=payload(user_inputs=[" Name ", "", "  "]), headers=LOCAL)
        assert res.json()["userInputs"] == ["Name"]

    def test_accepts_no_user_inputs(self, client):
        res = client.post("/rooms", json=payload(user_inputs=[]), headers=LOCAL)
        assert res.status_code == 200
        assert res.json()["userInputs"] == []

    def test_accepts_five_user_inputs_and_rejects_six(self, client):
        five = [f"Input {i}" for i in range(5)]
        assert client.post("/rooms", json=payload(user_inputs=five), headers=LOCAL).status_code == 200

        res = client.post("/rooms", json=payload(user_inputs=five + ["Input 5"]), headers=LOCAL)
        assert res.status_code == 400
        assert res.json()["detail"] == "Max 5 inputs, 30 characters each"

    def test_rejects_overlong_user_inputs(self, client):
        res = client.post("/rooms", json=payload(user_inputs=["x" * 31]), headers=LOCAL)
        assert res.status_code == 400

    def test_rejects_duplicate_user_inputs_ignoring_case(self, client):
        res = client.post("/rooms", json=payload(user_inputs=["Name", "NAME"]), headers=LOCAL)
        assert res.status_code == 400
        assert res.json()["detail"] == "Duplicate user inputs"

    def test_rejects_non_local_clients(self, client):
        res = client.post("/rooms", json=payload(), headers=REMOTE)

        assert res.status_code == 403
        assert client.get("/rooms", headers=LOCAL).json() == []

    def test_assigns_sequential_ids_and_labels(self, client):
        first = client.post("/rooms", json=payload(), headers=LOCAL).json()
        second = client.post("/rooms", json=payload(), headers=LOCAL).json()

        assert (first["id"], first["label"]) == (1, "Room 1")
        assert (second["id"], second["label"]) == (2, "Room 2")


class TestListRooms:
    # CASE-028 (data side)
    def test_returns_an_empty_list_when_no_rooms_exist(self, client):
        res = client.get("/rooms", headers=LOCAL)
        assert res.status_code == 200
        assert res.json() == []

    def test_returns_saved_rooms_in_creation_order(self, client):
        client.post("/rooms", json=payload(room_size="10"), headers=LOCAL)
        client.post("/rooms", json=payload(room_size="20"), headers=LOCAL)

        rooms = client.get("/rooms", headers=LOCAL).json()

        assert [r["roomSize"] for r in rooms] == ["10", "20"]
        assert [r["label"] for r in rooms] == ["Room 1", "Room 2"]

    def test_rejects_non_local_clients(self, client):
        assert client.get("/rooms", headers=REMOTE).status_code == 403