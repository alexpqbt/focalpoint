import json
import sqlite3
from contextlib import closing
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "focalpoint.db"

def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init() -> None:
    with closing(_connect()) as conn, conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS session_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                number INTEGER NOT NULL,
                label TEXT NOT NULL,
                created_at TEXT NOT NULL,
                field_values TEXT NOT NULL,
                columns TEXT NOT NULL,
                rows TEXT NOT NULL
            )
        """)

def _to_entry(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "number": row["number"],
        "label": row["label"],
        "fieldValues": json.loads(row["field_values"]),
        "columns": json.loads(row["columns"]),
        "rows": json.loads(row["rows"]),
    }

def save_log(columns: list[str], rows: list[list[str]], field_values: list[str]) -> dict:
    now = datetime.now()
    with closing(_connect()) as conn, conn:
        last = conn.execute("SELECT COALESCE(MAX(number), 0) FROM session_logs").fetchone()[0]
        number = last + 1
        label = f"Log {number}: {now.month}/{now.day}/{now.year}"
        cur = conn.execute(
            "INSERT INTO session_logs (number, label, created_at, field_values, columns, rows) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (number, label, now.isoformat(), json.dumps(field_values),
             json.dumps(columns), json.dumps(rows)),
        )
        row = conn.execute("SELECT * FROM session_logs WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _to_entry(row)

def list_logs() -> list[dict]:
    with closing(_connect()) as conn:
        rows = conn.execute("SELECT * FROM session_logs ORDER BY id DESC").fetchall()
    return [_to_entry(r) for r in rows]