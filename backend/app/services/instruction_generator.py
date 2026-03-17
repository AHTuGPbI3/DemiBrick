"""
PDF build instructions generator — LEGO-style layout using ReportLab.
"""

import io
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT


def _hex_to_rgb_fraction(hex_color: str) -> tuple[float, float, float]:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return r / 255, g / 255, b / 255


def generate_pdf(
    bom: list[dict[str, Any]],
    dimensions: dict[str, int],
    total_studs: int,
    total_bricks: int,
    optimization_ratio: float,
) -> bytes:
    """
    Generate PDF build instructions.
    Returns raw PDF bytes.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=20 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    yellow = colors.HexColor("#FFD700")
    dark   = colors.HexColor("#1A1A2E")

    title_style = ParagraphStyle(
        "DemiBrickTitle",
        parent=styles["Title"],
        fontSize=28,
        textColor=dark,
        spaceAfter=4 * mm,
    )
    sub_style = ParagraphStyle(
        "DemiBrickSub",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#555555"),
        alignment=TA_CENTER,
        spaceAfter=6 * mm,
    )
    heading_style = ParagraphStyle(
        "DemiBrickH2",
        parent=styles["Heading2"],
        textColor=dark,
        fontSize=14,
        spaceBefore=6 * mm,
        spaceAfter=3 * mm,
    )
    body_style = ParagraphStyle(
        "DemiBrickBody",
        parent=styles["Normal"],
        fontSize=10,
        textColor=dark,
    )

    story = []

    # ── Cover ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph("🧱 DemiBrick", title_style))
    story.append(Paragraph("Build Instructions", sub_style))
    story.append(HRFlowable(width="100%", thickness=2, color=yellow, spaceAfter=6 * mm))

    # Stats summary
    stats = [
        ["Mosaic size",     f"{dimensions['w']} × {dimensions['h']} studs"],
        ["Total studs",     f"{total_studs:,}"],
        ["Bricks needed",   f"{total_bricks:,}"],
        ["Optimization",    f"{optimization_ratio}×  (vs all 1×1)"],
        ["Unique colours",  str(len({b['color_id'] for b in bom}))],
    ]
    stats_table = Table(stats, colWidths=[60 * mm, 80 * mm])
    stats_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F5F5F5")),
        ("TEXTCOLOR",  (0, 0), (0, -1), dark),
        ("FONTNAME",   (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#FAFAFA")]),
        ("GRID",       (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(
        "LEGO® is a trademark of the LEGO Group. DemiBrick is not affiliated with the LEGO Group.",
        ParagraphStyle("disclaimer", parent=styles["Normal"], fontSize=7,
                       textColor=colors.HexColor("#AAAAAA"), alignment=TA_CENTER),
    ))

    # ── Bill of Materials ─────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("Bill of Materials", heading_style))
    story.append(HRFlowable(width="100%", thickness=1, color=yellow, spaceAfter=4 * mm))

    bom_data = [["", "Part #", "Name", "Colour", "Qty"]]
    for entry in bom:
        r, g, b_frac = _hex_to_rgb_fraction(entry["hex"])
        swatch = f'<font color="#{entry["hex"].lstrip("#")}">■</font>'
        bom_data.append([
            swatch,
            entry["part"],
            entry["name"],
            entry["color_name"],
            str(entry["count"]),
        ])

    bom_table = Table(bom_data, colWidths=[8 * mm, 18 * mm, 38 * mm, 52 * mm, 14 * mm])
    bom_style = TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0),  dark),
        ("TEXTCOLOR",    (0, 0), (-1, 0),  colors.white),
        ("FONTNAME",     (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, colors.HexColor("#F8F8F8")]),
        ("GRID",         (0, 0), (-1, -1), 0.3, colors.HexColor("#DDDDDD")),
        ("ALIGN",        (-1, 0), (-1, -1), "RIGHT"),
        ("LEFTPADDING",  (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING",   (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 3),
    ])
    bom_table.setStyle(bom_style)
    story.append(bom_table)

    # ── Tips ──────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph("Building Tips", heading_style))
    tips = [
        "Sort your bricks by colour and size before you start.",
        "Build row by row, left to right, starting from the bottom.",
        "Use a flat baseplate as your foundation.",
        "The BOM above lists exact quantities — order 10% extra for safety.",
    ]
    for tip in tips:
        story.append(Paragraph(f"• {tip}", body_style))
        story.append(Spacer(1, 1 * mm))

    doc.build(story)
    return buf.getvalue()
