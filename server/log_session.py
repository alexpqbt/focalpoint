import csv
import io
import math
from datetime import datetime, timezone

known_identities: set[str] = set()
known_names: dict[str, str] = {}
event_log: list[dict] = []
known_attributes: dict[str, dict] = {}

def _split_time(iso: str) -> tuple[str, str]:
    dt = datetime.fromisoformat(iso).astimezone()
    return dt.strftime("%m/%d/%Y"), dt.strftime("%I:%M:%S %p")

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

BLUE = (21, 96, 130)
ORANGE = (233, 113, 50)
GRAY = (89, 89, 89)

def _safe(text) -> str:
    return str(text).encode("latin-1", "replace").decode("latin-1")

def _draw_header(pdf, columns, widths):
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(0, 0, 0)
    pdf.set_draw_color(0, 0, 0)
    pdf.set_line_width(0.2)
    last = len(columns) - 1
    for i, (title, w) in enumerate(zip(columns, widths)):
        border = "LTB" if i == 0 else ("TRB" if i == last else "TB")
        pdf.cell(w, 7, _fit(pdf, title, w), border=border)
    pdf.ln(7)
    pdf.set_font("Helvetica", size=10)

def _draw_attendance_chart(pdf, x, y, entered, not_entered) -> None:
    box_w, box_h, radius = 150, 85, 28
    cx, cy = x + box_w / 2, y + 46

    pdf.set_draw_color(217, 217, 217)
    pdf.set_line_width(0.3)
    pdf.rect(x, y, box_w, box_h)

    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(*GRAY)
    pdf.set_xy(x, y + 4)
    pdf.cell(box_w, 8, "Attendance", align="C")

    total = entered + not_entered
    slices = [(v, c) for v, c in ((entered, BLUE), (not_entered, ORANGE)) if v > 0]
    if len(slices) == 1:
        pdf.set_fill_color(*slices[0][1])
        pdf.ellipse(cx - radius, cy - radius, 2 * radius, 2 * radius, style="F")
    else:
        pdf.set_draw_color(255, 255, 255)
        pdf.set_line_width(0.6)
        angle = -90.0
        for value, color in slices:
            sweep = 360.0 * value / total
            steps = max(2, int(sweep / 2) + 1)
            points = [(cx, cy)]
            for i in range(steps + 1):
                a = math.radians(angle + sweep * i / steps)
                points.append((cx + radius * math.cos(a), cy + radius * math.sin(a)))
            pdf.set_fill_color(*color)
            pdf.polygon(points, style="DF")
            angle += sweep

    pdf.set_font("Helvetica", "", 8)
    items = [("Entered", BLUE), ("Not Entered", ORANGE)]
    sq, gap, between = 2.5, 1.5, 6
    total_w = sum(sq + gap + pdf.get_string_width(n) for n, _ in items) + between * (len(items) - 1)
    lx, ly = cx - total_w / 2, y + box_h - 8
    for name, color in items:
        pdf.set_fill_color(*color)
        pdf.rect(lx, ly + 2, sq, sq, style="F")
        pdf.set_xy(lx + sq + gap, ly)
        w = pdf.get_string_width(name)
        pdf.set_text_color(*GRAY)
        pdf.cell(w, 6, name)
        lx += sq + gap + w + between

def pdf_from_table(columns, rows, field_count=0, max_size=None) -> bytes:
    """Session report: header block, Time Stamp/Status/User Input table, attendance pie.

    columns/rows use the layout from _build_table:
    Date, Time Stamp, Status, <user inputs...>, <session fields...>.
    field_count is how many trailing columns are session fields.
    max_size is the room size; the attendance chart is skipped when it is None.
    """
    from fpdf import FPDF

    field_count = max(0, min(int(field_count or 0), len(columns) - 4))
    n_inputs = len(columns) - 3 - field_count
    input_end = 3 + n_inputs

    # Header values. Session fields are repeated on every row, so read the first row.
    field_names = list(columns[input_end:])
    field_vals = list(rows[0][input_end:]) if rows else [""] * len(field_names)
    header = [("Date", rows[0][0] if rows else "")]
    if rows and rows[-1][0] != rows[0][0]:
        header[0] = ("Date", f"{rows[0][0]} - {rows[-1][0]}")
    header += list(zip(field_names, field_vals))
    if max_size is not None:
        header.append(("Max Size", max_size))

    # Table drops the Date column and the session field columns.
    table_cols = [columns[1], columns[2], *columns[3:input_end]]
    table_rows = [[r[1], r[2], *r[3:input_end]] for r in rows]

    pdf = FPDF(orientation="L", format="Letter")
    pdf.set_margins(25, 20, 25)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    usable = pdf.w - pdf.l_margin - pdf.r_margin

    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "FocalPoint Session Report")
    pdf.ln(12)

    for label, value in header:
        label_text = _safe(f"{label}:")
        pdf.set_font("Helvetica", "B", 10)
        w = pdf.get_string_width(label_text) + 1.5
        pdf.cell(w, 6, label_text)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(usable - w, 6, _fit(pdf, value, usable - w))
        pdf.ln(6)
    pdf.ln(4)

    fixed = [32, 32]
    rest = (usable - sum(fixed)) / max(len(table_cols) - 2, 1)
    widths = fixed + [rest] * (len(table_cols) - 2)

    _draw_header(pdf, table_cols, widths)
    last = len(table_cols) - 1
    row_h = 6.5
    for row in table_rows:
        if pdf.get_y() + row_h > pdf.h - pdf.b_margin:
            pdf.add_page()
            _draw_header(pdf, table_cols, widths)
        pdf.set_text_color(0, 0, 0)
        pdf.set_draw_color(0, 0, 0)
        pdf.set_line_width(0.2)
        for i, (text, w) in enumerate(zip(row, widths)):
            border = "LTB" if i == 0 else ("TRB" if i == last else "TB")
            pdf.cell(w, row_h, _fit(pdf, text, w), border=border)
        pdf.ln(row_h)

    if max_size is not None:
        # Unique attendees who entered at least once. Reconnects count once.
        attendees = {tuple(r[3:input_end]) for r in rows if r[2] == "Entered"}
        entered = len(attendees)
        not_entered = max(int(max_size) - entered, 0)
        chart_h = 85
        pdf.ln(8)
        if pdf.get_y() + chart_h > pdf.h - pdf.b_margin:
            pdf.add_page()
        _draw_attendance_chart(pdf, pdf.l_margin, pdf.get_y(), entered, not_entered)

    output = pdf.output()
    if isinstance(output, str):
        return output.encode("latin-1")
    return bytes(output)

def to_csv_bytes(labels=None, fields=None) -> str:
    return csv_from_table(*_build_table(labels, fields))

def to_pdf_bytes(labels=None, fields=None, max_size=None) -> bytes:
    columns, rows = _build_table(labels, fields)
    return pdf_from_table(columns, rows, field_count=len(fields or []), max_size=max_size)