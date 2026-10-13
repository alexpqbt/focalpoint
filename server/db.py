import json
import sqlite3
from contextlib import closing
from datetime import datetime
from pathlib import Path
from paths import SERVER_DIR

DB_PATH = SERVER_DIR / "focalpoint.db"

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
        conn.execute("""
            CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                label TEXT NOT NULL,
                room_size TEXT NOT NULL,
                fields TEXT NOT NULL,
                user_inputs TEXT NOT NULL
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

def _room_entry(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "label": row["label"],
        "roomSize": row["room_size"],
        "fields": json.loads(row["fields"]),
        "userInputs": json.loads(row["user_inputs"]),
    }

def list_rooms() -> list[dict]:
    with closing(_connect()) as conn:
        rows = conn.execute("SELECT * FROM rooms ORDER BY id").fetchall()
    return [_room_entry(r) for r in rows]

def create_room(room_size: str, fields: list[dict], user_inputs: list[str]) -> dict:
    with closing(_connect()) as conn, conn:
        cur = conn.execute(
            "INSERT INTO rooms (label, room_size, fields, user_inputs) VALUES (?, ?, ?, ?)",
            ("", room_size, json.dumps(fields), json.dumps(user_inputs)),
        )
        room_id = cur.lastrowid
        conn.execute("UPDATE rooms SET label = ? WHERE id = ?", (f"Room {room_id}", room_id))
        row = conn.execute("SELECT * FROM rooms WHERE id = ?", (room_id,)).fetchone()
    return _room_entry(row)

def update_room(room_id: int, room_size: str, fields: list[dict], user_inputs: list[str]) -> dict | None:
    with closing(_connect()) as conn, conn:
        cur = conn.execute(
            "UPDATE rooms SET room_size = ?, fields = ?, user_inputs = ? WHERE id = ?",
            (room_size, json.dumps(fields), json.dumps(user_inputs), room_id),
        )
        if cur.rowcount == 0:
            return None
        row = conn.execute("SELECT * FROM rooms WHERE id = ?", (room_id,)).fetchone()
    return _room_entry(row)

def delete_room(room_id: int) -> bool:
    with closing(_connect()) as conn, conn:
        cur = conn.execute("DELETE FROM rooms WHERE id = ?", (room_id,))
    return cur.rowcount > 0