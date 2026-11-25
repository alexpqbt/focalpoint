"""Shared fixtures for server/main.py tests.

Place this file in server/tests/. Run from the project root:
    uv run --project server pytest server/tests
Requires: uv add --dev pytest httpx   (run inside server/)
"""
import sys
from pathlib import Path

import pytest

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

# main.py touches the network stack and the database at import time
# (get_local_ip() and db.init()). Neutralise both before importing it.
import networking  # noqa: E402
import db  # noqa: E402

_real_db_init = db.init  # kept for the `real_db` fixture below
networking.get_local_ip = lambda: "127.0.0.1"
db.init = lambda: None

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from livekit import api  # noqa: E402

LOCAL = {"x-real-ip": "127.0.0.1"}
REMOTE = {"x-real-ip": "192.168.1.50"}


def make_token(admin: bool = True) -> str:
    return (
        api.AccessToken(main.API_KEY, main.API_SECRET)
        .with_identity("presenter" if admin else "student-1")
        .with_name("presenter" if admin else "student-1")
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=main.ROOM_NAME,
                can_publish=admin,
                can_subscribe=True,
                room_admin=admin,
            )
        )
        .to_jwt()
    )


def bearer(admin: bool = True) -> dict:
    return {"Authorization": f"Bearer {make_token(admin)}"}


@pytest.fixture
def client():
    return TestClient(main.app)


@pytest.fixture(autouse=True)
def reset_room_config(monkeypatch):
    """Each test starts with the default in-memory room config."""
    monkeypatch.setitem(main.room_config, "user_inputs", [])
    monkeypatch.setitem(main.room_config, "fields", [])
    monkeypatch.setitem(main.room_config, "room_size", None)


@pytest.fixture
def fake_log_session(monkeypatch):
    """Replace log_session helpers with recorders so only main.py is under test."""
    calls: dict[str, list] = {}

    def recorder(name, result):
        def fn(*args, **kwargs):
            calls.setdefault(name, []).append((args, kwargs))
            return result() if callable(result) else result

        return fn

    ls = main.log_session
    monkeypatch.setattr(ls, "to_csv_bytes", recorder("to_csv_bytes", b"csv-bytes"))
    monkeypatch.setattr(ls, "to_pdf_bytes", recorder("to_pdf_bytes", b"%PDF-bytes"))
    monkeypatch.setattr(ls, "csv_from_table", recorder("csv_from_table", b"a,b\n1,2\n"))
    monkeypatch.setattr(ls, "pdf_from_table", recorder("pdf_from_table", b"%PDF-table"))
    monkeypatch.setattr(ls, "reset", recorder("reset", None))
    monkeypatch.setattr(
        ls,
        "snapshot",
        recorder(
            "snapshot",
            lambda: {
                "columns": ["Date", "Time Stamp", "Status", "Name"],
                "rows": [["2026-10-03", "10:00:00", "Entered", "Ana"]],
                "field_values": ["BSIT 4C"],
            },
        ),
    )
    return calls


@pytest.fixture
def real_db(tmp_path, monkeypatch):
    """A real, empty SQLite database in a temp folder (never touches focalpoint.db)."""
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    _real_db_init()
    return db