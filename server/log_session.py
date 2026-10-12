import csv
import io
from datetime import datetime, timezone

known_identities: set[str] = set()
known_names: dict[str, str] = {}
event_log: list[dict] = []
known_attributes: dict[str, dict] = {}

def _split_time(iso: str) -> tuple[str, str]:
    dt = datetime.fromisoformat(iso).astimezone()
    return dt.strftime("%m/%d/%Y"), dt.strftime("%I:%M %p")

def _fit(pdf, text, width):
    text = str(text).encode("latin-1", "replace").decode("latin-1")
    while text and pdf.get_string_width(text) > width - 2:
        text = text[:-1]
    return text

def _build_table(labels=None, fields=None):
    labels = labels or []
    fields = fields or []
    columns = [
        "Date", "Time Stamp", "Status",
        *(labels or ["Name"]),
        *[f["name"] for f in fields],
    ]
    field_values = [f["value"] for f in fields]
    rows = []
    for e in event_log:
        date, time = _split_time(e["timestamp"])
        attrs = e.get("attributes", {})
        who = [attrs.get(l, "") for l in labels] if labels else [e["name"]]
        status = "Entered" if e["event"] == "joined" else "Left"
        rows.append([date, time, status, *who, *field_values])
    return columns, rows

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

def snapshot(labels=None, fields=None) -> dict:
    columns, rows = _build_table(labels, fields)
    return {
        "columns": columns,
        "rows": rows,
        "field_values": [f["value"] for f in (fields or [])],
    }

def csv_from_table(columns, rows) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(columns)
    writer.writerows(rows)
    return buf.getvalue()

def pdf_from_table(columns, rows) -> bytes:
    from fpdf import FPDF

    pdf = FPDF(orientation="L")
    pdf.add_page()
    usable = pdf.w - 2 * pdf.l_margin

    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "FocalPoint Session Log")
    pdf.ln(12)

    fixed = [22, 22, 20]
    rest = (usable - sum(fixed)) / max(len(columns) - 3, 1)
    widths = fixed + [rest] * (len(columns) - 3)

    pdf.set_font("Helvetica", "B", 8)
    pdf.set_fill_color(230, 236, 250)
    for title, w in zip(columns, widths):
        pdf.cell(w, 7, _fit(pdf, title, w), border=1, fill=True)
    pdf.ln(7)

    pdf.set_font("Helvetica", size=8)
    for row in rows:
        for text, w in zip(row, widths):
            pdf.cell(w, 6, _fit(pdf, text, w), border=1)
        pdf.ln(6)

    output = pdf.output()
    if isinstance(output, str):
        return output.encode("latin-1")
    return bytes(output)

def to_csv_bytes(labels=None, fields=None) -> str:
    return csv_from_table(*_build_table(labels, fields))

def to_pdf_bytes(labels=None, fields=None) -> bytes:
    return pdf_from_table(*_build_table(labels, fields))