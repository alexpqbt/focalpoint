import csv
import io
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

NAVY = (0, 22, 62)
BAND = (199, 231, 255)
BAR_BORDER = (47, 111, 203)
BAR_FILL = (120, 194, 255)
DIVIDER = (129, 160, 189)
WHITE = (255, 255, 255)

MARGIN = 10
BAND_H = 20
ROW_H = 7

def _safe(text) -> str:
    return str(text).encode("latin-1", "replace").decode("latin-1")

def _logo_path():
    """frontend/dist/logo.png (build copies it) or frontend/public/logo.png (source)."""
    try:
        from paths import BASE
    except ImportError:
        return None
    for sub in (("frontend", "dist"), ("frontend", "public")):
        p = BASE.joinpath(*sub, "logo.png")
        if p.exists():
            return p
    return None

def _draw_band(pdf) -> None:
    x, y, w = MARGIN, MARGIN + 2, pdf.w - 2 * MARGIN
    pdf.set_fill_color(*BAND)
    pdf.rect(x, y, w, BAND_H, style="F")
    pdf.c_margin = 0

    logo_end = x + 4
    path = _logo_path()
    drawn = False
    if path:
        try:
            from PIL import Image
            with Image.open(path) as im:
                iw, ih = im.size
            h = BAND_H - 8
            pdf.image(str(path), x=x + 4, y=y + 4, h=h)
            logo_end = x + 4 + h * iw / ih
            drawn = True
        except Exception:
            drawn = False
    if not drawn:
        pdf.set_font("Helvetica", "B", 18)
        pdf.set_text_color(*BAR_BORDER)
        pdf.set_xy(x + 4, y + (BAND_H - 9) / 2)
        tw = pdf.get_string_width("FocalPoint") + 1
        pdf.cell(tw, 9, "FocalPoint")
        logo_end = x + 4 + tw

    dx = logo_end + 6
    pdf.set_draw_color(*DIVIDER)
    pdf.set_line_width(0.4)
    pdf.line(dx, y + 4, dx, y + BAND_H - 4)

    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*NAVY)
    pdf.set_xy(dx + 6, y + (BAND_H - 6) / 2)
    pdf.cell(60, 6, "Session Report")

def _pill(pdf, x, y, w, h, color) -> None:
    pdf.set_fill_color(*color)
    w = max(w, h)
    pdf.ellipse(x, y, h, h, style="F")
    if w > h:
        pdf.ellipse(x + w - h, y, h, h, style="F")
        pdf.rect(x + h / 2, y, w - h, h, style="F")

def _draw_attendance(pdf, x, y, w, entered, max_size) -> float:
    """Label, count and progress bar. Returns the y of the bottom edge."""
    pdf.c_margin = 0
    pdf.set_text_color(*NAVY)
    pdf.set_font("Helvetica", "B", 10)
    label = "Attendance:"
    lw = pdf.get_string_width(label) + 4
    pdf.set_xy(x, y)
    pdf.cell(lw, 6, label)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(w - lw, 6, f"{entered}/{max_size}" if max_size else str(entered))
    if not max_size:
        return y + 6

    bar_y, bar_h, inset = y + 9, 9, 0.7
    _pill(pdf, x, bar_y, w, bar_h, BAR_BORDER)
    _pill(pdf, x + inset, bar_y + inset, w - 2 * inset, bar_h - 2 * inset, WHITE)
    if entered > 0:
        inner_w = w - 2 * inset
        fill_w = max(min(entered / max_size, 1.0) * inner_w, bar_h - 2 * inset)
        _pill(pdf, x + inset, bar_y + inset, fill_w, bar_h - 2 * inset, BAR_FILL)
    return bar_y + bar_h

def _draw_table_header(pdf, columns, widths) -> None:
    pdf.c_margin = 3
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*NAVY)
    pdf.set_fill_color(*BAND)
    pdf.set_x(MARGIN)
    for title, w in zip(columns, widths):
        pdf.cell(w, ROW_H + 0.5, _fit(pdf, title, w - 4), fill=True)
    pdf.ln(ROW_H + 0.5)
    pdf.set_font("Helvetica", "", 10)

def pdf_from_table(columns, rows, field_count=0, max_size=None) -> bytes:
    """Session report: banner, details, attendance bar and a Time Stamp/Status/User Input table.

    columns/rows use the layout from _build_table:
    Date, Time Stamp, Status, <user inputs...>, <session fields...>.
    field_count is how many trailing columns are session fields.
    max_size is the room size. Without it the attendance shows a count and no bar.
    """
    from fpdf import FPDF

    field_count = max(0, min(int(field_count or 0), len(columns) - 4))
    n_inputs = len(columns) - 3 - field_count
    input_end = 3 + n_inputs

    # Session fields repeat on every row, so the first row holds their values.
    field_names = list(columns[input_end:])
    field_vals = list(rows[0][input_end:]) if rows else [""] * len(field_names)
    date = rows[0][0] if rows else ""
    if rows and rows[-1][0] != rows[0][0]:
        date = f"{rows[0][0]} - {rows[-1][0]}"
    header = [("Date", date), *zip(field_names, field_vals)]
    if max_size is not None:
        header.append(("Max Size", max_size))

    def person(r):
        return tuple(" ".join(str(v).split()).casefold() for v in r[3:input_end])

    # Group each person's rows together, in order of first appearance.
    groups: dict[tuple, list] = {}
    for r in rows:
        groups.setdefault(person(r), []).append(r)
    # One Entered row (first join) and, if they ended up leaving, one Left row (final exit).
    grouped = []
    for g in groups.values():
        grouped.append(g[0])
        if len(g) > 1 and g[-1][2] == "Left":
            grouped.append(g[-1])

    table_cols = [columns[1], columns[2], *columns[3:input_end]]
    table_rows = [[r[1], r[2], *r[3:input_end]] for r in grouped]

    # Unique first-time joiners. A rejoin with the same name counts once.
    entered = len({person(r) for r in rows if r[2] == "Entered"})

    pdf = FPDF(orientation="L", format="Letter")
    pdf.set_margins(MARGIN, MARGIN + 2, MARGIN)
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()
    usable = pdf.w - 2 * MARGIN

    _draw_band(pdf)

    top = MARGIN + 2 + BAND_H + 8
    pdf.c_margin = 0
    pdf.set_font("Helvetica", "B", 10)
    label_w = max(pdf.get_string_width(f"{l}:") for l, _ in header) + 4
    left_w = 90
    line_h = 5.5
    y = top
    for label, value in header:
        pdf.set_text_color(*NAVY)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_xy(MARGIN, y)
        pdf.cell(label_w, line_h, _safe(f"{label}:"))
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(left_w - label_w, line_h, _fit(pdf, value, left_w - label_w))
        y += line_h
    info_bottom = y

    att_x = MARGIN + left_w + 10
    bar_bottom = _draw_attendance(
        pdf, att_x, top, pdf.w - MARGIN - att_x, entered,
        int(max_size) if max_size else None,
    )

    pdf.set_y(max(info_bottom, bar_bottom) + 8)
    fixed = [45, 40]
    rest = (usable - sum(fixed)) / max(len(table_cols) - 2, 1)
    widths = fixed + [rest] * (len(table_cols) - 2)

    _draw_table_header(pdf, table_cols, widths)
    for idx, row in enumerate(table_rows):
        if pdf.get_y() + ROW_H > pdf.h - pdf.b_margin:
            pdf.add_page()
            _draw_table_header(pdf, table_cols, widths)
        pdf.c_margin = 3
        pdf.set_text_color(*NAVY)
        pdf.set_fill_color(*BAND)
        pdf.set_x(MARGIN)
        for text, w in zip(row, widths):
            pdf.cell(w, ROW_H, _fit(pdf, text, w - 4), fill=(idx % 2 == 1))
        pdf.ln(ROW_H)

    output = pdf.output()
    if isinstance(output, str):
        return output.encode("latin-1")
    return bytes(output)

def to_csv_bytes(labels=None, fields=None) -> str:
    return csv_from_table(*_build_table(labels, fields))

def to_pdf_bytes(labels=None, fields=None, max_size=None) -> bytes:
    columns, rows = _build_table(labels, fields)
    return pdf_from_table(columns, rows, field_count=len(fields or []), max_size=max_size)