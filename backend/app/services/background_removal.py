"""
Background removal using U2Net ONNX model via onnxruntime.
No rembg / pymatting / numba dependency — works on any Python 3.11+.
"""

import io
import os
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

# U2Net ONNX model — ~176 MB, downloaded once to ~/.cache/demibrick/
MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx"
MODEL_DIR = Path.home() / ".cache" / "demibrick"
MODEL_PATH = MODEL_DIR / "u2net.onnx"

_session = None  # lazy-loaded onnxruntime session


def _download_model():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[DemiBrick] Downloading U2Net model to {MODEL_PATH} …")
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    print("[DemiBrick] Model downloaded.")


def _get_session():
    global _session
    if _session is not None:
        return _session

    try:
        import onnxruntime as ort
    except ImportError as e:
        raise RuntimeError("onnxruntime is not installed: pip install onnxruntime") from e

    if not MODEL_PATH.exists():
        _download_model()

    _session = ort.InferenceSession(
        str(MODEL_PATH),
        providers=["CPUExecutionProvider"],
    )
    return _session


# ── helpers ────────────────────────────────────────────────────────────────

def _normalize(img_np: np.ndarray) -> np.ndarray:
    """Normalize to U2Net input range [0, 1] with ImageNet mean/std."""
    mean = np.array([0.485, 0.456, 0.406])
    std  = np.array([0.229, 0.224, 0.225])
    return (img_np / 255.0 - mean) / std


def _run_u2net(pil_img: Image.Image) -> np.ndarray:
    """Run U2Net inference; return mask array float32 [0,1], shape (H, W)."""
    session = _get_session()

    orig_w, orig_h = pil_img.size
    # U2Net expects 320×320 RGB
    resized = pil_img.convert("RGB").resize((320, 320), Image.BILINEAR)
    img_np = np.array(resized, dtype=np.float32)
    img_np = _normalize(img_np)
    img_np = img_np.transpose(2, 0, 1)[np.newaxis, ...]  # (1, 3, 320, 320)

    input_name = session.get_inputs()[0].name
    outputs = session.run(None, {input_name: img_np})

    # First output is the main prediction
    pred = outputs[0][0, 0]  # (320, 320) in range roughly [-x, x]
    # Normalize to [0, 1]
    pred = (pred - pred.min()) / (pred.max() - pred.min() + 1e-8)

    # Resize mask back to original size
    mask_pil = Image.fromarray((pred * 255).astype(np.uint8)).resize(
        (orig_w, orig_h), Image.BILINEAR
    )
    return np.array(mask_pil, dtype=np.float32) / 255.0


# ── public API ─────────────────────────────────────────────────────────────

def remove_background(image_bytes: bytes) -> tuple[bytes, int, int]:
    """
    Remove background from image bytes.
    Returns (png_rgba_bytes, width, height).
    """
    pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    rgb_img = pil_img.convert("RGB")

    mask = _run_u2net(rgb_img)  # float32 (H, W) in [0, 1]

    # Apply mask to alpha channel
    alpha = (mask * 255).astype(np.uint8)
    rgba = np.array(pil_img)
    rgba[:, :, 3] = alpha

    result = Image.fromarray(rgba, "RGBA")
    buf = io.BytesIO()
    result.save(buf, format="PNG")
    buf.seek(0)
    return buf.read(), result.width, result.height
