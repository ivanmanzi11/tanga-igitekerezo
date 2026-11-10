"""Report generation in CSV, Excel, or Word — analytics, a single case, or a
full case list. Admin2 ADM_03 asks for a choice of download format."""

import csv
import io

from django.db.models import Q
from django.http import HttpResponse

from .models import Submission


def scoped_queryset(user):
    """The same visibility rule used by the submissions API: admins see
    everything, department heads see their department, officers see what's
    assigned to them or their department."""
    from common.visibility import visible_submissions
    qs = Submission.objects.select_related("category", "department").all()
    return visible_submissions(user, qs)


CASE_HEADERS = ["Tracking Code", "Title", "Category", "Department", "Type", "Status", "Priority", "Created", "Resolved", "Closed"]


def _case_rows(queryset):
    for s in queryset:
        yield [
            s.tracking_code, s.title, s.category.name if s.category else "",
            s.department.name if s.department else "", s.submission_type, s.status,
            s.priority, str(s.created_at), str(s.resolved_at or ""), str(s.closed_at or ""),
        ]


def cases_csv(queryset, filename="cases_report.csv"):
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    writer = csv.writer(response)
    writer.writerow(CASE_HEADERS)
    for row in _case_rows(queryset):
        writer.writerow(row)
    return response


def cases_xlsx(queryset, filename="cases_report.xlsx"):
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "Cases"
    ws.append(CASE_HEADERS)
    for row in _case_rows(queryset):
        ws.append(row)
    widths = {"A": 18, "B": 40, "C": 18, "D": 22, "E": 14, "F": 16, "G": 12, "H": 24, "I": 24, "J": 24}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w
    _style_sheet(ws)
    ws.auto_filter.ref = ws.dimensions

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    response = HttpResponse(buf.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def cases_docx(queryset, filename="cases_report.docx"):
    from docx import Document

    doc = Document()
    doc.add_heading("Tanga Igitekerezo — Cases Report", level=1)
    table = doc.add_table(rows=1, cols=len(CASE_HEADERS))
    table.style = "Light Grid Accent 1"
    for i, h in enumerate(CASE_HEADERS):
        table.rows[0].cells[i].text = h
    for row in _case_rows(queryset):
        cells = table.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = str(v)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    response = HttpResponse(buf.read(), content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


# General2 ADM_03: only PDF and Excel are offered/accepted as export formats;
# CSV and Word have been removed from the options.
ALLOWED_EXPORT_FORMATS = {"pdf", "xlsx"}


def cases_report(queryset, fmt, basename="cases_report", period=None):
    if fmt == "xlsx":
        return cases_xlsx(queryset, f"{basename}.xlsx")
    from . import pdf_reports
    return pdf_reports.cases_list_pdf(queryset, period=period)


def _style_sheet(ws, header_row=1, widths=None):
    """General2 GEN_01: Excel exports get a branded header row, borders, wrapped
    left-aligned cells and a frozen header so they read like a designed report."""
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

    fill = PatternFill("solid", fgColor="1F4B43")
    thin = Side(style="thin", color="D8D2BF")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    for cell in ws[header_row]:
        if cell.value is None:
            continue
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = fill
        cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
    for row in ws.iter_rows(min_row=header_row + 1):
        for cell in row:
            if cell.value is not None:
                cell.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
                cell.border = border
    ws.freeze_panes = ws.cell(row=header_row + 1, column=1)


def _single_case_sections(submission):
    header = [
        ("Tracking Code", submission.tracking_code),
        ("Title", submission.title),
        ("Category", submission.category.name if submission.category else ""),
        ("Department", submission.department.name if submission.department else ""),
        ("Type", submission.submission_type),
        ("Status", submission.status),
        ("Priority", submission.priority),
        ("Created", str(submission.created_at)),
        ("Description", submission.description),
    ]
    history = [
        (h.old_status, h.new_status, str(h.changed_by) if h.changed_by else "System", h.note, str(h.changed_at))
        for h in submission.status_history.all()
    ]
    responses = [
        ("Case owner" if r.is_from_owner else str(r.responder or "Institution"), r.message, str(r.created_at))
        for r in submission.responses.all()
    ]
    return header, history, responses


def single_case_csv(submission):
    header, history, responses = _single_case_sections(submission)
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{submission.tracking_code}_report.csv"'
    writer = csv.writer(response)
    for k, v in header:
        writer.writerow([k, v])
    writer.writerow([])
    writer.writerow(["-- Status History --"])
    writer.writerow(["From", "To", "Changed By", "Note", "When"])
    writer.writerows(history)
    writer.writerow([])
    writer.writerow(["-- Responses --"])
    writer.writerow(["From", "Message", "When"])
    writer.writerows(responses)
    return response


def single_case_xlsx(submission):
    from openpyxl import Workbook
    from openpyxl.styles import Font

    header, history, responses = _single_case_sections(submission)
    wb = Workbook()
    ws = wb.active
    ws.title = "Case"
    for k, v in header:
        ws.append([k, v])
    ws["A1"].font = Font(bold=True)
    ws.append([])
    ws.append(["Status History"])
    ws[f"A{ws.max_row}"].font = Font(bold=True)
    ws.append(["From", "To", "Changed By", "Note", "When"])
    for row in history:
        ws.append(list(row))
    ws.append([])
    ws.append(["Responses"])
    ws[f"A{ws.max_row}"].font = Font(bold=True)
    ws.append(["From", "Message", "When"])
    for row in responses:
        ws.append(list(row))
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = 28
    ws.column_dimensions["B"].width = 50
    from openpyxl.styles import Alignment
    for row in ws.iter_rows():
        for cell in row:
            cell.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    response = HttpResponse(buf.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    response["Content-Disposition"] = f'attachment; filename="{submission.tracking_code}_report.xlsx"'
    return response


def single_case_docx(submission):
    from docx import Document

    header, history, responses = _single_case_sections(submission)
    doc = Document()
    doc.add_heading(f"Case Report — {submission.tracking_code}", level=1)
    for k, v in header:
        p = doc.add_paragraph()
        p.add_run(f"{k}: ").bold = True
        p.add_run(str(v))

    doc.add_heading("Status History", level=2)
    t1 = doc.add_table(rows=1, cols=5)
    t1.style = "Light Grid Accent 1"
    for i, h in enumerate(["From", "To", "Changed By", "Note", "When"]):
        t1.rows[0].cells[i].text = h
    for row in history:
        cells = t1.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = str(v)

    doc.add_heading("Responses", level=2)
    t2 = doc.add_table(rows=1, cols=3)
    t2.style = "Light Grid Accent 1"
    for i, h in enumerate(["From", "Message", "When"]):
        t2.rows[0].cells[i].text = h
    for row in responses:
        cells = t2.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = str(v)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    response = HttpResponse(buf.read(), content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    response["Content-Disposition"] = f'attachment; filename="{submission.tracking_code}_report.docx"'
    return response


def single_case_report(submission, fmt):
    if fmt == "xlsx":
        return single_case_xlsx(submission)
    from . import pdf_reports
    return pdf_reports.single_case_pdf(submission)


def analytics_xlsx(data, filename="analytics_report.xlsx"):
    from openpyxl import Workbook
    from openpyxl.styles import Font

    wb = Workbook()
    ws = wb.active
    ws.title = "Analytics"
    ws.append(["Metric", "Value"])
    ws.append(["Total submissions", data["total_submissions"]])
    ws.append(["Unresolved", data["unresolved"]])
    ws.append(["Average resolution time (hrs)", "—" if data["average_response_time_hours"] is None else data["average_response_time_hours"]])
    for section, key, label in [
        ("By category", "by_category", "category__name"),
        ("By department", "by_department", "department__name"),
        ("By status", "by_status", "status"),
    ]:
        ws.append([])
        ws.append([section])
        ws[f"A{ws.max_row}"].font = Font(bold=True)
        ws.append([label, "Count"])
        for row in data[key]:
            ws.append([row[label], row["count"]])
    ws.column_dimensions["A"].width = 38
    ws.column_dimensions["B"].width = 16
    _style_sheet(ws)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    response = HttpResponse(buf.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def analytics_docx(data, filename="analytics_report.docx"):
    from docx import Document

    doc = Document()
    doc.add_heading("Tanga Igitekerezo — Analytics Report", level=1)
    doc.add_paragraph(f"Total submissions: {data['total_submissions']}")
    doc.add_paragraph(f"Unresolved: {data['unresolved']}")
    doc.add_paragraph(f"Average resolution time (hrs): {data['average_response_time_hours'] or '—'}")
    for section, key, label in [
        ("By category", "by_category", "category__name"),
        ("By department", "by_department", "department__name"),
        ("By status", "by_status", "status"),
    ]:
        doc.add_heading(section, level=2)
        t = doc.add_table(rows=1, cols=2)
        t.style = "Light Grid Accent 1"
        t.rows[0].cells[0].text = label
        t.rows[0].cells[1].text = "Count"
        for row in data[key]:
            cells = t.add_row().cells
            cells[0].text = str(row[label])
            cells[1].text = str(row["count"])

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    response = HttpResponse(buf.read(), content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
