"""
Pixelization service: resize image to stud grid, map to LEGO colors, render preview.
"""

import io
from typing import Any

import numpy as np
from PIL import Image, ImageDraw

from app.services.bambu_colors import get_active_palette, find_nearest_color_batch

VALID_RESOLUTIONS = (16, 32, 48, 64)


def pixelize(image: Image.Image, resolution: int) -> dict[str, Any]:
    """
    Pixelize a (background-removed) RGBA image onto a LEGO stud grid.

    Args:
        image: PIL RGBA image (alpha < 128 = transparent / skip)
        resolution: mosaic width in studs (16, 32, 48, 64)

    Returns dict:
        pixel_grid   – list[list[int|None]]   color index into LEGO_COLORS (None = transparent)
        color_map    – list[dict]             LEGO_COLORS entries used
        width_studs  – int
        height_studs – int
    """
    if resolution not in VALID_RESOLUTIONS:
        raise ValueError(f"Resolution must be one of {VALID_RESOLUTIONS}")

    # Resize to resolution×? keeping aspect ratio
    orig_w, orig_h = image.size
    height_studs = max(1, round(orig_h * resolution / orig_w))
    small = image.resize((resolution, height_studs), Image.LANCZOS).convert("RGBA")

    rgba = np.array(small, dtype=np.uint8)   # (H, W, 4)
    alpha = rgba[:, :, 3]                    # (H, W)
    rgb   = rgba[:, :, :3]                   # (H, W, 3)

    # Nearest Bambu color index for every pixel (index into active palette)
    color_indices = find_nearest_color_batch(rgb)  # (H, W)

    # Build pixel_grid (None for transparent pixels)
    h, w = color_indices.shape
    pixel_grid: list[list[int | None]] = []
    used_ids: set[int] = set()

    for row in range(h):
        grid_row: list[int | None] = []
        for col in range(w):
            if alpha[row, col] < 128:
                grid_row.append(None)
            else:
                idx = int(color_indices[row, col])
                grid_row.append(idx)
                used_ids.add(idx)
        pixel_grid.append(grid_row)

    palette = get_active_palette()
    color_map = [palette[i] for i in sorted(used_ids)]

    return {
        "pixel_grid": pixel_grid,
        "color_map": color_map,
        "width_studs": w,
        "height_studs": h,
    }


def generate_preview(
    pixel_grid: list[list[int | None]],
    scale: int = 20,
) -> Image.Image:
    """
    Render a pixel_grid as a LEGO mosaic preview image.
    Each stud = scale×scale px square with a round stud pip on top.
    """
    h = len(pixel_grid)
    w = len(pixel_grid[0]) if h else 0
    img_w = w * scale
    img_h = h * scale

    canvas = Image.new("RGBA", (img_w, img_h), (240, 240, 240, 255))
    draw = ImageDraw.Draw(canvas)

    stud_r = scale * 0.22   # stud pip radius
    stud_margin = scale * 0.15

    for row_i, row in enumerate(pixel_grid):
        for col_i, idx in enumerate(row):
            x0 = col_i * scale
            y0 = row_i * scale
            x1 = x0 + scale
            y1 = y0 + scale

            if idx is None:
                # Transparent — draw checkered background
                checker = (200, 200, 200, 255) if (row_i + col_i) % 2 == 0 else (255, 255, 255, 255)
                draw.rectangle([x0, y0, x1 - 1, y1 - 1], fill=checker)
                continue

            color = get_active_palette()[idx]
            r, g, b = color["rgb"]

            # Brick face
            draw.rectangle([x0, y0, x1 - 1, y1 - 1], fill=(r, g, b, 255))

            # Grid line (1px darker border)
            dark = (max(0, r - 30), max(0, g - 30), max(0, b - 30), 255)
            draw.rectangle([x0, y0, x1 - 1, y1 - 1], outline=dark)

            # Stud pip (circle)
            cx = x0 + scale / 2
            cy = y0 + scale / 2
            light = (min(255, r + 40), min(255, g + 40), min(255, b + 40), 255)
            draw.ellipse(
                [cx - stud_r, cy - stud_r, cx + stud_r, cy + stud_r],
                fill=light,
                outline=dark,
            )

    return canvas
