"""Endpoint tests that run the REAL log_session (no fake_log_session fixture).

Covers how GET /logs/export and POST /logs/render use the CSV and PDF generators,
plus the snapshot -> save -> render pipeline the frontend follows.

Place in server/tests/. Run from the project root:
    uv run --project server pytest server/tests/test_logs_export_render.py
"""
import csv
import io

import pytest
from fpdf import FPDF

import log_session
import main
from conftest import LOCAL, REMOTE, bearer

LABELS = ["First Name", "Last Name"]
FIELDS = [{"name": "Section", "value": "BSIT 4C"}, {"name": "Subject", "value": "Math"}]


def parse_csv(text):
    return list(csv.reader(io.StringIO(text)))


def person(identity, first, last):
    return {
        "identity": identity,
        "name": f"{first} {last}",
        "attributes": {"First Name": first, "Last Name": last},
    }


@pytest.fixture(autouse=True)
def clean_log():
    log_session.reset()
    yield
    log_session.reset()


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setitem(main.room_config, "user_inputs", list(LABELS))
    monkeypatch.setitem(main.room_config, "fields", [dict(f) for f in FIELDS])
    monkeypatch.setitem(main.room_config, "room_size", 30)


@pytest.fixture
def seeded():
    """Ana and Ben join, then Ana leaves."""
    log_session.record_events([person("s1", "Ana", "Cruz"), person("s2", "Ben", "Diaz")])
    log_session.record_events([person("s2", "Ben", "Diaz")])


@pytest.fixture
def pdf_cells(monkeypatch):
    seen: list[str] = []
    orig = FPDF.cell

    def cell(self, *a, **k):
        seen.append(str(a[2] if len(a) > 2 else k.get("text", "")))
        return orig(self, *a, **k)

    monkeypatch.setattr(FPDF, "cell", cell)
    return seen


# ---------------------------------------------------------------------------
# GET /logs/export
# ---------------------------------------------------------------------------
class TestExportCsv:
    def test_defaults_to_csv_with_download_headers(self, client, configured, seeded):
        r = client.get("/logs/export", headers=bearer())

        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/csv")
        assert r.headers["content-disposition"] == "attachment; filename=log_session.csv"

    def test_columns_follow_the_room_configuration(self, client, configured, seeded):
        parsed = parse_csv(client.get("/logs/export?format=csv", headers=bearer()).text)

        assert parsed[0] == [
            "Date", "Time Stamp", "Status", "First Name", "Last Name", "Section", "Subject",
        ]

    def test_rows_hold_each_join_and_leave_with_session_fields_repeated(self, client, configured, seeded):
        parsed = parse_csv(client.get("/logs/export?format=csv", headers=bearer()).text)

        body = {(r[2], r[3], r[4], r[5], r[6]) for r in parsed[1:]}  # order of simultaneous joins is not fixed
        assert body == {
            ("Entered", "Ana", "Cruz", "BSIT 4C", "Math"),
            ("Entered", "Ben", "Diaz", "BSIT 4C", "Math"),
            ("Left", "Ana", "Cruz", "BSIT 4C", "Math"),
        }

    def test_empty_log_exports_only_the_header(self, client, configured):
        parsed = parse_csv(client.get("/logs/export", headers=bearer()).text)

        assert len(parsed) == 1
        assert parsed[0][:3] == ["Date", "Time Stamp", "Status"]

    def test_without_configuration_the_log_has_a_single_name_column(self, client):
        log_session.record_events([{"identity": "s1", "name": "Ana Cruz", "attributes": {}}])

        parsed = parse_csv(client.get("/logs/export", headers=bearer()).text)

        assert parsed[0] == ["Date", "Time Stamp", "Status", "Name"]
        assert parsed[1][2:] == ["Entered", "Ana Cruz"]


class TestExportPdf:
    def test_returns_a_pdf_download(self, client, configured, seeded):
        r = client.get("/logs/export?format=pdf", headers=bearer())

        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert r.headers["content-disposition"] == "attachment; filename=log_session.pdf"
        assert r.content.startswith(b"%PDF-")
        assert r.content.rstrip().endswith(b"%%EOF")

    def test_report_uses_the_room_size_fields_and_attendance(self, client, configured, seeded, pdf_cells):
        client.get("/logs/export?format=pdf", headers=bearer())

        for expected in ("Section:", "BSIT 4C", "Subject:", "Math", "Max Size:", "30", "Attendance:", "2/30"):
            assert expected in pdf_cells

    def test_report_has_no_max_size_when_the_room_has_none(self, client, monkeypatch, seeded, pdf_cells):
        monkeypatch.setitem(main.room_config, "user_inputs", list(LABELS))

        client.get("/logs/export?format=pdf", headers=bearer())

        assert "Max Size:" not in pdf_cells

    def test_empty_log_still_produces_a_valid_pdf(self, client, configured):
        r = client.get("/logs/export?format=pdf", headers=bearer())

        assert r.status_code == 200
        assert r.content.startswith(b"%PDF-")


class TestExportRules:
    def test_rejects_an_unknown_format(self, client):
        r = client.get("/logs/export?format=xlsx", headers=bearer())

        assert r.status_code == 400
        assert r.json()["detail"] == "format must be csv or pdf"

    def test_requires_an_authorization_header(self, client):
        assert client.get("/logs/export").status_code == 422

    def test_rejects_a_token_without_room_admin(self, client):
        assert client.get("/logs/export", headers=bearer(admin=False)).status_code == 403

    def test_rejects_a_garbage_token(self, client):
        r = client.get("/logs/export", headers={"Authorization": "Bearer nope"})

        assert r.status_code == 401


# ---------------------------------------------------------------------------
# POST /logs/render
# ---------------------------------------------------------------------------
TABLE = {
    "columns": ["Date", "Time Stamp", "Status", "First Name", "Last Name", "Section"],
    "rows": [
        ["10/03/2026", "09:00:00 AM", "Entered", "Ana", "Cruz", "BSIT 4C"],
        ["10/03/2026", "09:05:00 AM", "Entered", "Ben", "Diaz", "BSIT 4C"],
        ["10/03/2026", "10:00:00 AM", "Left", "Ana", "Cruz", "BSIT 4C"],
    ],
}


def render_post(client, fmt, payload, headers=LOCAL):
    return client.post(f"/logs/render?format={fmt}", json=payload, headers=headers)


class TestRenderCsv:
    def test_returns_the_posted_table_as_csv(self, client):
        r = render_post(client, "csv", TABLE)

        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/csv")
        assert r.headers["content-disposition"] == "attachment; filename=log_session.csv"
        assert parse_csv(r.text) == [TABLE["columns"], *TABLE["rows"]]

    def test_defaults_to_csv(self, client):
        r = client.post("/logs/render", json=TABLE, headers=LOCAL)

        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/csv")

    def test_special_characters_are_escaped(self, client):
        payload = {"columns": ["a", "b"], "rows": [['Cruz, Ana', 'say "hi"'], ["x\ny", "Niño 李雷"]]}

        parsed = parse_csv(render_post(client, "csv", payload).text)

        assert parsed[1:] == payload["rows"]

    def test_no_rows_returns_only_the_header(self, client):
        parsed = parse_csv(render_post(client, "csv", {"columns": ["a", "b"], "rows": []}).text)

        assert parsed == [["a", "b"]]

    def test_accepts_the_maximum_table_size(self, client):
        payload = {"columns": ["c"], "rows": [["v"]] * 5000}

        r = render_post(client, "csv", payload)

        assert r.status_code == 200
        assert len(parse_csv(r.text)) == 5001


class TestRenderPdf:
    def test_returns_a_pdf_download(self, client):
        r = render_post(client, "pdf", {**TABLE, "field_count": 1, "max_size": 30})

        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert r.headers["content-disposition"] == "attachment; filename=log_session.pdf"
        assert r.content.startswith(b"%PDF-")
        assert r.content.rstrip().endswith(b"%%EOF")

    def test_report_reflects_the_posted_table(self, client, pdf_cells):
        render_post(client, "pdf", {**TABLE, "field_count": 1, "max_size": 30})

        for expected in (
            "Section:", "BSIT 4C", "Max Size:", "30", "Attendance:", "2/30",
            "Ana", "Ben", "09:00:00 AM", "10:00:00 AM",
        ):
            assert expected in pdf_cells
        assert "Section" not in pdf_cells  # a session field, not a table column

    @pytest.mark.parametrize("max_size", [None, 1, 50])
    def test_accepts_valid_max_sizes(self, client, max_size):
        r = render_post(client, "pdf", {**TABLE, "field_count": 1, "max_size": max_size})

        assert r.status_code == 200

    @pytest.mark.parametrize("field_count", [0, 6])
    def test_accepts_field_count_limits(self, client, field_count):
        r = render_post(client, "pdf", {**TABLE, "field_count": field_count})

        assert r.status_code == 200

    @pytest.mark.parametrize("max_size", [0, 51, -1])
    def test_rejects_max_size_outside_1_to_50(self, client, max_size):
        r = render_post(client, "pdf", {**TABLE, "max_size": max_size})

        assert r.status_code == 400
        assert r.json()["detail"] == "max_size must be 1 to 50"

    @pytest.mark.parametrize("field_count", [-1, 7])
    def test_rejects_field_count_outside_0_to_6(self, client, field_count):
        r = render_post(client, "pdf", {**TABLE, "field_count": field_count})

        assert r.status_code == 400
        assert r.json()["detail"] == "field_count must be 0 to 6"

    def test_needs_at_least_four_columns(self, client):
        r = render_post(client, "pdf", {"columns": ["Date", "Time Stamp", "Status"], "rows": []})

        assert r.status_code == 400
        assert r.json()["detail"] == "PDF needs at least 4 columns"

    def test_renders_the_widest_allowed_table_without_failing(self, client):
        columns = ["Date", "Time Stamp", "Status", *[f"Input {i}" for i in range(17)]]
        rows = [["10/03/2026", "09:00:00 AM", "Entered", *[f"v{i}" for i in range(17)]]]

        r = render_post(client, "pdf", {"columns": columns, "rows": rows})

        assert r.status_code == 200
        assert r.content.startswith(b"%PDF-")


class TestRenderRules:
    def test_only_the_host_machine_may_render(self, client):
        assert render_post(client, "csv", TABLE, headers=REMOTE).status_code == 403
        assert render_post(client, "pdf", TABLE, headers=REMOTE).status_code == 403

    def test_rejects_an_unknown_format(self, client):
        r = render_post(client, "xlsx", TABLE)

        assert r.status_code == 400
        assert r.json()["detail"] == "format must be csv or pdf"

    @pytest.mark.parametrize("fmt", ["csv", "pdf"])
    def test_rejects_more_than_20_columns(self, client, fmt):
        payload = {"columns": [f"c{i}" for i in range(21)], "rows": []}

        r = render_post(client, fmt, payload)

        assert r.status_code == 400
        assert r.json()["detail"] == "Table too large"

    def test_rejects_more_than_5000_rows(self, client):
        r = render_post(client, "csv", {"columns": ["c"], "rows": [["v"]] * 5001})

        assert r.status_code == 400
        assert r.json()["detail"] == "Table too large"

    @pytest.mark.parametrize("fmt", ["csv", "pdf"])
    def test_rejects_rows_whose_length_does_not_match_the_columns(self, client, fmt):
        payload = {"columns": ["a", "b", "c", "d"], "rows": [["1", "2", "3"]]}

        r = render_post(client, fmt, payload)

        assert r.status_code == 400
        assert r.json()["detail"] == "Row length does not match columns"

    def test_rejects_non_text_cells(self, client):
        r = render_post(client, "csv", {"columns": ["a"], "rows": [[1]]})

        assert r.status_code == 422


# ---------------------------------------------------------------------------
# snapshot -> save -> list -> render (what the frontend does end to end)
# ---------------------------------------------------------------------------
class TestSnapshotToRenderPipeline:
    def test_a_session_can_be_saved_then_downloaded_as_csv_and_pdf(
        self, client, real_db, configured, seeded, pdf_cells
    ):
        snap = client.get("/logs/snapshot", headers=LOCAL).json()
        assert snap["max_size"] == 30
        assert snap["columns"] == [
            "Date", "Time Stamp", "Status", "First Name", "Last Name", "Section", "Subject",
        ]

        saved = client.post(
            "/logs/saved",
            json={
                "columns": snap["columns"],
                "rows": snap["rows"],
                "field_values": snap["field_values"],
                "max_size": snap["max_size"],
            },
            headers=LOCAL,
        ).json()
        assert saved["saved"] is True

        entry = client.get("/logs/saved", headers=LOCAL).json()[0]
        assert entry["fieldValues"] == ["BSIT 4C", "Math"]
        assert entry["maxSize"] == 30

        csv_resp = render_post(client, "csv", {"columns": entry["columns"], "rows": entry["rows"]})
        assert csv_resp.status_code == 200
        assert parse_csv(csv_resp.text) == [entry["columns"], *entry["rows"]]

        pdf_resp = render_post(
            client,
            "pdf",
            {
                "columns": entry["columns"],
                "rows": entry["rows"],
                "field_count": len(entry["fieldValues"]),
                "max_size": entry["maxSize"],
            },
        )
        assert pdf_resp.status_code == 200
        assert pdf_resp.content.startswith(b"%PDF-")
        assert "2/30" in pdf_cells
        assert "BSIT 4C" in pdf_cells and "Math" in pdf_cells