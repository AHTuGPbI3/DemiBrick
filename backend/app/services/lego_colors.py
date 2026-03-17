"""
LEGO official color palette with CIELAB precomputed for fast nearest-color matching.
"""

import numpy as np

# fmt: off
LEGO_COLORS = [
    {"id":  1,  "name": "White",                    "hex": "#F2F3F2", "rgb": (242, 243, 242)},
    {"id":  5,  "name": "Brick Yellow",             "hex": "#E4CD9E", "rgb": (228, 205, 158)},
    {"id": 18,  "name": "Nougat",                   "hex": "#CC8E68", "rgb": (204, 142, 104)},
    {"id": 21,  "name": "Bright Red",               "hex": "#C4281B", "rgb": (196,  40,  27)},
    {"id": 23,  "name": "Bright Blue",              "hex": "#0D69AB", "rgb": ( 13, 105, 171)},
    {"id": 24,  "name": "Bright Yellow",            "hex": "#F5CD2F", "rgb": (245, 205,  47)},
    {"id": 26,  "name": "Black",                    "hex": "#1B2A34", "rgb": ( 27,  42,  52)},
    {"id": 28,  "name": "Dark Green",               "hex": "#287F46", "rgb": ( 40, 127,  70)},
    {"id": 37,  "name": "Bright Green",             "hex": "#4B9F4A", "rgb": ( 75, 159,  74)},
    {"id": 38,  "name": "Dark Orange",              "hex": "#A83D15", "rgb": (168,  61,  21)},
    {"id": 102, "name": "Medium Blue",              "hex": "#5A93DB", "rgb": ( 90, 147, 219)},
    {"id": 106, "name": "Bright Orange",            "hex": "#F47223", "rgb": (244, 114,  35)},  # corrected
    {"id": 119, "name": "Bright Yellowish Green",   "hex": "#A5CA18", "rgb": (165, 202,  24)},
    {"id": 124, "name": "Bright Reddish Violet",    "hex": "#923978", "rgb": (146,  57, 120)},
    {"id": 135, "name": "Sand Blue",                "hex": "#6074A1", "rgb": ( 96, 116, 161)},
    {"id": 138, "name": "Sand Yellow",              "hex": "#8D7452", "rgb": (141, 116,  82)},
    {"id": 151, "name": "Sand Green",               "hex": "#708E7C", "rgb": (112, 142, 124)},
    {"id": 154, "name": "Dark Red",                 "hex": "#720012", "rgb": (114,   0,  18)},
    {"id": 157, "name": "Medium Lilac",             "hex": "#4C51A3", "rgb": ( 76,  81, 163)},
    {"id": 191, "name": "Flame Yellowish Orange",   "hex": "#FCAC00", "rgb": (252, 172,   0)},
    {"id": 192, "name": "Reddish Brown",            "hex": "#5F3109", "rgb": ( 95,  49,   9)},
    {"id": 226, "name": "Cool Yellow",              "hex": "#FFE371", "rgb": (255, 227, 113)},
    {"id": 283, "name": "Light Nougat",             "hex": "#F0C3A9", "rgb": (240, 195, 169)},
    {"id": 297, "name": "Warm Gold",                "hex": "#AA7F2E", "rgb": (170, 127,  46)},
    {"id": 308, "name": "Dark Brown",               "hex": "#352100", "rgb": ( 53,  33,   0)},
    {"id": 312, "name": "Medium Nougat",            "hex": "#AF7446", "rgb": (175, 116,  70)},
    {"id": 321, "name": "Dark Azur",                "hex": "#469BC3", "rgb": ( 70, 155, 195)},
    {"id": 322, "name": "Medium Azur",              "hex": "#68C3E2", "rgb": (104, 195, 226)},
    {"id": 323, "name": "Aqua",                     "hex": "#B4D2E3", "rgb": (180, 210, 227)},
    {"id": 324, "name": "Medium Lavender",          "hex": "#AC78BA", "rgb": (172, 120, 186)},
    {"id": 325, "name": "Lavender",                 "hex": "#A095C8", "rgb": (160, 149, 200)},
    {"id": 330, "name": "Olive Green",              "hex": "#78763B", "rgb": (120, 118,  59)},
    {"id": 353, "name": "Vibrant Coral",            "hex": "#FF6347", "rgb": (255,  99,  71)},
]
# fmt: on

# ── Precompute LAB values ────────────────────────────────────────────────────

def _rgb_to_lab(r: int, g: int, b: int) -> np.ndarray:
    """Convert sRGB (0-255) to CIELAB using skimage."""
    from skimage.color import rgb2lab
    rgb = np.array([[[r / 255.0, g / 255.0, b / 255.0]]], dtype=np.float32)
    return rgb2lab(rgb)[0, 0]  # shape (3,)


# Build LAB lookup table at import time
_LAB_TABLE: list[np.ndarray] = []
for _c in LEGO_COLORS:
    _LAB_TABLE.append(_rgb_to_lab(*_c["rgb"]))

_LAB_ARRAY = np.array(_LAB_TABLE, dtype=np.float32)  # (N, 3)


# ── Public API ───────────────────────────────────────────────────────────────

def find_nearest_lego_color(r: int, g: int, b: int) -> dict:
    """Return the nearest LEGO color dict for the given RGB value."""
    lab = _rgb_to_lab(r, g, b)
    diffs = _LAB_ARRAY - lab  # (N, 3)
    distances = np.sum(diffs ** 2, axis=1)
    idx = int(np.argmin(distances))
    return LEGO_COLORS[idx]


def find_nearest_lego_color_batch(pixels: np.ndarray) -> np.ndarray:
    """
    Vectorised nearest-color matching.
    pixels: uint8 array shape (H, W, 3) RGB
    Returns index array shape (H, W) into LEGO_COLORS list.
    """
    from skimage.color import rgb2lab
    h, w, _ = pixels.shape
    flat = pixels.reshape(-1, 3).astype(np.float32) / 255.0  # (N, 3)
    flat_img = flat.reshape(1, -1, 3)
    lab_flat = rgb2lab(flat_img)[0]  # (N, 3)

    # Broadcast distance: (N, 1, 3) - (1, M, 3)
    diff = lab_flat[:, np.newaxis, :] - _LAB_ARRAY[np.newaxis, :, :]  # (N, M, 3)
    dist = np.sum(diff ** 2, axis=2)  # (N, M)
    indices = np.argmin(dist, axis=1)  # (N,)
    return indices.reshape(h, w)
