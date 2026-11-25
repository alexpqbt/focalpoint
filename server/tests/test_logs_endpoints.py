"""Unit tests for the log endpoints in main.py (CASE-009, CASE-010, CASE-011 and the
End Session flow). log_session and db are replaced with fakes."""
import pytest

import main
from conftest import LOCAL, REMOTE, bearer

COLUMNS = ["Date", "Time Stamp", "Status", "First Name"]
ROWS = [["2026-10-03", "10:00:00", "Entered", "Ana"]]


def table(**overrides):
    body = {"columns": COLUMNS, "rows": ROWS, "field_count": 0, "max_size": None}
    body.update(overrides)
    return body


# ---------------------------------------------------------------------------
# GET /logs/export  (bearer, room_admin)
# ---------------------------------------------------------------------------
class TestExportLogs:
    def test_csv_download(self, client, fake_log_session):
        main.room_config["user_inputs"] = ["First Name"]
        main.room_config["fields"] = [{"name": "Section", "value": "BSIT 4C"}]

        res = client.get("/logs/export?format=csv", headers=bearer())

        assert res.status_code == 200
        assert res.headers["content-type"].startswith("text/csv")
        assert res.headers["content-disposition"] == "attachment; filename=log_session.csv"
        assert res.content == b"csv-bytes"
        args, _ = fake_log_session["to_csv_bytes"][0]
        assert args == (["First Name"], [{"name": "Section", "value": "BSIT 4C"}])

    def test_csv_is_the_default_format(self, client, fake_log_session):
        res = client.get("/logs/export", headers=bearer())
        assert res.status_code == 200
        assert res.headers["content-type"].startswith("text/csv")

    def test_pdf_download(self, client, fake_log_session):
        main.room_config["user_inputs"] = ["First Name"]
        main.room_config["room_size"] = 30

        res = client.get("/logs/export?format=pdf", headers=bearer())

        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert res.headers["content-disposition"] == "attachment; filename=log_session.pdf"
        assert res.content == b"%PDF-bytes"
        args, _ = fake_log_session["to_pdf_bytes"][0]
        assert args == (["First Name"], [], 30)

    def test_unknown_format_is_rejected(self, client, fake_log_session):
        res = client.get("/logs/export?format=xlsx", headers=bearer())
        assert res.status_code == 400
        assert res.json()["detail"] == "format must be csv or pdf"

    def test_requires_authorization_header(self, client, fake_log_session):
        assert client.get("/logs/export").status_code == 422

    def test_rejects_non_bearer_authorization(self, client, fake_log_session):
        res = client.get("/logs/export", headers={"Authorization": "Basic abc"})
        assert res.status_code == 401
        assert res.json()["detail"] == "Missing bearer token"

    def test_rejects_invalid_token(self, client, fake_log_session):
        res = client.get("/logs/export", headers={"Authorization": "Bearer not-a-jwt"})
        assert res.status_code == 401
        assert res.json()["detail"] == "Invalid token"

    def test_rejects_non_admin_token(self, client, fake_log_session):
        res = client.get("/logs/export", headers=bearer(admin=False))
        assert res.status_code == 403
        assert res.json()["detail"] == "roomAdmin grant required"


# ---------------------------------------------------------------------------
# POST /logs/reset  (bearer, room_admin)
# ---------------------------------------------------------------------------
class TestResetLogs:
    def test_resets_the_session_log(self, client, fake_log_session):
        res = client.post("/logs/reset", headers=bearer())

        assert res.status_code == 200
        assert res.json() == {"status": "reset"}
        assert len(fake_log_session["reset"]) == 1

    def test_requires_admin(self, client, fake_log_session):
        assert client.post("/logs/reset", headers=bearer(admin=False)).status_code == 403
        assert "reset" not in fake_log_session


# ---------------------------------------------------------------------------
# GET /logs/snapshot  (localhost)
# ---------------------------------------------------------------------------
class TestSnapshot:
    def test_returns_snapshot_with_room_size(self, client, fake_log_session):
        main.room_config["user_inputs"] = ["Name"]
        main.room_config["fields"] = [{"name": "Section", "value": "A"}]
        main.room_config["room_size"] = 25

        res = client.get("/logs/snapshot", headers=LOCAL)

        assert res.status_code == 200
        body = res.json()
        assert body["rows"] == [["2026-10-03", "10:00:00", "Entered", "Ana"]]
        assert body["field_values"] == ["BSIT 4C"]
        assert body["max_size"] == 25
        args, _ = fake_log_session["snapshot"][0]
        assert args == (["Name"], [{"name": "Section", "value": "A"}])

    def test_max_size_is_null_when_no_room_size_was_set(self, client, fake_log_session):
        assert client.get("/logs/snapshot", headers=LOCAL).json()["max_size"] is None

    def test_rejects_non_local_clients(self, client, fake_log_session):
        res = client.get("/logs/snapshot", headers=REMOTE)
        assert res.status_code == 403
        assert res.json()["detail"] == "Host access is restricted to this machine"


# ---------------------------------------------------------------------------
# POST /logs/render  (localhost)  : CASE-009 (PDF) and CASE-010 (CSV)
# ---------------------------------------------------------------------------
class TestRenderLogs:
    def test_csv(self, client, fake_log_session):
        res = client.post("/logs/render?format=csv", json=table(), headers=LOCAL)

        assert res.status_code == 200
        assert res.headers["content-type"].startswith("text/csv")
        assert res.headers["content-disposition"] == "attachment; filename=log_session.csv"
        assert res.content == b"a,b\n1,2\n"
        args, _ = fake_log_session["csv_from_table"][0]
        assert args == (COLUMNS, ROWS)

    def test_csv_is_the_default_format(self, client, fake_log_session):
        res = client.post("/logs/render", json=table(), headers=LOCAL)
        assert res.status_code == 200
        assert "csv_from_table" in fake_log_session

    def test_pdf(self, client, fake_log_session):
        res = client.post(
            "/logs/render?format=pdf", json=table(field_count=2, max_size=30), headers=LOCAL
        )

        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert res.headers["content-disposition"] == "attachment; filename=log_session.pdf"
        assert res.content == b"%PDF-table"
        args, _ = fake_log_session["pdf_from_table"][0]
        assert args == (COLUMNS, ROWS, 2, 30)

    def test_pdf_accepts_boundary_values(self, client, fake_log_session):
        for field_count, max_size in [(0, 1), (6, 50), (3, None)]:
            res = client.post(
                "/logs/render?format=pdf",
                json=table(field_count=field_count, max_size=max_size),
                headers=LOCAL,
            )
            assert res.status_code == 200, (field_count, max_size)

    def test_csv_with_no_rows(self, client, fake_log_session):
        res = client.post("/logs/render?format=csv", json=table(rows=[]), headers=LOCAL)
        assert res.status_code == 200

    @pytest.mark.parametrize(
        "overrides, detail",
        [
            ({"columns": ["c"] * 3}, "PDF needs at least 4 columns"),
            ({"field_count": 7}, "field_count must be 0 to 6"),
            ({"field_count": -1}, "field_count must be 0 to 6"),
            ({"max_size": 0}, "max_size must be 1 to 50"),
            ({"max_size": 51}, "max_size must be 1 to 50"),
        ],
    )
    def test_pdf_validation(self, client, fake_log_session, overrides, detail):
        body = table(rows=[], **overrides)
        res = client.post("/logs/render?format=pdf", json=body, headers=LOCAL)

        assert res.status_code == 400
        assert res.json()["detail"] == detail
        assert "pdf_from_table" not in fake_log_session

    def test_too_many_columns(self, client, fake_log_session):
        body = table(columns=[f"c{i}" for i in range(21)], rows=[])
        res = client.post("/logs/render?format=csv", json=body, headers=LOCAL)
        assert res.status_code == 400
        assert res.json()["detail"] == "Table too large"

    def test_too_many_rows(self, client, fake_log_session):
        body = table(columns=["c"], rows=[["x"]] * 5001)
        res = client.post("/logs/render?format=csv", json=body, headers=LOCAL)
        assert res.status_code == 400
        assert res.json()["detail"] == "Table too large"

    def test_row_length_must_match_columns(self, client, fake_log_session):
        body = table(rows=[["only-one-cell"]])
        res = client.post("/logs/render?format=csv", json=body, headers=LOCAL)
        assert res.status_code == 400
        assert res.json()["detail"] == "Row length does not match columns"

    def test_unknown_format(self, client, fake_log_session):
        res = client.post("/logs/render?format=docx", json=table(), headers=LOCAL)
        assert res.status_code == 400
        assert res.json()["detail"] == "format must be csv or pdf"

    def test_invalid_body_is_rejected(self, client, fake_log_session):
        res = client.post("/logs/render?format=csv", json={"columns": "nope"}, headers=LOCAL)
        assert res.status_code == 422

    def test_rejects_non_local_clients(self, client, fake_log_session):
        res = client.post("/logs/render?format=csv", json=table(), headers=REMOTE)
        assert res.status_code == 403
        assert "csv_from_table" not in fake_log_session


# ---------------------------------------------------------------------------
# POST/GET /logs/saved  (localhost): CASE-011 (empty list) and saving at End Session
# ---------------------------------------------------------------------------
class TestSavedLogs:
    @pytest.fixture
    def fake_db(self, monkeypatch):
        calls = {"save_log": [], "list_logs": 0}

        def save_log(columns, rows, field_values, max_size):
            calls["save_log"].append((columns, rows, field_values, max_size))
            return {"id": 1, "label": "Oct 3, 2026", "maxSize": max_size}

        def list_logs():
            calls["list_logs"] += 1
            return calls.get("stored", [])

        monkeypatch.setattr(main.db, "save_log", save_log)
        monkeypatch.setattr(main.db, "list_logs", list_logs)
        return calls

    def test_get_returns_an_empty_list_when_nothing_is_saved(self, client, fake_db):
        res = client.get("/logs/saved", headers=LOCAL)

        assert res.status_code == 200
        assert res.json() == []
        assert fake_db["list_logs"] == 1

    def test_get_returns_stored_logs(self, client, fake_db):
        fake_db["stored"] = [{"id": 1, "label": "Oct 3, 2026"}]
        assert client.get("/logs/saved", headers=LOCAL).json() == [{"id": 1, "label": "Oct 3, 2026"}]

    def test_get_rejects_non_local_clients(self, client, fake_db):
        assert client.get("/logs/saved", headers=REMOTE).status_code == 403
        assert fake_db["list_logs"] == 0

    def test_post_saves_a_log(self, client, fake_db):
        body = {"columns": COLUMNS, "rows": ROWS, "field_values": ["BSIT 4C"], "max_size": 30}

        res = client.post("/logs/saved", json=body, headers=LOCAL)

        assert res.status_code == 200
        assert res.json() == {
            "saved": True,
            "entry": {"id": 1, "label": "Oct 3, 2026", "maxSize": 30},
        }
        assert fake_db["save_log"] == [(COLUMNS, ROWS, ["BSIT 4C"], 30)]

    def test_post_falls_back_to_the_session_room_size(self, client, fake_db):
        main.room_config["room_size"] = 12

        client.post("/logs/saved", json={"columns": COLUMNS, "rows": ROWS}, headers=LOCAL)

        assert fake_db["save_log"][0] == (COLUMNS, ROWS, [], 12)

    def test_post_with_no_rows_is_not_saved(self, client, fake_db):
        res = client.post("/logs/saved", json={"columns": COLUMNS, "rows": []}, headers=LOCAL)

        assert res.status_code == 200
        assert res.json() == {"saved": False}
        assert fake_db["save_log"] == []

    @pytest.mark.parametrize("max_size", [0, 51])
    def test_post_rejects_invalid_max_size(self, client, fake_db, max_size):
        body = {"columns": COLUMNS, "rows": ROWS, "max_size": max_size}
        res = client.post("/logs/saved", json=body, headers=LOCAL)
        assert res.status_code == 400
        assert res.json()["detail"] == "max_size must be 1 to 50"
        assert fake_db["save_log"] == []

    def test_post_rejects_row_length_mismatch(self, client, fake_db):
        body = {"columns": COLUMNS, "rows": [["a", "b"]]}
        res = client.post("/logs/saved", json=body, headers=LOCAL)
        assert res.status_code == 400
        assert res.json()["detail"] == "Row length does not match columns"

    def test_post_rejects_oversized_tables(self, client, fake_db):
        body = {"columns": ["c"] * 21, "rows": []}
        assert client.post("/logs/saved", json=body, headers=LOCAL).status_code == 400
        body = {"columns": ["c"], "rows": [["x"]] * 5001}
        assert client.post("/logs/saved", json=body, headers=LOCAL).status_code == 400

    def test_post_rejects_non_local_clients(self, client, fake_db):
        res = client.post("/logs/saved", json={"columns": COLUMNS, "rows": ROWS}, headers=REMOTE)
        assert res.status_code == 403
        assert fake_db["save_log"] == []