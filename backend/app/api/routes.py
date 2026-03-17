import base64
import io
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from PIL import Image

from app.services.background_removal import remove_background
from app.services.pixelizer import pixelize, generate_preview, VALID_RESOLUTIONS
from app.services.lego_colors import LEGO_COLORS
from app.services.brick_optimizer import optimize_layout

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg"}


# ── /health ──────────────────────────────────────────────────────────────────

@router.post("/health")
async def health():
    return {"status": "ok"}


# ── /remove-background ────────────────────────────────────────────────────────

@router.post("/remove-background")
async def remove_bg(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Only JPEG and PNG are allowed.",
        )

    image_bytes = await file.read()

    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10 MB.")

    try:
        Image.open(io.BytesIO(image_bytes)).verify()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file.")

    try:
        result_bytes, width, height = remove_background(image_bytes)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Background removal failed: {e}")

    b64 = base64.b64encode(result_bytes).decode()
    return {"image": f"data:image/png;base64,{b64}", "width": width, "height": height}


# ── /pixelize ─────────────────────────────────────────────────────────────────

class PixelizeRequest(BaseModel):
    image: str       # data:image/png;base64,...
    resolution: int  # 16 | 32 | 48 | 64


@router.post("/pixelize")
async def pixelize_image(req: PixelizeRequest) -> dict[str, Any]:
    if req.resolution not in VALID_RESOLUTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"resolution must be one of {list(VALID_RESOLUTIONS)}",
        )

    # Decode base64 image
    try:
        header, b64data = req.image.split(",", 1)
        img_bytes = base64.b64decode(b64data)
        pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {e}")

    try:
        result = pixelize(pil_img, req.resolution)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pixelization failed: {e}")

    # Generate preview image
    try:
        preview_img = generate_preview(result["pixel_grid"], scale=20)
        buf = io.BytesIO()
        preview_img.save(buf, format="PNG")
        preview_b64 = base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview generation failed: {e}")

    # Build color summary
    from collections import Counter
    flat = [idx for row in result["pixel_grid"] for idx in row if idx is not None]
    counts = Counter(flat)
    color_summary = [
        {
            "color_id": LEGO_COLORS[idx]["id"],
            "name":     LEGO_COLORS[idx]["name"],
            "hex":      LEGO_COLORS[idx]["hex"],
            "count":    cnt,
        }
        for idx, cnt in sorted(counts.items(), key=lambda x: -x[1])
    ]

    total_studs = sum(c["count"] for c in color_summary)

    return {
        "preview":       f"data:image/png;base64,{preview_b64}",
        "pixel_grid":    result["pixel_grid"],
        "dimensions":    {"w": result["width_studs"], "h": result["height_studs"]},
        "color_summary": color_summary,
        "total_studs":   total_studs,
    }


# ── /optimize ─────────────────────────────────────────────────────────────────

class OptimizeRequest(BaseModel):
    pixel_grid: list[list[int | None]]


@router.post("/optimize")
async def optimize(req: OptimizeRequest) -> dict[str, Any]:
    if not req.pixel_grid:
        raise HTTPException(status_code=400, detail="pixel_grid is empty")
    try:
        result = optimize_layout(req.pixel_grid)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {e}")
    return result
