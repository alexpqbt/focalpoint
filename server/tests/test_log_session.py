"""Unit tests for server/log_session.py: event log, table building, CSV and PDF output.

Place in server/tests/. Run from the project root:
    uv run --project server pytest server/tests/test_log_session.py

PDF text is compressed inside the file, so these tests spy on FPDF.cell / FPDF.add_page
to see exactly which text was drawn and how many pages were produced.
"""
import csv
import io
import re
import sys
from datetime import datetime

import pytest
from fpdf import FPDF

import log_session as ls

ORIGINAL_LOGO_PATH = ls._logo_path  # captured before any fixture patches it

COLS = ["Date", "Time Stamp", "Status", "First Name", "Last Name"]


def row(status, first, last, time="10:00:00 AM", date="10/03/2026", *extra):
    return [date, time, status, first, last, *extra]


def person(identity, name, **attrs):
    return {"identity": identity, "name": name, "attributes": attrs}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def clean_log():
    ls.reset()
    yield
    ls.reset()


@pytest.fixture(autouse=True)
def no_logo(monkeypatch):
    """Deterministic banner: draw the 'FocalPoint' text, not whatever logo is on disk."""
    monkeypatch.setattr(ls, "_logo_path", lambda: None)


class Spy:
    def __init__(self):
        self.cells: list[str] = []
        self.pages = 0


@pytest.fixture
def spy(monkeypatch):
    s = Spy()
    orig_cell, orig_add_page = FPDF.cell, FPDF.add_page

    def cell(self, *a, **k):
        s.cells.append(str(a[2] if len(a) > 2 else k.get("text", "")))
        return orig_cell(self, *a, **k)

    def add_page(self, *a, **k):
        s.pages += 1
        return orig_add_page(self, *a, **k)

    monkeypatch.setattr(FPDF, "cell", cell)
    monkeypatch.setattr(FPDF, "add_page", add_page)
    return s


def render(columns, rows, **kw) -> bytes:
    return ls.pdf_from_table(columns, rows, **kw)


# ---------------------------------------------------------------------------
# _split_time
# ---------------------------------------------------------------------------
class TestSplitTime:
    def test_formats_date_and_12_hour_time(self):
        iso = "2026-10-03T02:05:09+00:00"
        date, time = ls._split_time(iso)

        local = datetime.fromisoformat(iso).astimezone()
        assert date == local.strftime("%m/%d/%Y")
        assert time == local.strftime("%I:%M:%S %p")
        assert re.fullmatch(r"\d{2}/\d{2}/\d{4}", date)
        assert re.fullmatch(r"\d{2}:\d{2}:\d{2} (AM|PM)", time)


# ---------------------------------------------------------------------------
# record_events / reset
# ---------------------------------------------------------------------------
class TestRecordEvents:
    def test_new_participant_is_logged_as_joined(self):
        ls.record_events([person("a", "Ana", **{"First Name": "Ana"})])

        assert len(ls.event_log) == 1
        e = ls.event_log[0]
        assert (e["event"], e["identity"], e["name"]) == ("joined", "a", "Ana")
        assert e["attributes"] == {"First Name": "Ana"}
        assert datetime.fromisoformat(e["timestamp"]).tzinfo is not None

    def test_polling_the_same_participants_again_adds_nothing(self):
        ls.record_events([person("a", "Ana")])
        ls.record_events([person("a", "Ana")])

        assert len(ls.event_log) == 1

    def test_participant_who_disappears_is_logged_as_left_with_remembered_details(self):
        ls.record_events([person("a", "Ana", **{"First Name": "Ana"})])
        ls.record_events([])

        assert [e["event"] for e in ls.event_log] == ["joined", "left"]
        left = ls.event_log[1]
        assert left["name"] == "Ana"
        assert left["attributes"] == {"First Name": "Ana"}

    def test_rejoining_creates_a_new_joined_event(self):
        ls.record_events([person("a", "Ana")])
        ls.record_events([])
        ls.record_events([person("a", "Ana")])

        assert [e["event"] for e in ls.event_log] == ["joined", "left", "joined"]

    def test_several_joiners_in_one_poll_are_all_logged(self):
        ls.record_events([person("a", "Ana"), person("b", "Ben"), person("c", "Cy")])

        assert {e["identity"] for e in ls.event_log} == {"a", "b", "c"}
        assert all(e["event"] == "joined" for e in ls.event_log)

    def test_only_the_one_who_left_is_logged_as_left(self):
        ls.record_events([person("a", "Ana"), person("b", "Ben")])
        ls.record_events([person("b", "Ben")])

        left = [e for e in ls.event_log if e["event"] == "left"]
        assert [e["identity"] for e in left] == ["a"]

    def test_missing_attributes_default_to_empty(self):
        ls.record_events([{"identity": "a", "name": "Ana"}])

        assert ls.event_log[0]["attributes"] == {}

    def test_reset_clears_everything_so_the_next_session_starts_fresh(self):
        ls.record_events([person("a", "Ana")])

        ls.reset()

        assert ls.event_log == []
        assert ls.known_identities == set()
        assert ls.known_names == {} and ls.known_attributes == {}
        ls.record_events([person("a", "Ana")])  # joins again instead of being "already known"
        assert [e["event"] for e in ls.event_log] == ["joined"]


# ---------------------------------------------------------------------------
# _build_table / snapshot
# ---------------------------------------------------------------------------
class TestBuildTable:
    def test_default_columns_use_a_single_name_column(self):
        ls.record_events([person("a", "Ana Cruz")])

        columns, rows = ls._build_table()

        assert columns == ["Date", "Time Stamp", "Status", "Name"]
        assert rows[0][2:] == ["Entered", "Ana Cruz"]

    def test_user_input_labels_become_columns_with_the_participants_answers(self):
        ls.record_events([person("a", "Ana Cruz", **{"First Name": "Ana", "Last Name": "Cruz"})])

        columns, rows = ls._build_table(["First Name", "Last Name"])

        assert columns == ["Date", "Time Stamp", "Status", "First Name", "Last Name"]
        assert rows[0][3:] == ["Ana", "Cruz"]

    def test_missing_answers_are_blank(self):
        ls.record_events([person("a", "Ana", **{"First Name": "Ana"})])

        _, rows = ls._build_table(["First Name", "Last Name"])

        assert rows[0][3:] == ["Ana", ""]

    def test_session_fields_are_trailing_columns_repeated_on_every_row(self):
        ls.record_events([person("a", "Ana"), person("b", "Ben")])
        fields = [{"name": "Section", "value": "BSIT 4C"}, {"name": "Subject", "value": "Math"}]

        columns, rows = ls._build_table(None, fields)

        assert columns[-2:] == ["Section", "Subject"]
        assert len(rows) == 2
        assert all(r[-2:] == ["BSIT 4C", "Math"] for r in rows)

    def test_status_text_is_entered_or_left(self):
        ls.record_events([person("a", "Ana")])
        ls.record_events([])

        _, rows = ls._build_table()

        assert [r[2] for r in rows] == ["Entered", "Left"]

    def test_date_and_time_are_formatted_for_reading(self):
        ls.record_events([person("a", "Ana")])

        _, rows = ls._build_table()

        assert re.fullmatch(r"\d{2}/\d{2}/\d{4}", rows[0][0])
        assert re.fullmatch(r"\d{2}:\d{2}:\d{2} (AM|PM)", rows[0][1])

    def test_empty_log_gives_headers_and_no_rows(self):
        columns, rows = ls._build_table(["First Name"], [{"name": "Section", "value": "X"}])

        assert columns == ["Date", "Time Stamp", "Status", "First Name", "Section"]
        assert rows == []


class TestSnapshot:
    def test_returns_columns_rows_and_field_values(self):
        ls.record_events([person("a", "Ana", **{"First Name": "Ana"})])
        fields = [{"name": "Section", "value": "BSIT 4C"}]

        snap = ls.snapshot(["First Name"], fields)

        assert snap["columns"] == ["Date", "Time Stamp", "Status", "First Name", "Section"]
        assert len(snap["rows"]) == 1
        assert snap["field_values"] == ["BSIT 4C"]

    def test_without_fields_field_values_is_empty(self):
        assert ls.snapshot()["field_values"] == []


# ---------------------------------------------------------------------------
# CSV
# ---------------------------------------------------------------------------
def parse_csv(text):
    return list(csv.reader(io.StringIO(text)))


class TestCsv:
    def test_header_row_then_data_rows(self):
        text = ls.csv_from_table(["A", "B"], [["1", "2"], ["3", "4"]])

        assert parse_csv(text) == [["A", "B"], ["1", "2"], ["3", "4"]]

    def test_no_rows_gives_only_the_header(self):
        assert parse_csv(ls.csv_from_table(["A", "B"], [])) == [["A", "B"]]

    def test_commas_quotes_and_newlines_survive_a_round_trip(self):
        tricky = ['Cruz, Ana', 'say "hi"', "line1\nline2", ""]

        parsed = parse_csv(ls.csv_from_table(["a", "b", "c", "d"], [tricky]))

        assert parsed[1] == tricky

    def test_unicode_is_preserved(self):
        parsed = parse_csv(ls.csv_from_table(["Name"], [["Niño Peña"], ["李雷"]]))

        assert parsed[1:] == [["Niño Peña"], ["李雷"]]

    def test_uses_crlf_line_endings(self):
        assert ls.csv_from_table(["A"], [["1"]]) == "A\r\n1\r\n"

    def test_to_csv_bytes_builds_the_live_log_table(self):
        ls.record_events([person("a", "Ana Cruz", **{"First Name": "Ana", "Last Name": "Cruz"})])
        fields = [{"name": "Section", "value": "BSIT 4C"}]

        out = ls.to_csv_bytes(["First Name", "Last Name"], fields)

        # The function is named *_bytes but returns str; main.py streams it as text.
        assert isinstance(out, str)
        parsed = parse_csv(out)
        assert parsed[0] == ["Date", "Time Stamp", "Status", "First Name", "Last Name", "Section"]
        assert parsed[1][2:] == ["Entered", "Ana", "Cruz", "BSIT 4C"]


# ---------------------------------------------------------------------------
# PDF helpers
# ---------------------------------------------------------------------------
class TestPdfHelpers:
    def _pdf(self):
        pdf = FPDF(orientation="L", format="Letter")
        pdf.add_page()
        pdf.set_font("Helvetica", "", 10)
        return pdf

    def test_safe_replaces_characters_latin1_cannot_hold(self):
        assert ls._safe("Niño") == "Niño"
        assert ls._safe("李雷") == "??"
        assert ls._safe(123) == "123"

    def test_fit_leaves_short_text_alone(self):
        assert ls._fit(self._pdf(), "Ana", 50) == "Ana"

    def test_fit_truncates_text_to_the_available_width(self):
        pdf = self._pdf()

        out = ls._fit(pdf, "W" * 100, 50)

        assert 0 < len(out) < 100
        assert pdf.get_string_width(out) <= 48

    def test_fit_returns_empty_when_nothing_fits(self):
        assert ls._fit(self._pdf(), "Ana", 1) == ""

    def test_fit_replaces_unsupported_characters(self):
        assert ls._fit(self._pdf(), "李雷", 50) == "??"

    def test_attendance_without_a_max_size_has_no_bar(self):
        pdf = self._pdf()
        assert ls._draw_attendance(pdf, 10, 20, 100, 3, None) == 26

    def test_attendance_with_a_max_size_draws_the_bar_below_the_label(self):
        pdf = self._pdf()
        assert ls._draw_attendance(pdf, 10, 20, 100, 3, 50) == 38

    @pytest.mark.parametrize("entered", [0, 25, 50, 80])
    def test_attendance_bar_handles_empty_full_and_overfull(self, entered):
        pdf = self._pdf()
        assert ls._draw_attendance(pdf, 10, 20, 100, entered, 50) == 38


# ---------------------------------------------------------------------------
# PDF: structure and content
# ---------------------------------------------------------------------------
class TestPdfOutput:
    def test_returns_a_pdf_document(self):
        out = render(COLS, [row("Entered", "Ana", "Cruz")], max_size=50)

        assert isinstance(out, bytes)
        assert out.startswith(b"%PDF-")
        assert out.rstrip().endswith(b"%%EOF")

    def test_draws_the_banner_title(self, spy):
        render(COLS, [row("Entered", "Ana", "Cruz")])

        assert "Session Report" in spy.cells
        assert "FocalPoint" in spy.cells  # text fallback when there is no logo

    def test_header_block_shows_date_and_session_fields(self, spy):
        cols = [*COLS, "Section", "Subject"]
        rows = [row("Entered", "Ana", "Cruz", "10:00:00 AM", "10/03/2026", "BSIT 4C", "Math")]

        render(cols, rows, field_count=2, max_size=30)

        for expected in ("Date:", "10/03/2026", "Section:", "BSIT 4C", "Subject:", "Math", "Max Size:", "30"):
            assert expected in spy.cells

    def test_session_fields_are_not_table_columns(self, spy):
        cols = [*COLS, "Section"]
        rows = [row("Entered", "Ana", "Cruz", "10:00:00 AM", "10/03/2026", "BSIT 4C")]

        render(cols, rows, field_count=1)

        assert "Section" not in spy.cells  # only "Section:" in the header block
        assert "Section:" in spy.cells

    def test_table_columns_are_time_status_and_user_inputs(self, spy):
        render(COLS, [row("Entered", "Ana", "Cruz")])

        header = [c for c in spy.cells if c in ("Time Stamp", "Status", "First Name", "Last Name", "Date")]
        assert header == ["Time Stamp", "Status", "First Name", "Last Name"]

    def test_max_size_line_is_omitted_when_there_is_no_max_size(self, spy):
        render(COLS, [row("Entered", "Ana", "Cruz")], max_size=None)

        assert "Max Size:" not in spy.cells

    def test_date_range_when_the_session_spans_two_days(self, spy):
        rows = [
            row("Entered", "Ana", "Cruz", "11:50:00 PM", "10/03/2026"),
            row("Left", "Ana", "Cruz", "12:10:00 AM", "10/04/2026"),
        ]

        render(COLS, rows)

        assert "10/03/2026 - 10/04/2026" in spy.cells

    def test_empty_log_still_renders_a_report(self, spy):
        out = render(COLS, [], max_size=50)

        assert out.startswith(b"%PDF-")
        assert "Attendance:" in spy.cells and "0/50" in spy.cells

    def test_field_count_is_clamped_to_the_available_columns(self):
        rows = [row("Entered", "Ana", "Cruz")]

        assert render(COLS, rows, field_count=99).startswith(b"%PDF-")
        assert render(COLS, rows, field_count=-3).startswith(b"%PDF-")
        assert render(COLS, rows, field_count=None).startswith(b"%PDF-")

    def test_non_latin_text_is_replaced_instead_of_crashing(self, spy):
        out = render(COLS, [row("Entered", "李雷 😀", "Cruz")])

        assert out.startswith(b"%PDF-")
        assert "?? ?" in spy.cells

    def test_overlong_cell_text_is_truncated_to_fit_its_column(self, spy):
        render(COLS, [row("Entered", "W" * 200, "Cruz")])

        long_cells = [c for c in spy.cells if c.startswith("W")]
        assert len(long_cells) == 1
        assert 0 < len(long_cells[0]) < 200

    def test_long_logs_continue_on_new_pages_with_the_header_repeated(self, spy):
        rows = [row("Entered", f"Person{i}", "X", f"{i % 12 + 1:02d}:00:00 AM") for i in range(80)]

        out = render(COLS, rows, max_size=50)

        assert out.startswith(b"%PDF-")
        assert spy.pages >= 2
        assert spy.cells.count("Status") >= 2


# ---------------------------------------------------------------------------
# PDF: grouping and attendance rules
# ---------------------------------------------------------------------------
class TestPdfGrouping:
    def test_each_person_gets_first_entry_and_final_exit_only(self, spy):
        rows = [
            row("Entered", "Ana", "Cruz", "09:00:00 AM"),
            row("Entered", "Ben", "Diaz", "09:05:00 AM"),
            row("Left", "Ana", "Cruz", "10:00:00 AM"),
            row("Entered", "Ana", "Cruz", "10:30:00 AM"),
            row("Left", "Ana", "Cruz", "11:00:00 AM"),
        ]

        render(COLS, rows, max_size=50)

        assert "09:00:00 AM" in spy.cells  # Ana's first entry
        assert "11:00:00 AM" in spy.cells  # Ana's final exit
        assert "09:05:00 AM" in spy.cells  # Ben's entry
        assert "10:00:00 AM" not in spy.cells  # intermediate exit collapsed
        assert "10:30:00 AM" not in spy.cells  # re-entry collapsed
        assert spy.cells.count("Entered") == 2
        assert spy.cells.count("Left") == 1

    def test_someone_who_rejoined_and_is_still_present_has_no_left_row(self, spy):
        rows = [
            row("Entered", "Ana", "Cruz", "09:00:00 AM"),
            row("Left", "Ana", "Cruz", "10:00:00 AM"),
            row("Entered", "Ana", "Cruz", "10:30:00 AM"),
        ]

        render(COLS, rows)

        assert spy.cells.count("Entered") == 1
        assert "Left" not in spy.cells

    def test_same_name_with_different_case_and_spacing_is_one_person(self, spy):
        rows = [
            row("Entered", "Ana ", "Cruz", "09:00:00 AM"),
            row("Entered", "ana", "cruz", "09:30:00 AM"),
        ]

        render(COLS, rows, max_size=50)

        assert spy.cells.count("Entered") == 1
        assert "1/50" in spy.cells

    def test_attendance_counts_unique_people_who_entered(self, spy):
        rows = [
            row("Entered", "Ana", "Cruz"),
            row("Entered", "Ben", "Diaz"),
            row("Left", "Ana", "Cruz"),
            row("Entered", "Ana", "Cruz"),
        ]

        render(COLS, rows, max_size=50)

        assert "Attendance:" in spy.cells
        assert "2/50" in spy.cells

    def test_attendance_without_max_size_is_a_plain_count(self, spy):
        rows = [row("Entered", "Ana", "Cruz"), row("Entered", "Ben", "Diaz")]

        render(COLS, rows, max_size=None)

        assert "2" in spy.cells
        assert not any(re.fullmatch(r"\d+/\d+", c) for c in spy.cells)

    def test_attendance_above_max_size_does_not_break_the_bar(self, spy):
        rows = [row("Entered", f"P{i}", "X") for i in range(5)]

        out = render(COLS, rows, max_size=3)

        assert out.startswith(b"%PDF-")
        assert "5/3" in spy.cells


# ---------------------------------------------------------------------------
# PDF: logo handling
# ---------------------------------------------------------------------------
def make_png(path):
    from PIL import Image

    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (40, 20), "white").save(path)
    return path


class TestPdfLogo:
    def test_logo_path_is_none_when_paths_module_is_unavailable(self, monkeypatch):
        monkeypatch.setitem(sys.modules, "paths", None)  # makes `from paths import BASE` fail

        assert ORIGINAL_LOGO_PATH() is None

    def test_logo_path_prefers_dist_over_public(self, tmp_path, monkeypatch):
        import paths

        monkeypatch.setattr(paths, "BASE", tmp_path)
        dist = make_png(tmp_path / "frontend" / "dist" / "logo.png")
        make_png(tmp_path / "frontend" / "public" / "logo.png")

        assert ORIGINAL_LOGO_PATH() == dist

    def test_logo_path_falls_back_to_public_then_none(self, tmp_path, monkeypatch):
        import paths

        monkeypatch.setattr(paths, "BASE", tmp_path)
        assert ORIGINAL_LOGO_PATH() is None

        public = make_png(tmp_path / "frontend" / "public" / "logo.png")
        assert ORIGINAL_LOGO_PATH() == public

    def test_a_real_logo_replaces_the_text_fallback(self, tmp_path, monkeypatch, spy):
        logo = make_png(tmp_path / "logo.png")
        monkeypatch.setattr(ls, "_logo_path", lambda: logo)

        out = render(COLS, [row("Entered", "Ana", "Cruz")])

        assert out.startswith(b"%PDF-")
        assert "FocalPoint" not in spy.cells
        assert "Session Report" in spy.cells

    def test_an_unreadable_logo_falls_back_to_text(self, tmp_path, monkeypatch, spy):
        bad = tmp_path / "logo.png"
        bad.write_text("not an image")
        monkeypatch.setattr(ls, "_logo_path", lambda: bad)

        out = render(COLS, [row("Entered", "Ana", "Cruz")])

        assert out.startswith(b"%PDF-")
        assert "FocalPoint" in spy.cells


# ---------------------------------------------------------------------------
# to_pdf_bytes (live log -> PDF)
# ---------------------------------------------------------------------------
class TestToPdfBytes:
    def test_builds_the_report_from_the_live_event_log(self, spy):
        ls.record_events([person("a", "Ana Cruz", **{"First Name": "Ana", "Last Name": "Cruz"})])
        fields = [{"name": "Section", "value": "BSIT 4C"}]

        out = ls.to_pdf_bytes(["First Name", "Last Name"], fields, max_size=30)

        assert out.startswith(b"%PDF-")
        for expected in ("Ana", "Cruz", "Section:", "BSIT 4C", "Max Size:", "30", "1/30"):
            assert expected in spy.cells

    def test_works_with_no_labels_no_fields_and_no_events(self):
        assert ls.to_pdf_bytes().startswith(b"%PDF-")