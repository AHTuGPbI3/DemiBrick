"""
LDraw (.ldr) exporter for 3D brick models.
Maps Bambu Lab hex colors to the nearest LDraw color code.
"""

from typing import Any
import numpy as np

# ── LDraw color palette (code → hex) ──────────────────────────────────────────
# Common LDraw colors used in BrickLink / Studio
_LDRAW_COLORS: list[tuple[int, str]] = [
    (0,  "#05131D"),   # Black
    (1,  "#0055BF"),   # Blue
    (2,  "#257A3E"),   # Green
    (3,  "#00838F"),   # Dark Turquoise
    (4,  "#C91A09"),   # Red
    (5,  "#C870A0"),   # Dark Pink
    (6,  "#583927"),   # Brown
    (7,  "#9BA19D"),   # Light Gray
    (8,  "#6D6E5C"),   # Dark Gray
    (9,  "#B4D2E3"),   # Light Blue
    (10, "#4B9F4A"),   # Bright Green
    (11, "#55A5AF"),   # Medium Turquoise
    (12, "#F2705E"),   # Salmon
    (13, "#FC97AC"),   # Pink
    (14, "#F2CD37"),   # Yellow
    (15, "#FFFFFF"),   # White
    (17, "#C9E788"),   # Light Green
    (18, "#FAC80A"),   # Tan
    (19, "#E4CD9E"),   # Buff
    (22, "#81007B"),   # Purple
    (23, "#2032B0"),   # Dark Blue
    (24, "#F5CD2F"),   # Yellow (bright)
    (25, "#FE8A18"),   # Orange
    (26, "#923978"),   # Magenta
    (27, "#BBE90B"),   # Lime
    (28, "#958A73"),   # Dark Tan
    (29, "#E4ADC8"),   # Salmon (light)
    (68, "#F3CF9B"),   # Very Light Orange
    (69, "#CD6298"),   # Medium Dark Pink
    (70, "#58270B"),   # Reddish Brown
    (71, "#9B9B9B"),   # Light Bluish Gray
    (72, "#6C6E68"),   # Dark Bluish Gray
    (73, "#A0BCAC"),   # Medium Blue
    (74, "#C4E3B0"),   # Medium Green
    (77, "#FECCCF"),   # Light Pink
    (78, "#FEC89C"),   # Light Nougat
    (84, "#CC702A"),   # Medium Nougat
    (85, "#3F3691"),   # Medium Lilac
    (86, "#7C503A"),   # Dark Flesh
    (87, "#6B5A5A"),   # Dark Brown (alt)
    (92, "#D09168"),   # Nougat
    (100, "#FEBABD"),  # Light Salmon
    (110, "#1C58A7"),  # Bright Blue
    (112, "#6874CA"),  # Medium Violet
    (115, "#C7D23C"),  # Medium Lime
    (116, "#55A5AF"),  # Medium Turquoise (alt)
    (118, "#AEE9EF"),  # Light Turquoise
    (119, "#DFEEA5"),  # Lime Green (light)
    (120, "#D9E4A7"),  # Light Lime
    (124, "#9C0046"),  # Bright Red Dark
    (151, "#A5A9B4"),  # Sand Blue
    (191, "#F8BB3D"),  # Flame Yellowish Orange
    (212, "#9FC3E9"),  # Light Royal Blue
    (216, "#872B17"),  # Rust
    (226, "#FFF03A"),  # Cool Yellow
    (272, "#193044"),  # Dark Blue (navy)
    (288, "#1E5916"),  # Forest Green
    (294, "#FFFDE0"),  # Glow In Dark
    (308, "#352100"),  # Dark Brown
    (320, "#720E0F"),  # Dark Red
    (321, "#469BC3"),  # Dark Azure
    (322, "#68C3E2"),  # Medium Azure
    (323, "#D3F2EA"),  # Aqua
    (324, "#F75C5C"),  # Medium Red
    (326, "#E2F99A"),  # Spring Yellowish Green
    (329, "#FFFFFF"),  # White (alt)
    (330, "#77774E"),  # Olive Green
    (334, "#BBA53D"),  # Pearl Gold
    (335, "#C9CAC9"),  # Sand Red
    (351, "#F5C5C2"),  # Medium Dark Salmon
    (353, "#F45C40"),  # Coral
    (366, "#CF8A47"),  # Earth Orange
    (373, "#6B629B"),  # Sand Purple
    (375, "#C1C2C1"),  # Metal Silver
    (378, "#798E77"),  # Sand Green
    (379, "#6E7F8D"),  # Sand Blue Dark
]

# Build RGB lookup arrays
_LD_CODES  = np.array([c for c, _ in _LDRAW_COLORS], dtype=np.int32)
_LD_RGB    = np.array(
    [[int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)]
     for _, h in _LDRAW_COLORS],
    dtype=np.float32,
)

# LDraw part file names for known brick sizes  {(w, d, h): part_file}
_PART_FILES: dict[tuple, str] = {
    # Plates (h=1)
    (1, 1, 1): "3024.dat",
    (1, 2, 1): "3023.dat",
    (2, 1, 1): "3023.dat",   # rotated 90°
    (1, 3, 1): "3623.dat",
    (3, 1, 1): "3623.dat",
    (1, 4, 1): "3710.dat",
    (4, 1, 1): "3710.dat",
    (1, 6, 1): "3666.dat",
    (6, 1, 1): "3666.dat",
    (1, 8, 1): "3460.dat",
    (8, 1, 1): "3460.dat",
    (2, 2, 1): "3022.dat",
    (2, 3, 1): "3021.dat",
    (3, 2, 1): "3021.dat",
    (2, 4, 1): "3020.dat",
    (4, 2, 1): "3020.dat",
    (2, 6, 1): "3795.dat",
    (6, 2, 1): "3795.dat",
    (2, 8, 1): "3034.dat",
    (8, 2, 1): "3034.dat",
    # Bricks (h=3)
    (1, 1, 3): "3005.dat",
    (1, 2, 3): "3004.dat",
    (2, 1, 3): "3004.dat",
    (1, 3, 3): "3622.dat",
    (3, 1, 3): "3622.dat",
    (1, 4, 3): "3010.dat",
    (4, 1, 3): "3010.dat",
    (1, 6, 3): "3009.dat",
    (6, 1, 3): "3009.dat",
    (2, 2, 3): "3003.dat",
    (2, 3, 3): "3002.dat",
    (3, 2, 3): "3002.dat",
    (2, 4, 3): "3001.dat",
    (4, 2, 3): "3001.dat",
    (2, 6, 3): "2456.dat",
    (6, 2, 3): "2456.dat",
}

# LDraw unit = 0.4 mm → 1 stud = 20 LDU, 1 plate = 8 LDU, 1 brick = 24 LDU
_STUD_LDU  = 20
_PLATE_LDU = 8


def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _nearest_ldraw_color(hex_color: str) -> int:
    """Map a hex color to the nearest LDraw color code."""
    r, g, b = _hex_to_rgb(hex_color)
    rgb = np.array([[r, g, b]], dtype=np.float32)
    dists = np.sum((rgb - _LD_RGB) ** 2, axis=1)
    return int(_LD_CODES[np.argmin(dists)])


def export_ldraw(bricks: list[dict[str, Any]], title: str = "DemiBrick Model") -> str:
    """
    Convert a list of brick dicts (from brick_optimizer_3d) to LDraw .ldr text.

    Coordinate system:
      LDraw X = stud column × 20 LDU
      LDraw Y = –(z_floor × 8 LDU)   (LDraw Y is inverted)
      LDraw Z = stud row × 20 LDU
    Rotation: identity (1 0 0 / 0 1 0 / 0 0 1) for axis-aligned bricks.
    """
    lines = [
        f"0 {title}",
        "0 Name: demibrick_model.ldr",
        "0 Author: DemiBrick",
        "0 !LEGOCY Compatible LDraw model generated by DemiBrick",
        "",
    ]

    for b in bricks:
        w = b.get("w", 1)
        d = b.get("d", 1)
        h = b.get("h", 1)
        x_stud = b.get("x", 0)
        y_stud = b.get("y", 0)
        z_floor = b.get("z_floor", 0)

        # Center offset (LDraw brick origin is at center bottom)
        lx = (x_stud + w / 2) * _STUD_LDU
        ly = -(z_floor * _PLATE_LDU)  # LDraw Y up = inverted in our grid
        lz = (y_stud + d / 2) * _STUD_LDU

        color_code = _nearest_ldraw_color(b.get("color_hex", "#888888"))

        # Determine rotation: if w×d in the part file, identity; if rotated 90°, apply rotation
        part_key = (w, d, h)
        part_file = _PART_FILES.get(part_key)
        if part_file:
            rot = "1 0 0 0 1 0 0 0 1"
        else:
            # Try swapped orientation
            part_file = _PART_FILES.get((d, w, h))
            if part_file:
                rot = "0 0 1 0 1 0 -1 0 0"  # rotate 90° around Y
            else:
                # Fallback to 1×1 plate
                part_file = "3024.dat"
                rot = "1 0 0 0 1 0 0 0 1"

        lines.append(
            f"1 {color_code} "
            f"{lx:.1f} {ly:.1f} {lz:.1f} "
            f"{rot} "
            f"{part_file}"
        )

    lines.append("0 // End of model")
    return "\n".join(lines)
