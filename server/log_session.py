import csv
import io
from datetime import datetime, timezone

known_identities: set[str] = set()
known_names: dict[str, str] = {}
event_log: list[dict] = []

def record_events(current_participants: list[dict]) -> None:
    global known_identities
    current_ids = {p["identity"] for p in current_participants}
    name_lookup = {p["identity"]: p["name"] for p in current_participants}

    joined = current_ids - known_identities
    left = known_identities - current_ids

    now = datetime.now(timezone.utc).isoformat()
    for identity in joined:
        name = name_lookup.get(identity, identity)
        known_names[identity] = name
        event_log.append({
            "timestamp": now,
            "identity": identity,
            "name": name,
            "event": "joined",
        })
    for identity in left:
        event_log.append({
            "timestamp": now,
            "identity": identity,
            "name": known_names.get(identity, identity),
            "event": "left",
        })

    known_identities = current_ids

def reset() -> None:
    global known_identities
    known_identities = set()
    known_names.clear()
    event_log.clear()

def to_csv_bytes() -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=["timestamp", "name", "identity", "event"])
    writer.writeheader()
    writer.writerows(event_log)
    return buf.getvalue()

def to_pdf_bytes() -> bytes:
    from fpdf import FPDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    pdf.cell(0, 10, "FocalPoint Session Log", ln=True)
    pdf.set_font("Helvetica", size=9)
    for e in event_log:
        pdf.cell(0, 6, f'{e["timestamp"]}  {e["name"]}  {e["event"]}', ln=True)

    output = pdf.output()
    if isinstance(output, str):
        return output.encode("latin-1")
    return bytes(output)