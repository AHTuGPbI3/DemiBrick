"""
Depth estimation using MiDaS Small ONNX model via onnxruntime.
Model: ~50 MB, downloaded once to ~/.cache/demibrick/
"""

import io
import urllib.request
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

MODEL_URL  = "https://github.com/isl-org/MiDaS/releases/download/v2_1/model_opt.onnx"
MODEL_DIR  = Path.home() / ".cache" / "demibrick"
MODEL_PATH = MODEL_DIR / "midas_small.onnx"

_session = None


def _download_model():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[DemiBrick] Downloading MiDaS Small to {MODEL_PATH} …")
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    print("[DemiBrick] MiDaS downloaded.")


def _get_session():
    global _session
    if _session is not None:
        return _session
    try:
        import onnxruntime as ort
    except ImportError as e:
        raise RuntimeError("onnxruntime not installed") from e
    if not MODEL_PATH.exists():
        _download_model()
    _session = ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])
    return _session


def estimate_depth(image: Image.Image) -> np.ndarray:
    """
    Run MiDaS depth estimation.
    Returns float32 array shape (H, W) normalised to [0.0, 1.0].
    1.0 = closest, 0.0 = farthest.
    """
    session = _get_session()
    inp = session.get_inputs()[0]
    # MiDaS Small expects 256×256 or 384×384 RGB float32
    target_size = 256
    rgb = image.convert("RGB").resize((target_size, target_size), Image.BILINEAR)
    arr = np.array(rgb, dtype=np.float32) / 255.0
    # Normalise with ImageNet stats
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    arr  = (arr - mean) / std
    arr  = arr.transpose(2, 0, 1)[np.newaxis, ...]   # (1,3,H,W)

    raw = session.run(None, {inp.name: arr})[0]       # (1,1,H,W) or (1,H,W)
    depth = raw.squeeze()                              # (H, W)

    # Normalise to [0, 1] and invert (closer = higher)
    dmin, dmax = depth.min(), depth.max()
    depth = (depth - dmin) / (dmax - dmin + 1e-8)
    depth = 1.0 - depth  # invert: foreground = 1

    # Resize back to original image size
    orig_w, orig_h = image.size
    depth_pil = Image.fromarray((depth * 255).astype(np.uint8)).resize(
        (orig_w, orig_h), Image.BILINEAR
    )
    return np.array(depth_pil, dtype=np.float32) / 255.0


def depth_to_preview(depth_map: np.ndarray) -> Image.Image:
    """Convert depth float array to greyscale PIL image for display."""
    grey = (depth_map * 255).clip(0, 255).astype(np.uint8)
    return Image.fromarray(grey, mode="L").convert("RGB")


def depth_to_layers(
    depth_map: np.ndarray,
    pixel_grid: list[list[int | None]],
    num_layers: int = 3,
) -> list[list[list[int | None]]]:
    """
    Quantise depth into num_layers layers.
    Returns layers[0..N-1][row][col] — layer 0 is background (lowest).
    Transparent pixels stay None in every layer.
    """
    num_layers = max(1, min(num_layers, 5))
    h = len(pixel_grid)
    w = len(pixel_grid[0]) if h else 0

    # Resize depth to match pixel_grid
    depth_pil = Image.fromarray((depth_map * 255).astype(np.uint8)).resize(
        (w, h), Image.BILINEAR
    )
    depth_small = np.array(depth_pil, dtype=np.float32) / 255.0

    # Quantise: thresholds evenly spaced
    layers: list[list[list[int | None]]] = [
        [[None] * w for _ in range(h)] for _ in range(num_layers)
    ]

    thresholds = np.linspace(0.0, 1.0, num_layers + 1)

    for r in range(h):
        for c in range(w):
            color_idx = pixel_grid[r][c]
            if color_idx is None:
                continue
            d = float(depth_small[r, c])
            layer_idx = int(d * num_layers)
            layer_idx = min(layer_idx, num_layers - 1)
            layers[layer_idx][r][c] = color_idx

    return layers
