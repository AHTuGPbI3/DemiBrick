"""
Pixelization service: resize image to stud grid, map to Bambu colors, render preview.
Enhancements:
  - Saturation / contrast boost after LANCZOS downscale (compensates colour averaging)
  - Optional Floyd-Steinberg dithering in perceptual LAB space for smooth gradients
"""

import io
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance
from skimage.color import rgb2lab

from app.services.bambu_colors import (
    get_active_palette,
    find_nearest_color_batch,
    get_lab_array,
    LAB_WEIGHTS,
)

VALID_RESOLUTIONS = (16, 32, 48, 64)


# ── Floyd-Steinberg dithering ─────────────────────────────────────────────────

def _dither_pixelize(rgba: np.ndarray) -> list[list[int | None]]:
    """
    Floyd-Steinberg dithering in perceptual LAB space.
    rgba: uint8 (H, W, 4)
    Returns pixel_grid: list[list[int|None]] — palette indices, None = transparent.
    """
    palette   = get_active_palette()
    lab_array = get_lab_array()  # (M, 3) float32

    h, w  = rgba.shape[:2]
    alpha = rgba[:, :, 3]

    # Convert whole image to LAB once (fast batch operation)
    rgb_f   = rgba[:, :, :3].astype(np.float32) / 255.0
    img_lab = rgb2lab(rgb_f).astype(np.float64)        # (H, W, 3)

    result: list[list[int | None]] = []

    for y in range(h):
        row: list[int | None] = []
        for x in range(w):
            if alpha[y, x] < 128:
                row.append(None)
                continue

            pixel_lab = img_lab[y, x]                  # (3,)
            diff      = lab_array - pixel_lab           # (M, 3)
            idx       = int(np.argmin(np.sum(LAB_WEIGHTS * diff ** 2, axis=1)))
            row.append(idx)

            # Error in LAB space
            nearest_lab = lab_array[idx].astype(np.float64)
            err = pixel_lab - nearest_lab              # (3,)

            # Floyd-Steinberg distribution
            if x + 1 < w:
                img_lab[y,     x + 1] += err * (7 / 16)
            if y + 1 < h:
                if x - 1 >= 0:
                    img_lab[y + 1, x - 1] += err * (3 / 16)
                img_lab[y + 1, x]     += err * (5 / 16)
                if x + 1 < w:
                    img_lab[y + 1, x + 1] += err * (1 / 16)

        result.append(row)

    return result


# ── main pixelizer ────────────────────────────────────────────────────────────

def pixelize(
    image: Image.Image,
    resolution: int,
    dithering: bool = False,
) -> dict[str, Any]:
    """
    Pixelize a (background-removed) RGBA image onto a stud grid.

    Args:
        image:      PIL RGBA image (alpha < 128 = transparent / skip)
        resolution: mosaic width in studs (16, 32, 48, 64)
        dithering:  True = Floyd-Steinberg dithering for smoother gradients

    Returns dict:
        pixel_grid   – list[list[int|None]]   palette index (None = transparent)
        color_map    – list[dict]             palette entries used
        width_studs  – int
        height_studs – int
    """
    if resolution not in VALID_RESOLUTIONS:
        raise ValueError(f"Resolution must be one of {VALID_RESOLUTIONS}")

    # Resize to resolution×? keeping aspect ratio
    orig_w, orig_h = image.size
    height_studs   = max(1, round(orig_h * resolution / orig_w))
    small          = image.resize((resolution, height_studs), Image.LANCZOS).convert("RGBA")

    # Boost saturation & contrast — LANCZOS averaging desaturates colours
    alpha_ch  = small.split()[3]
    rgb_only  = small.convert("RGB")
    rgb_only  = ImageEnhance.Color(rgb_only).enhance(1.25)    # +25 % saturation
    rgb_only  = ImageEnhance.Contrast(rgb_only).enhance(1.1)  # +10 % contrast
    small     = Image.merge("RGBA", (*rgb_only.split(), alpha_ch))

    rgba  = np.array(small, dtype=np.uint8)    # (H, W, 4)
    alpha = rgba[:, :, 3]                      # (H, W)
    rgb   = rgba[:, :, :3]                     # (H, W, 3)

    palette = get_active_palette()

    if dithering:
        pixel_grid = _dither_pixelize(rgba)
        used_ids   = {idx for row in pixel_grid for idx in row if idx is not None}
    else:
        color_indices = find_nearest_color_batch(rgb)  # (H, W)
        h_px, w_px    = color_indices.shape
        pixel_grid    = []
        used_ids: set[int] = set()

        for row in range(h_px):
            grid_row: list[int | None] = []
            for col in range(w_px):
                if alpha[row, col] < 128:
                    grid_row.append(None)
                else:
                    idx = int(color_indices[row, col])
                    grid_row.append(idx)
                    used_ids.add(idx)
            pixel_grid.append(grid_row)

    color_map = [palette[i] for i in sorted(used_ids)]

    return {
        "pixel_grid":   pixel_grid,
        "color_map":    color_map,
        "width_studs":  len(pixel_grid[0]) if pixel_grid else 0,
        "height_studs": len(pixel_grid),
    }


# ── preview renderer ──────────────────────────────────────────────────────────

def generate_preview(
    pixel_grid: list[list[int | None]],
    scale: int = 20,
) -> Image.Image:
    """
    Render a pixel_grid as a mosaic preview image.
    Each stud = scale×scale px square with a round stud pip on top.
    """
    h = len(pixel_grid)
    w = len(pixel_grid[0]) if h else 0

    canvas = Image.new("RGBA", (w * scale, h * scale), (240, 240, 240, 255))
    draw   = ImageDraw.Draw(canvas)

    stud_r      = scale * 0.22
    palette     = get_active_palette()

    for row_i, row in enumerate(pixel_grid):
        for col_i, idx in enumerate(row):
            x0 = col_i * scale
            y0 = row_i * scale
            x1 = x0 + scale
            y1 = y0 + scale

            if idx is None:
                checker = (200, 200, 200, 255) if (row_i + col_i) % 2 == 0 else (255, 255, 255, 255)
                draw.rectangle([x0, y0, x1 - 1, y1 - 1], fill=checker)
                continue

            color = palette[idx]
            r, g, b = color["rgb"]

            draw.rectangle([x0, y0, x1 - 1, y1 - 1], fill=(r, g, b, 255))

            dark  = (max(0, r - 30), max(0, g - 30), max(0, b - 30), 255)
            draw.rectangle([x0, y0, x1 - 1, y1 - 1], outline=dark)

            cx    = x0 + scale / 2
            cy    = y0 + scale / 2
            light = (min(255, r + 40), min(255, g + 40), min(255, b + 40), 255)
            draw.ellipse(
                [cx - stud_r, cy - stud_r, cx + stud_r, cy + stud_r],
                fill=light,
                outline=dark,
            )

    return canvas
