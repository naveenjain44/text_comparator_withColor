"""Offline PDF report generator using ReportLab (no network)."""
from __future__ import annotations

import io
from typing import Dict

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
)

STATUS_COLORS = {
    "match": colors.HexColor("#10b981"),
    "warning": colors.HexColor("#f59e0b"),
    "mismatch": colors.HexColor("#ef4444"),
}


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle(name="H1x", parent=ss["Heading1"], fontSize=18, spaceAfter=10, textColor=colors.HexColor("#111")))
    ss.add(ParagraphStyle(name="H2x", parent=ss["Heading2"], fontSize=13, spaceAfter=6, textColor=colors.HexColor("#111")))
    ss.add(ParagraphStyle(name="Bodyx", parent=ss["BodyText"], fontSize=9, leading=12))
    ss.add(ParagraphStyle(name="Monox", parent=ss["BodyText"], fontName="Courier", fontSize=8, leading=11))
    return ss


def _badge(status: str, ss) -> Paragraph:
    color = STATUS_COLORS.get(status, colors.grey).hexval()[2:]
    return Paragraph(f'<font color="#{color}"><b>{status.upper()}</b></font>', ss["Bodyx"])


def _kv_table(rows, ss):
    data = []
    for label, mock, out, status in rows:
        data.append([
            Paragraph(f"<b>{label}</b>", ss["Bodyx"]),
            Paragraph((mock or "—").replace("\n", "<br/>"), ss["Bodyx"]),
            Paragraph((out or "—").replace("\n", "<br/>"), ss["Bodyx"]),
            _badge(status, ss),
        ])
    tbl = Table(data, colWidths=[28*mm, 65*mm, 65*mm, 22*mm], repeatRows=0)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4f4f5")),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d4d4d8")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return tbl


def generate_pdf(report: Dict, mockup_name: str, output_name: str) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
    ss = _styles()
    story = []

    story.append(Paragraph("UAT Comparison Report", ss["H1x"]))
    story.append(Paragraph(f"<b>Mockup:</b> {mockup_name} &nbsp;&nbsp; <b>Output:</b> {output_name}", ss["Bodyx"]))
    s = report.get("summary", {})
    story.append(Paragraph(
        f"<b>Overall:</b> {s.get('overall', '').upper()} &nbsp;|&nbsp; "
        f"<b>Score:</b> {s.get('score_percent', 0)}% &nbsp;|&nbsp; "
        f"<b>Match:</b> {s.get('match', 0)} &nbsp; "
        f"<b>Warning:</b> {s.get('warning', 0)} &nbsp; "
        f"<b>Mismatch:</b> {s.get('mismatch', 0)}",
        ss["Bodyx"]
    ))
    story.append(Spacer(1, 8))

    # Field-level rows
    field_rows = []
    for key in ("subject", "greeting", "footer"):
        f = report.get(key, {})
        field_rows.append((key.title(), f.get("mockup", ""), f.get("output", ""), f.get("status", "warning")))
    cta = report.get("cta", {})
    field_rows.append((
        "CTA",
        f"{cta.get('mockup_text','')}\n{cta.get('mockup_url','')}",
        f"{cta.get('output_text','')}\n{cta.get('output_url','')}",
        cta.get("status", "warning"),
    ))
    story.append(Paragraph("Fields", ss["H2x"]))
    story.append(_kv_table(field_rows, ss))
    story.append(Spacer(1, 10))

    # Body paragraphs
    story.append(Paragraph("Body Paragraphs", ss["H2x"]))
    body_rows = [(f"Para {i+1}", r["mockup"], r["output"], r["status"]) for i, r in enumerate(report.get("body", []))]
    if body_rows:
        story.append(_kv_table(body_rows, ss))
    else:
        story.append(Paragraph("No body paragraphs found.", ss["Bodyx"]))
    story.append(Spacer(1, 10))

    # Links
    story.append(Paragraph("Hyperlinks", ss["H2x"]))
    link_rows = [
        (f"Link {i+1}",
         f"{r['mockup_text']}\n{r['mockup_url']}",
         f"{r['output_text']}\n{r['output_url']}",
         r["status"])
        for i, r in enumerate(report.get("links", []))
    ]
    if link_rows:
        story.append(_kv_table(link_rows, ss))
    else:
        story.append(Paragraph("No hyperlinks found.", ss["Bodyx"]))
    story.append(Spacer(1, 10))

    # Images
    story.append(Paragraph("Images", ss["H2x"]))
    img_rows = [
        (f"Image {i+1}",
         f"{r['mockup_filename']}\nalt: {r['mockup_alt']}",
         f"{r['output_filename']}\nalt: {r['output_alt']}",
         r["status"])
        for i, r in enumerate(report.get("images", []))
    ]
    if img_rows:
        story.append(_kv_table(img_rows, ss))
    else:
        story.append(Paragraph("No images found.", ss["Bodyx"]))

    doc.build(story)
    return buffer.getvalue()
