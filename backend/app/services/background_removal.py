"""
Background removal using BRIA RMBG-2.0 ONNX model via onnxruntime.
Replaces U2Net — significantly better on hair, fur, glass, semi-transparent edges.
Model: ~366 MB int8 ONNX, downloaded once to ~/.cache/demibrick/
License: CC BY-NC 4.0 (free for non-commercial use)
"""

import io
import os
import ssl
import urllib.request
from pathlib import Path

# Fix macOS SSL: use certifi bundle if system certs are missing
try:
    import certifi
    _ssl_ctx = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _ssl_ctx = ssl.create_default_context()

import numpy as np
from PIL import Image, ImageFilter

# BRIA RMBG-2.0 int8 ONNX — ~366 MB, downloaded once to ~/.cache/demibrick/
MODEL_URL = (
    "https://huggingface.co/briaai/RMBG-2.0/resolve/main/onnx/model_int8.onnx"
)
MODEL_DIR  = Path.home() / ".cache" / "demibrick"
MODEL_PATH = MODEL_DIR / "rmbg2_int8.onnx"

_session = None  # lazy-loaded onnxruntime session


def _download_model() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[DemiBrick] Downloading RMBG-2.0 model to {MODEL_PATH} … (~366 MB)")
    req = urllib.request.Request(
        MODEL_URL,
        headers={"User-Agent": "Mozilla/5.0 DemiBrick/1.0"},
    )
    with urllib.request.urlopen(req, context=_ssl_ctx) as resp, \
            open(MODEL_PATH, "wb") as f:
        while chunk := resp.read(1024 * 1024):
            f.write(chunk)
    print("[DemiBrick] RMBG-2.0 model downloaded.")


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


# ── helpers ────────────────────────────────────────────────────────────────────

def _normalize_color_profile(image: Image.Image) -> Image.Image:
    """Convert image to sRGB if it carries a different ICC profile."""
    try:
        icc = image.info.get("icc_profile")
        if icc:
            from PIL.ImageCms import profileToProfile, createProfile, ImageCmsProfile
            src = ImageCmsProfile(io.BytesIO(icc))
            dst = createProfile("sRGB")
            image = profileToProfile(image.convert("RGB"), src, dst)
    except Exception:
        pass
    return image


def _run_rmbg2(pil_img: Image.Image) -> np.ndarray:
    """Run RMBG-2.0 inference; return soft mask float32 [0,1], shape (H, W)."""
    session = _get_session()

    orig_w, orig_h = pil_img.size
    # RMBG-2.0 expects 1024×1024 RGB
    resized = pil_img.convert("RGB").resize((1024, 1024), Image.BILINEAR)
    img_np  = np.array(resized, dtype=np.float32) / 255.0

    # ImageNet normalization
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img_np = (img_np - mean) / std
    img_np = img_np.transpose(2, 0, 1)[np.newaxis, ...]  # (1, 3, 1024, 1024)

    input_name = session.get_inputs()[0].name
    outputs    = session.run(None, {input_name: img_np})

    pred = outputs[0].astype(np.float32)
    # Squeeze to 2D
    while pred.ndim > 2:
        pred = pred[0]

    # Apply sigmoid if output looks like raw logits (outside [0, 1])
    if pred.max() > 1.0 or pred.min() < 0.0:
        pred = 1.0 / (1.0 + np.exp(-pred))

    # Resize mask back to original size
    mask_pil = Image.fromarray((pred * 255).astype(np.uint8)).resize(
        (orig_w, orig_h), Image.BILINEAR
    )
    return np.array(mask_pil, dtype=np.float32) / 255.0


def _refine_mask(mask_np: np.ndarray) -> np.ndarray:
    """Smooth mask edges with a light Gaussian blur to reduce jagged artifacts."""
    mask_pil = Image.fromarray((mask_np * 255).astype(np.uint8))
    mask_pil = mask_pil.filter(ImageFilter.GaussianBlur(radius=1))
    return np.array(mask_pil, dtype=np.float32) / 255.0


# ── public API ─────────────────────────────────────────────────────────────────

def remove_background(image_bytes: bytes) -> tuple[bytes, int, int]:
    """
    Remove background from image bytes.
    Returns (png_rgba_bytes, width, height).
    """
    pil_img = Image.open(io.BytesIO(image_bytes))

    # Normalize ICC color profile to sRGB (important for iPhone/Android shots)
    pil_img = _normalize_color_profile(pil_img)
    pil_img = pil_img.convert("RGBA")
    rgb_img = pil_img.convert("RGB")

    mask = _run_rmbg2(rgb_img)
    mask = _refine_mask(mask)

    alpha = (mask * 255).astype(np.uint8)
    rgba  = np.array(pil_img)
    rgba[:, :, 3] = alpha

    result = Image.fromarray(rgba, "RGBA")
    buf    = io.BytesIO()
    result.save(buf, format="PNG")
    buf.seek(0)
    return buf.read(), result.width, result.height
