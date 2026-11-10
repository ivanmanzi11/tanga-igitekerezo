"""
PDF report generation styled after the institutional case-report reference
provided (letterhead, boxed metadata row, blue rule, structured tables).

Branding note: we use Tanga Igitekerezo's own name and the national coat of
arms — not a specific ministry's letterhead — since this system isn't
actually operated by that ministry. The visual structure (badges row, blue
divider, boxed tables) is what's replicated; the wording is our own.
"""

import io
import os

from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable,
)

ASSET_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")
COAT_OF_ARMS = os.path.join(ASSET_DIR, "coat_of_arms.png")

INK = colors.HexColor("#16241f")
HILLS = colors.HexColor("#1f4b43")
GOLD = colors.HexColor("#b8863a")
LINE = colors.HexColor("#d8d2bf")
PAPER = colors.HexColor("#f2efe4")

styles = getSampleStyleSheet()
STYLE_TITLE = ParagraphStyle("TIHeading", parent=styles["Heading1"], textColor=HILLS, fontSize=16, spaceAfter=2)
STYLE_SUB = ParagraphStyle("TISub", parent=styles["Normal"], textColor=colors.HexColor("#5a5445"), fontSize=9)
STYLE_BODY = ParagraphStyle("TIBody", parent=styles["Normal"], fontSize=9.5, leading=13)
STYLE_LABEL = ParagraphStyle("TILabel", parent=styles["Normal"], fontSize=7.5, textColor=colors.HexColor("#6b6250"))


def _letterhead(flowables, subtitle):
    if os.path.exists(COAT_OF_ARMS):
        img = Image(COAT_OF_ARMS, width=1.4 * cm, height=1.53 * cm)
        header_table = Table(
            [[img, Paragraph("TANGA IGITEKEREZO<br/>" + subtitle, STYLE_TITLE)]],
            colWidths=[1.8 * cm, None],
        )
        header_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (0, 0), 0),
        ]))
        flowables.append(header_table)
    else:
        flowables.append(Paragraph("TANGA IGITEKEREZO", STYLE_TITLE))
        flowables.append(Paragraph(subtitle, STYLE_SUB))
    flowables.append(Spacer(1, 8))
    flowables.append(HRFlowable(width="100%", thickness=1.4, color=HILLS))
    flowables.append(Spacer(1, 10))


def _badge_row(pairs):
    """A row of boxed metadata badges, like 'Created on / Reported on / Category / Status'."""
    cells = []
    for label, value in pairs:
        cells.append(Paragraph(f"<font size=7 color='#6b6250'>{label}</font><br/><b>{value}</b>", STYLE_BODY))
    t = Table([cells], colWidths=[PAGE_WIDTH / len(cells)] * len(cells), hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, LINE),
        ("BACKGROUND", (0, 0), (-1, -1), PAPER),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


PAGE_WIDTH = A4[0] - 3.6 * cm  # usable width between the 1.8 cm margins
STYLE_CELL = ParagraphStyle("TICell", parent=styles["Normal"], fontSize=8.5, leading=11)
STYLE_HEAD = ParagraphStyle("TIHead", parent=styles["Normal"], fontSize=8.5, leading=11,
                            textColor=colors.white, fontName="Helvetica-Bold")


def _cell(value, style=STYLE_CELL):
    """Wrap text so long values wrap inside their column instead of overflowing."""
    if isinstance(value, Paragraph):
        return value
    from xml.sax.saxutils import escape
    return Paragraph(escape(str(value)), style)


def _fit_widths(col_widths, n):
    """General2 GEN_01: tables always span the full text width and start at the
    left margin. Missing widths share the remaining space equally."""
    if not col_widths:
        return [PAGE_WIDTH / n] * n
    fixed = sum(w for w in col_widths if w is not None)
    free = [w for w in col_widths if w is None]
    share = max(PAGE_WIDTH - fixed, 2 * cm) / len(free) if free else 0
    widths = [w if w is not None else share for w in col_widths]
    total = sum(widths)
    return [w * PAGE_WIDTH / total for w in widths] if abs(total - PAGE_WIDTH) > 1 else widths


def _section_table(title, header, rows, col_widths=None):
    flow = []
    flow.append(Paragraph(f"<b><font color='#1f4b43' size=11>{title}</font></b>", STYLE_BODY))
    flow.append(Spacer(1, 4))
    n = len(header)
    body = rows if rows else [["—"] * n]
    data = [[_cell(h, STYLE_HEAD) for h in header]] + [[_cell(c) for c in r] for r in body]
    t = Table(data, colWidths=_fit_widths(col_widths, n), repeatRows=1, hAlign="LEFT")
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), HILLS),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#f6f4ec")))
    t.setStyle(TableStyle(style))
    flow.append(t)
    flow.append(Spacer(1, 16))
    return flow


def _footer(canvas, doc):
    """Page footer: system name on the left, page number on the right."""
    from django.utils import timezone
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(doc.leftMargin, 1.25 * cm, A4[0] - doc.rightMargin, 1.25 * cm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#6b6250"))
    canvas.drawString(doc.leftMargin, 0.85 * cm, f"Tanga Igitekerezo · generated {timezone.now().strftime('%d %b %Y %H:%M')}")
    canvas.drawRightString(A4[0] - doc.rightMargin, 0.85 * cm, f"Page {doc.page}")
    canvas.restoreState()


def _pretty(value):
    return (value or "—").replace("_", " ").title()


def single_case_pdf(submission):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.6 * cm, bottomMargin=1.6 * cm, leftMargin=1.8 * cm, rightMargin=1.8 * cm)
    flow = []
    _letterhead(flow, "Case Report")

    flow.append(_badge_row([
        ("Tracking code", submission.tracking_code),
        ("Reported on", submission.created_at.strftime("%a, %d %b %Y")),
        ("Category", submission.category.name if submission.category else "—"),
        ("Status", submission.status.replace("_", " ").upper()),
    ]))
    flow.append(Spacer(1, 14))

    from xml.sax.saxutils import escape
    flow.append(Paragraph("<b>Title:</b> " + escape(submission.title), STYLE_BODY))
    flow.append(Spacer(1, 6))
    flow.append(Paragraph("<b>Description:</b>", STYLE_BODY))
    flow.append(Paragraph(escape(submission.description or "—").replace("\n", "<br/>"), STYLE_BODY))
    flow.append(Spacer(1, 14))

    flow.extend(_section_table(
        "Case Details", ["N°", "Type", "Department", "Priority"],
        [[
            "1",
            _pretty(submission.submission_type),
            submission.department.name if submission.department else "—",
            _pretty(submission.priority),
        ]],
        col_widths=[1.4 * cm, 4 * cm, None, 3 * cm],
    ))

    history_rows = [
        [_pretty(h.old_status), _pretty(h.new_status), str(h.changed_by) if h.changed_by else "System",
         h.changed_at.strftime("%d %b %Y %H:%M")]
        for h in submission.status_history.all()
    ]
    flow.extend(_section_table("Status History", ["From", "To", "By", "When"], history_rows,
                               col_widths=[3.4 * cm, 3.4 * cm, None, 3.6 * cm]))

    response_rows = [
        [
            "Case owner" if r.is_from_owner else str(r.responder or "Institution"),
            r.message,
            r.created_at.strftime("%d %b %Y %H:%M"),
        ]
        for r in submission.responses.all()
    ]
    flow.extend(_section_table("Conversation", ["From", "Message", "When"], response_rows,
                               col_widths=[3.4 * cm, None, 3.6 * cm]))

    doc.build(flow, onFirstPage=_footer, onLaterPages=_footer)
    buf.seek(0)
    response = HttpResponse(buf.read(), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{submission.tracking_code}_report.pdf"'
    return response


def cases_list_pdf(queryset, title="Cases Report", period=None):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.6 * cm, bottomMargin=1.6 * cm, leftMargin=1.8 * cm, rightMargin=1.8 * cm)
    flow = []
    _letterhead(flow, title)

    from django.utils import timezone
    badges = [
        ("Generated on", timezone.now().strftime("%a, %d %b %Y %H:%M")),
        ("Total cases", str(queryset.count())),
    ]
    if period:
        badges.insert(1, ("Period", period))
    flow.append(_badge_row(badges))
    flow.append(Spacer(1, 14))

    rows = [
        [
            s.tracking_code, s.title, s.category.name if s.category else "—",
            s.department.name if s.department else "—", _pretty(s.status),
            s.created_at.strftime("%d %b %Y"),
        ]
        for s in queryset
    ]
    flow.extend(_section_table(
        "Cases", ["Tracking Code", "Title", "Category", "Department", "Status", "Received"], rows,
        col_widths=[2.7 * cm, None, 2.5 * cm, 2.8 * cm, 2.3 * cm, 2.2 * cm],
    ))

    doc.build(flow, onFirstPage=_footer, onLaterPages=_footer)
    buf.seek(0)
    response = HttpResponse(buf.read(), content_type="application/pdf")
    response["Content-Disposition"] = 'attachment; filename="cases_report.pdf"'
    return response


def analytics_pdf(data, title="Analytics Report", period=None):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.6 * cm, bottomMargin=1.6 * cm, leftMargin=1.8 * cm, rightMargin=1.8 * cm)
    flow = []
    _letterhead(flow, title)

    flow.append(_badge_row([
        ("Total submissions", str(data["total_submissions"])),
        ("Unresolved", str(data["unresolved"])),
        ("Avg. resolution (hrs)", "—" if data["average_response_time_hours"] is None else str(data["average_response_time_hours"])),
    ] + ([("Period", period)] if period else [])))
    flow.append(Spacer(1, 14))

    for section, key, label in [
        ("By Category", "by_category", "category__name"),
        ("By Department", "by_department", "department__name"),
        ("By Status", "by_status", "status"),
    ]:
        rows = [[_pretty(str(r[label])) if key == "by_status" else str(r[label]), str(r["count"])] for r in data[key]]
        flow.extend(_section_table(section, [label.replace("__name", "").title(), "Count"], rows, col_widths=[None, 3 * cm]))

    doc.build(flow, onFirstPage=_footer, onLaterPages=_footer)
    buf.seek(0)
    response = HttpResponse(buf.read(), content_type="application/pdf")
    response["Content-Disposition"] = 'attachment; filename="analytics_report.pdf"'
    return response
