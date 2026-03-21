"""
Bambu Lab PLA filament color palette with CIELAB nearest-color matching.
Replaces lego_colors.py — same batch API, dynamic active palette.
"""

from skimage.color import rgb2lab
import numpy as np

# fmt: off
BAMBU_PLA_BASIC = [
    {"id": "basic-01", "name": "Jade White",      "hex": "#FFFFFF", "rgb": (255, 255, 255), "type": "PLA Basic"},
    {"id": "basic-02", "name": "Beige",            "hex": "#F7E6DE", "rgb": (247, 230, 222), "type": "PLA Basic"},
    {"id": "basic-03", "name": "Light Gray",       "hex": "#D1D3D5", "rgb": (209, 211, 213), "type": "PLA Basic"},
    {"id": "basic-04", "name": "Silver",           "hex": "#A6A9AA", "rgb": (166, 169, 170), "type": "PLA Basic"},
    {"id": "basic-05", "name": "Gray",             "hex": "#8E9089", "rgb": (142, 144, 137), "type": "PLA Basic"},
    {"id": "basic-06", "name": "Blue Grey",        "hex": "#5B6579", "rgb": (91,  101, 121), "type": "PLA Basic"},
    {"id": "basic-07", "name": "Dark Gray",        "hex": "#545454", "rgb": (84,   84,  84), "type": "PLA Basic"},
    {"id": "basic-08", "name": "Black",            "hex": "#000000", "rgb": (0,     0,   0), "type": "PLA Basic"},
    {"id": "basic-09", "name": "Red",              "hex": "#C12E1F", "rgb": (193,  46,  31), "type": "PLA Basic"},
    {"id": "basic-10", "name": "Maroon Red",       "hex": "#9D2235", "rgb": (157,  34,  53), "type": "PLA Basic"},
    {"id": "basic-11", "name": "Magenta",          "hex": "#EC008C", "rgb": (236,   0, 140), "type": "PLA Basic"},
    {"id": "basic-12", "name": "Hot Pink",         "hex": "#F5547C", "rgb": (245,  84, 124), "type": "PLA Basic"},
    {"id": "basic-13", "name": "Pink",             "hex": "#F55A74", "rgb": (245,  90, 116), "type": "PLA Basic"},
    {"id": "basic-14", "name": "Orange",           "hex": "#FF6A13", "rgb": (255, 106,  19), "type": "PLA Basic"},
    {"id": "basic-15", "name": "Pumpkin Orange",   "hex": "#FF9016", "rgb": (255, 144,  22), "type": "PLA Basic"},
    {"id": "basic-16", "name": "Gold",             "hex": "#E4BD68", "rgb": (228, 189, 104), "type": "PLA Basic"},
    {"id": "basic-17", "name": "Bronze",           "hex": "#847D48", "rgb": (132, 125,  72), "type": "PLA Basic"},
    {"id": "basic-18", "name": "Sunflower Yellow", "hex": "#FEC600", "rgb": (254, 198,   0), "type": "PLA Basic"},
    {"id": "basic-19", "name": "Yellow",           "hex": "#F4EE2A", "rgb": (244, 238,  42), "type": "PLA Basic"},
    {"id": "basic-20", "name": "Bright Green",     "hex": "#BECF00", "rgb": (190, 207,   0), "type": "PLA Basic"},
    {"id": "basic-21", "name": "Bambu Green",      "hex": "#00AE42", "rgb": (0,   174,  66), "type": "PLA Basic"},
    {"id": "basic-22", "name": "Mistletoe Green",  "hex": "#3F8E43", "rgb": (63,  142,  67), "type": "PLA Basic"},
    {"id": "basic-23", "name": "Turquoise",        "hex": "#00B1B7", "rgb": (0,   177, 183), "type": "PLA Basic"},
    {"id": "basic-24", "name": "Cyan",             "hex": "#0086D6", "rgb": (0,   134, 214), "type": "PLA Basic"},
    {"id": "basic-25", "name": "Cobalt Blue",      "hex": "#0056B8", "rgb": (0,    86, 184), "type": "PLA Basic"},
    {"id": "basic-26", "name": "Blue",             "hex": "#0A2989", "rgb": (10,   41, 137), "type": "PLA Basic"},
    {"id": "basic-27", "name": "Purple",           "hex": "#5E43B7", "rgb": (94,   67, 183), "type": "PLA Basic"},
    {"id": "basic-28", "name": "Indigo Purple",    "hex": "#482960", "rgb": (72,   41,  96), "type": "PLA Basic"},
    {"id": "basic-29", "name": "Cocoa Brown",      "hex": "#6F5034", "rgb": (111,  80,  52), "type": "PLA Basic"},
    {"id": "basic-30", "name": "Brown",            "hex": "#9D432C", "rgb": (157,  67,  44), "type": "PLA Basic"},
]

BAMBU_PLA_MATTE = [
    {"id": "matte-01", "name": "Ivory White",     "hex": "#FFFFFF", "rgb": (255, 255, 255), "type": "PLA Matte"},
    {"id": "matte-02", "name": "Bone White",      "hex": "#CBC6B8", "rgb": (203, 198, 184), "type": "PLA Matte"},
    {"id": "matte-03", "name": "Desert Tan",      "hex": "#E8DBB7", "rgb": (232, 219, 183), "type": "PLA Matte"},
    {"id": "matte-04", "name": "Latte Brown",     "hex": "#D3B7A7", "rgb": (211, 183, 167), "type": "PLA Matte"},
    {"id": "matte-05", "name": "Caramel",         "hex": "#AE835B", "rgb": (174, 131,  91), "type": "PLA Matte"},
    {"id": "matte-06", "name": "Terracotta",      "hex": "#B15533", "rgb": (177,  85,  51), "type": "PLA Matte"},
    {"id": "matte-07", "name": "Dark Brown",      "hex": "#7D6556", "rgb": (125, 101,  86), "type": "PLA Matte"},
    {"id": "matte-08", "name": "Dark Chocolate",  "hex": "#4D3324", "rgb": (77,   51,  36), "type": "PLA Matte"},
    {"id": "matte-09", "name": "Lilac Purple",    "hex": "#AE96D4", "rgb": (174, 150, 212), "type": "PLA Matte"},
    {"id": "matte-10", "name": "Sakura Pink",     "hex": "#E8AFCF", "rgb": (232, 175, 207), "type": "PLA Matte"},
    {"id": "matte-11", "name": "Mandarin Orange", "hex": "#F99963", "rgb": (249, 153,  99), "type": "PLA Matte"},
    {"id": "matte-12", "name": "Lemon Yellow",    "hex": "#F7D959", "rgb": (247, 217,  89), "type": "PLA Matte"},
    {"id": "matte-13", "name": "Plum",            "hex": "#950051", "rgb": (149,   0,  81), "type": "PLA Matte"},
    {"id": "matte-14", "name": "Scarlet Red",     "hex": "#DE4343", "rgb": (222,  67,  67), "type": "PLA Matte"},
    {"id": "matte-15", "name": "Dark Red",        "hex": "#BB3D43", "rgb": (187,  61,  67), "type": "PLA Matte"},
    {"id": "matte-16", "name": "Dark Green",      "hex": "#68724D", "rgb": (104, 114,  77), "type": "PLA Matte"},
    {"id": "matte-17", "name": "Grass Green",     "hex": "#61C680", "rgb": (97,  198, 128), "type": "PLA Matte"},
    {"id": "matte-18", "name": "Apple Green",     "hex": "#C2E189", "rgb": (194, 225, 137), "type": "PLA Matte"},
    {"id": "matte-19", "name": "Ice Blue",        "hex": "#A3D8E1", "rgb": (163, 216, 225), "type": "PLA Matte"},
    {"id": "matte-20", "name": "Sky Blue",        "hex": "#56B7E6", "rgb": (86,  183, 230), "type": "PLA Matte"},
    {"id": "matte-21", "name": "Marine Blue",     "hex": "#0078BF", "rgb": (0,   120, 191), "type": "PLA Matte"},
    {"id": "matte-22", "name": "Dark Blue",       "hex": "#042F56", "rgb": (4,    47,  86), "type": "PLA Matte"},
    {"id": "matte-23", "name": "Ash Gray",        "hex": "#9B9EA0", "rgb": (155, 158, 160), "type": "PLA Matte"},
    {"id": "matte-24", "name": "Nardo Gray",      "hex": "#757575", "rgb": (117, 117, 117), "type": "PLA Matte"},
    {"id": "matte-25", "name": "Charcoal",        "hex": "#000000", "rgb": (0,     0,   0), "type": "PLA Matte"},
]
# fmt: on

ALL_COLORS = BAMBU_PLA_BASIC + BAMBU_PLA_MATTE

# Perceptual weights for CIELAB distance: down-weight L* (brightness),
# up-weight a* and b* (hue) so vivid colours don't map to similar-brightness
# neutrals (e.g. bright magenta → brown).
LAB_WEIGHTS = np.array([0.5, 1.5, 1.5], dtype=np.float32)

# ── Active palette (module-level state) ──────────────────────────────────────

_active_palette: list[dict] = []
_LAB_ARRAY: np.ndarray | None = None


def _build_lab_array(palette: list[dict]) -> np.ndarray:
    rows = []
    for c in palette:
        r, g, b = c["rgb"]
        lab = rgb2lab(np.array([[[r / 255.0, g / 255.0, b / 255.0]]], dtype=np.float32))[0, 0]
        rows.append(lab)
    return np.array(rows, dtype=np.float32)  # (N, 3)


def set_active_palette(filament_types: list | None = None, custom_ids: list | None = None):
    """
    Set the active palette.
    filament_types: ["PLA Basic"] | ["PLA Basic", "PLA Matte"]
    custom_ids:     ["basic-01", "basic-09", ...] — only these colors
    """
    global _active_palette, _LAB_ARRAY
    if custom_ids:
        _active_palette = [c for c in ALL_COLORS if c["id"] in custom_ids]
    elif filament_types:
        _active_palette = [c for c in ALL_COLORS if c["type"] in filament_types]
    else:
        _active_palette = BAMBU_PLA_BASIC.copy()
    if not _active_palette:
        _active_palette = BAMBU_PLA_BASIC.copy()
    _LAB_ARRAY = _build_lab_array(_active_palette)


def get_active_palette() -> list[dict]:
    if not _active_palette:
        set_active_palette()
    return _active_palette


def get_lab_array() -> np.ndarray:
    """Return the pre-computed LAB array for the active palette."""
    if _LAB_ARRAY is None:
        set_active_palette()
    return _LAB_ARRAY  # type: ignore[return-value]


def get_color_by_id(color_id: str) -> dict | None:
    for c in ALL_COLORS:
        if c["id"] == color_id:
            return c
    return None


# ── Public matching API ───────────────────────────────────────────────────────

def find_nearest_color(r: int, g: int, b: int) -> dict:
    """Return nearest Bambu color dict for the given RGB (weighted CIELAB)."""
    if _LAB_ARRAY is None:
        set_active_palette()
    lab  = rgb2lab(np.array([[[r / 255.0, g / 255.0, b / 255.0]]], dtype=np.float32))[0, 0]
    diff = _LAB_ARRAY - lab  # type: ignore[operator]
    idx  = int(np.argmin(np.sum(LAB_WEIGHTS * diff ** 2, axis=1)))
    return _active_palette[idx]


def find_nearest_color_batch(pixels: np.ndarray) -> np.ndarray:
    """
    Vectorised nearest-color matching with weighted CIELAB distance.
    pixels: uint8 array (H, W, 3)
    Returns index array (H, W) into current active palette.
    """
    if _LAB_ARRAY is None:
        set_active_palette()
    h, w, _ = pixels.shape
    flat     = pixels.reshape(-1, 3).astype(np.float32) / 255.0
    lab_flat = rgb2lab(flat.reshape(1, -1, 3))[0]                          # (N, 3)
    diff     = lab_flat[:, np.newaxis, :] - _LAB_ARRAY[np.newaxis, :, :]  # (N, M, 3)
    dist     = np.sum(LAB_WEIGHTS * diff ** 2, axis=2)                     # (N, M)
    return np.argmin(dist, axis=1).reshape(h, w)                           # (H, W)


# Initialise at import time
set_active_palette(["PLA Basic"])
