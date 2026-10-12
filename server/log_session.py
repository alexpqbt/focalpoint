import csv
import io
from datetime import datetime, timezone

known_identities: set[str] = set()
known_names: dict[str, str] = {}
event_log: list[dict] = []
known_attributes: dict[str, dict] = {}

def _fit(pdf, text, width):
    text = str(text).encode("latin-1", "replace").decode("latin-1")
    while text and pdf.get_string_width(text) > width - 2:
        text = text[:-1]
    return text

def record_events(current_participants: list[dict]) -> None:
    global known_identities
    current_ids = {p["identity"] for p in current_participants}
    name_lookup = {p["identity"]: p["name"] for p in current_participants}
    attr_lookup = {p["identity"]: p.get("attributes", {}) for p in current_participants}

    joined = current_ids - known_identities
    left = known_identities - current_ids

    now = datetime.now(timezone.utc).isoformat()
    for identity in joined:
        name = name_lookup.get(identity, identity)
        attrs = attr_lookup.get(identity, {})
        known_names[identity] = name
        known_attributes[identity] = attrs
        event_log.append({
            "timestamp": now,
            "identity": identity,
            "name": name,
            "attributes": attrs,
            "event": "joined",
        })
    for identity in left:
        event_log.append({
            "timestamp": now,
            "identity": identity,
            "name": known_names.get(identity, identity),
            "attributes": known_attributes.get(identity, {}),
            "event": "left",
        })

    known_identities = current_ids

def reset() -> None:
    global known_identities
    known_identities = set()
    known_names.clear()
    known_attributes.clear()
    event_log.clear()

def to_csv_bytes(labels: list[str] | None = None) -> str:
    labels = labels or []
    buf = io.StringIO()
    writer = csv.DictWriter(
        buf, fieldnames=["timestamp", *labels, "name", "identity", "event"]
    )
    writer.writeheader()
    for e in event_log:
        row = {
            "timestamp": e["timestamp"],
            "name": e["name"],
            "identity": e["identity"],
            "event": e["event"],
        }
        for label in labels:
            row[label] = e.get("attributes", {}).get(label, "")
        writer.writerow(row)
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