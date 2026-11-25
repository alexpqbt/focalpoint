"""Server side of the Viewers List (CASE-031 to CASE-035, CASE-047).

GET /participants and POST /participants/{identity}/remove, with the LiveKit API faked.
Place in server/tests/. Run from the project root:
    uv run --project server pytest server/tests/test_participants_endpoints.py
"""
from types import SimpleNamespace

import pytest

import log_session
import main
from conftest import bearer


class FakeLiveKit:
    """Stands in for `async with api.LiveKitAPI(...) as lkapi`."""

    def __init__(self, participants=(), remove_error=None):
        self.participants = list(participants)
        self.remove_error = remove_error
        self.list_requests = []
        self.remove_requests = []
        self.room = SimpleNamespace(list_participants=self._list, remove_participant=self._remove)

    async def _list(self, request):
        self.list_requests.append(request)
        return SimpleNamespace(participants=self.participants)

    async def _remove(self, request):
        if self.remove_error:
            raise self.remove_error
        self.remove_requests.append(request)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


def lk_person(identity, name, attributes=None, joined_at=1700000000):
    return SimpleNamespace(
        identity=identity, name=name, joined_at=joined_at, attributes=attributes or {}
    )


@pytest.fixture(autouse=True)
def clean_log():
    log_session.reset()
    yield
    log_session.reset()


@pytest.fixture
def livekit(monkeypatch):
    def install(**kwargs):
        fake = FakeLiveKit(**kwargs)
        monkeypatch.setattr(main.api, "LiveKitAPI", lambda *a, **k: fake)
        return fake

    return install


# ---------------------------------------------------------------------------
# GET /participants
# ---------------------------------------------------------------------------
class TestListParticipants:
    def test_empty_room_returns_zero_and_an_empty_list(self, client, livekit):
        livekit()

        r = client.get("/participants", headers=bearer())

        assert r.status_code == 200
        assert r.json() == {"count": 0, "participants": []}

    def test_returns_count_and_each_participants_details(self, client, livekit):
        livekit(
            participants=[
                lk_person("s1", "Ana Cruz", {"First Name": "Ana", "Last Name": "Cruz"}),
                lk_person("s2", "Ben Diaz", joined_at=1700000050),
            ]
        )

        body = client.get("/participants", headers=bearer()).json()

        assert body["count"] == 2
        assert body["participants"] == [
            {
                "identity": "s1",
                "name": "Ana Cruz",
                "joined_at": 1700000000,
                "attributes": {"First Name": "Ana", "Last Name": "Cruz"},
            },
            {"identity": "s2", "name": "Ben Diaz", "joined_at": 1700000050, "attributes": {}},
        ]

    def test_asks_livekit_for_the_configured_room(self, client, livekit):
        fake = livekit()

        client.get("/participants", headers=bearer())

        assert len(fake.list_requests) == 1
        assert fake.list_requests[0].room == main.ROOM_NAME

    def test_the_presenter_is_not_counted_as_a_viewer(self, client, livekit):
        livekit(participants=[lk_person("presenter", "presenter"), lk_person("s1", "Ana")])

        body = client.get("/participants", headers=bearer()).json()

        assert body["count"] == 1
        assert [p["identity"] for p in body["participants"]] == ["s1"]

    def test_only_a_participant_with_both_identity_and_name_presenter_is_hidden(self, client, livekit):
        # Characterises the current filter: `identity != 'presenter' or name != 'presenter'`.
        livekit(participants=[lk_person("presenter", "Not The Host")])

        assert client.get("/participants", headers=bearer()).json()["count"] == 1

    def test_each_poll_records_joins_and_leaves_in_the_session_log(self, client, livekit):
        fake = livekit(participants=[lk_person("s1", "Ana"), lk_person("s2", "Ben")])
        client.get("/participants", headers=bearer())
        assert sorted(e["identity"] for e in log_session.event_log if e["event"] == "joined") == ["s1", "s2"]

        fake.participants = [lk_person("s2", "Ben")]
        client.get("/participants", headers=bearer())

        left = [e for e in log_session.event_log if e["event"] == "left"]
        assert [e["identity"] for e in left] == ["s1"]
        assert left[0]["name"] == "Ana"

    def test_polling_an_unchanged_room_adds_no_log_events(self, client, livekit):
        livekit(participants=[lk_person("s1", "Ana")])

        client.get("/participants", headers=bearer())
        client.get("/participants", headers=bearer())

        assert len(log_session.event_log) == 1

    def test_requires_an_authorization_header(self, client, livekit):
        livekit()
        assert client.get("/participants").status_code == 422

    def test_rejects_a_token_without_room_admin(self, client, livekit):
        livekit()
        assert client.get("/participants", headers=bearer(admin=False)).status_code == 403

    def test_rejects_an_invalid_token(self, client, livekit):
        livekit()
        r = client.get("/participants", headers={"Authorization": "Bearer nope"})
        assert r.status_code == 401

    def test_rejects_a_non_bearer_scheme(self, client, livekit):
        livekit()
        r = client.get("/participants", headers={"Authorization": "Basic abc"})
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# POST /participants/{identity}/remove
# ---------------------------------------------------------------------------
class TestRemoveParticipant:
    def test_removes_the_participant_from_the_room(self, client, livekit):
        fake = livekit()

        r = client.post("/participants/s1/remove", headers=bearer())

        assert r.status_code == 200
        assert r.json() == {"status": "removed", "identity": "s1"}
        assert len(fake.remove_requests) == 1
        assert fake.remove_requests[0].room == main.ROOM_NAME
        assert fake.remove_requests[0].identity == "s1"

    def test_returns_404_with_the_reason_when_livekit_refuses(self, client, livekit):
        livekit(remove_error=RuntimeError("participant not found"))

        r = client.post("/participants/ghost/remove", headers=bearer())

        assert r.status_code == 404
        assert r.json()["detail"] == "participant not found"

    def test_requires_an_authorization_header(self, client, livekit):
        livekit()
        assert client.post("/participants/s1/remove").status_code == 422

    def test_rejects_a_token_without_room_admin(self, client, livekit):
        fake = livekit()

        r = client.post("/participants/s1/remove", headers=bearer(admin=False))

        assert r.status_code == 403
        assert fake.remove_requests == []

    def test_rejects_an_invalid_token(self, client, livekit):
        fake = livekit()

        r = client.post("/participants/s1/remove", headers={"Authorization": "Bearer nope"})

        assert r.status_code == 401
        assert fake.remove_requests == []