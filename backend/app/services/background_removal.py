"""
Background removal — tries BRIA RMBG-2.0 first, falls back to U2Net.

RMBG-2.0 requires:
  1. Accept license at https://huggingface.co/briaai/RMBG-2.0
  2. Set HF_TOKEN env var with a read token that has access to the model
     e.g.  export HF_TOKEN=hf_xxxx  (in .env or shell)

If the model download fails for any reason (401, no token, network),
the service transparently falls back to U2Net (~176 MB, no auth required).
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

# ── Model config ───────────────────────────────────────────────────────────────

HF_TOKEN = os.getenv("HF_TOKEN", "")

RMBG2_URL  = "https://huggingface.co/briaai/RMBG-2.0/resolve/main/onnx/model_int8.onnx"
U2NET_URL  = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx"

MODEL_DIR  = Path.home() / ".cache" / "demibrick"
RMBG2_PATH = MODEL_DIR / "rmbg2_int8.onnx"
U2NET_PATH = MODEL_DIR / "u2net.onnx"

_session     = None   # lazy-loaded onnxruntime session
_active_model: str | None = None   # "rmbg2" or "u2net"


# ── Download helpers ───────────────────────────────────────────────────────────

def _download(url: str, dest: Path, token: str = "") -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[DemiBrick] Downloading {dest.name} from {url} …")
    headers: dict[str, str] = {"User-Agent": "Mozilla/5.0 DemiBrick/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=_ssl_ctx) as resp, \
            open(dest, "wb") as f:
        while chunk := resp.read(1024 * 1024):
            f.write(chunk)
    print(f"[DemiBrick] {dest.name} downloaded.")


def _ensure_rmbg2() -> bool:
    """Try to download RMBG-2.0. Returns True on success."""
    if RMBG2_PATH.exists():
        return True
    try:
        _download(RMBG2_URL, RMBG2_PATH, token=HF_TOKEN)
        return True
    except Exception as e:
        print(f"[DemiBrick] RMBG-2.0 unavailable ({e}). Using U2Net fallback.")
        # Remove partial file if download failed
        RMBG2_PATH.unlink(missing_ok=True)
        return False


def _ensure_u2net() -> None:
    if not U2NET_PATH.exists():
        _download(U2NET_URL, U2NET_PATH)


# ── Session ────────────────────────────────────────────────────────────────────

def _get_session():
    global _session, _active_model
    if _session is not None:
        return _session, _active_model

    try:
        import onnxruntime as ort
    except ImportError as e:
        raise RuntimeError("onnxruntime not installed: pip install onnxruntime") from e

    # Try RMBG-2.0 first
    if _ensure_rmbg2():
        _session = ort.InferenceSession(str(RMBG2_PATH), providers=["CPUExecutionProvider"])
        _active_model = "rmbg2"
        print("[DemiBrick] Using RMBG-2.0 for background removal.")
    else:
        _ensure_u2net()
        _session = ort.InferenceSession(str(U2NET_PATH), providers=["CPUExecutionProvider"])
        _active_model = "u2net"
        print("[DemiBrick] Using U2Net for background removal.")

    return _session, _active_model


# ── ICC profile normalization ──────────────────────────────────────────────────

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


# ── Inference ──────────────────────────────────────────────────────────────────

def _run_inference(pil_img: Image.Image) -> np.ndarray:
    """Run the active model; return soft mask float32 [0,1], shape (H, W)."""
    session, model = _get_session()

    orig_w, orig_h = pil_img.size
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)

    if model == "rmbg2":
        size = 1024
    else:
        size = 320

    resized = pil_img.convert("RGB").resize((size, size), Image.BILINEAR)
    img_np  = (np.array(resized, dtype=np.float32) / 255.0 - mean) / std
    img_np  = img_np.transpose(2, 0, 1)[np.newaxis, ...]   # (1, 3, H, H)

    input_name = session.get_inputs()[0].name
    pred = session.run(None, {input_name: img_np})[0].astype(np.float32)

    while pred.ndim > 2:
        pred = pred[0]

    if model == "rmbg2":
        # RMBG-2.0 outputs raw logits → sigmoid
        if pred.max() > 1.0 or pred.min() < 0.0:
            pred = 1.0 / (1.0 + np.exp(-pred))
    else:
        # U2Net: normalize to [0, 1]
        pred = (pred - pred.min()) / (pred.max() - pred.min() + 1e-8)

    mask_pil = Image.fromarray((pred * 255).astype(np.uint8)).resize(
        (orig_w, orig_h), Image.BILINEAR
    )
    return np.array(mask_pil, dtype=np.float32) / 255.0


def _refine_mask(mask_np: np.ndarray) -> np.ndarray:
    mask_pil = Image.fromarray((mask_np * 255).astype(np.uint8))
    mask_pil = mask_pil.filter(ImageFilter.GaussianBlur(radius=1))
    return np.array(mask_pil, dtype=np.float32) / 255.0


# ── Public API ─────────────────────────────────────────────────────────────────

def remove_background(image_bytes: bytes) -> tuple[bytes, int, int]:
    """
    Remove background from image bytes.
    Returns (png_rgba_bytes, width, height).
    """
    pil_img = Image.open(io.BytesIO(image_bytes))
    pil_img = _normalize_color_profile(pil_img)
    pil_img = pil_img.convert("RGBA")

    mask = _run_inference(pil_img.convert("RGB"))
    mask = _refine_mask(mask)

    alpha = (mask * 255).astype(np.uint8)
    rgba  = np.array(pil_img)
    rgba[:, :, 3] = alpha

    result = Image.fromarray(rgba, "RGBA")
    buf    = io.BytesIO()
    result.save(buf, format="PNG")
    buf.seek(0)
    return buf.read(), result.width, result.height
