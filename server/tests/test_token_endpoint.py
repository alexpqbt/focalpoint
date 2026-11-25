"""GET /token: viewer join (CASE-045 to CASE-047, server side) and presenter access.

Place in server/tests/. Run from the project root:
    uv run --project server pytest server/tests/test_token_endpoint.py
"""
import json

import pytest
from livekit import api

import main
from conftest import LOCAL, REMOTE


def claims_of(token: str):
    return api.TokenVerifier(main.API_KEY, main.API_SECRET).verify(token)


def get_token(client, headers=None, **params):
    return client.get("/token", params=params, headers=headers or {})


@pytest.fixture
def two_inputs(monkeypatch):
    monkeypatch.setitem(main.room_config, "user_inputs", ["First Name", "Last Name"])


# ---------------------------------------------------------------------------
class TestStudentToken:
    def test_defaults_to_a_student_guest(self, client):
        r = client.get("/token")

        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/plain")
        claims = claims_of(r.text)
        assert claims.identity == "student-guest"
        assert claims.name == "student-guest"

    def test_uses_the_given_identity_and_name(self, client):
        claims = claims_of(get_token(client, identity="student-abc", name="Ana Cruz").text)

        assert claims.identity == "student-abc"
        assert claims.name == "Ana Cruz"

    def test_name_defaults_to_the_identity_when_empty(self, client):
        claims = claims_of(get_token(client, identity="student-abc", name="").text)

        assert claims.name == "student-abc"

    def test_student_can_join_and_subscribe_but_not_publish_or_administer(self, client):
        video = claims_of(get_token(client, role="student", identity="s1").text).video

        assert video.room_join is True
        assert video.room == main.ROOM_NAME
        assert video.can_subscribe is True
        assert not video.can_publish
        assert not video.room_admin

    def test_students_are_not_restricted_to_localhost(self, client):
        r = get_token(client, headers=REMOTE, role="student", identity="s1")

        assert r.status_code == 200

    def test_a_student_token_cannot_call_admin_endpoints(self, client):
        token = get_token(client, role="student", identity="s1").text

        r = client.get("/logs/export", headers={"Authorization": f"Bearer {token}"})

        assert r.status_code == 403


class TestStudentAnswers:
    def test_answers_for_configured_labels_become_token_attributes(self, client, two_inputs):
        answers = json.dumps({"First Name": "Ana", "Last Name": "Cruz"})

        claims = claims_of(get_token(client, identity="s1", name="Ana Cruz", answers=answers).text)

        assert claims.attributes == {"First Name": "Ana", "Last Name": "Cruz"}

    def test_values_are_trimmed(self, client, two_inputs):
        answers = json.dumps({"First Name": "  Ana ", "Last Name": " Cruz"})

        claims = claims_of(get_token(client, identity="s1", answers=answers).text)

        assert claims.attributes == {"First Name": "Ana", "Last Name": "Cruz"}

    def test_labels_that_are_not_configured_are_ignored(self, client, two_inputs):
        answers = json.dumps({"First Name": "Ana", "Favorite Color": "blue"})

        claims = claims_of(get_token(client, identity="s1", answers=answers).text)

        assert claims.attributes == {"First Name": "Ana"}

    def test_blank_and_non_text_values_are_skipped(self, client, two_inputs):
        answers = json.dumps({"First Name": "   ", "Last Name": 123})

        claims = claims_of(get_token(client, identity="s1", answers=answers).text)

        assert not claims.attributes

    def test_values_are_cut_to_50_characters(self, client, two_inputs):
        answers = json.dumps({"First Name": "A" * 80})

        claims = claims_of(get_token(client, identity="s1", answers=answers).text)

        assert claims.attributes == {"First Name": "A" * 50}

    def test_no_answers_means_no_attributes(self, client, two_inputs):
        claims = claims_of(get_token(client, identity="s1").text)

        assert not claims.attributes

    def test_answers_are_ignored_when_the_room_has_no_user_inputs(self, client):
        answers = json.dumps({"First Name": "Ana"})

        claims = claims_of(get_token(client, identity="s1", answers=answers).text)

        assert not claims.attributes

    def test_invalid_json_is_rejected(self, client, two_inputs):
        r = get_token(client, identity="s1", answers="{not json")

        assert r.status_code == 400
        assert r.json()["detail"] == "answers must be valid JSON"

    @pytest.mark.parametrize("payload", ["[]", '"text"', "42", "null"])
    def test_answers_that_are_not_an_object_are_rejected(self, client, two_inputs, payload):
        r = get_token(client, identity="s1", answers=payload)

        assert r.status_code == 400
        assert r.json()["detail"] == "answers must be an object"


# ---------------------------------------------------------------------------
class TestPresenterToken:
    def test_presenter_on_the_host_machine_gets_publish_and_admin_rights(self, client):
        r = get_token(client, headers=LOCAL, role="presenter", identity="presenter")

        assert r.status_code == 200
        video = claims_of(r.text).video
        assert video.can_publish is True
        assert video.room_admin is True
        assert video.room_join is True

    def test_ipv6_loopback_counts_as_the_host_machine(self, client):
        r = get_token(client, headers={"x-real-ip": "::1"}, role="presenter", identity="presenter")

        assert r.status_code == 200

    def test_presenter_from_another_machine_is_refused(self, client):
        r = get_token(client, headers=REMOTE, role="presenter", identity="presenter")

        assert r.status_code == 403
        assert r.json()["detail"] == "Presenter access is restricted to this machine"

    def test_presenter_with_no_forwarded_ip_falls_back_to_the_socket_address(self, client):
        # TestClient connects from "testclient", not loopback, so this is refused.
        r = get_token(client, role="presenter", identity="presenter")

        assert r.status_code == 403

    def test_presenter_token_ignores_answers(self, client, two_inputs):
        answers = json.dumps({"First Name": "Ana"})

        r = get_token(client, headers=LOCAL, role="presenter", identity="presenter", answers=answers)

        assert not claims_of(r.text).attributes