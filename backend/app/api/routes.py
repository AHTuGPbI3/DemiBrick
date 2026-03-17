import base64
import io
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from PIL import Image

from app.services.background_removal import remove_background
from app.services.pixelizer import pixelize, generate_preview, VALID_RESOLUTIONS
from app.services.bambu_colors import get_active_palette, set_active_palette, ALL_COLORS
from app.services.brick_optimizer import optimize_layout
from app.services.depth_estimation import estimate_depth, depth_to_layers, depth_to_preview
from app.services.instruction_generator import generate_pdf
from app.services.stl_generator import generate_all_stls

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
    image: str                          # data:image/png;base64,...
    resolution: int                     # 16 | 32 | 48 | 64
    depth_layers: int = 1               # 1 = flat, 2-5 = relief
    filament_types: list[str] = ["PLA Basic"]
    custom_color_ids: list[str] = []    # if non-empty, overrides filament_types


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

    # Set active palette before pixelizing
    if req.custom_color_ids:
        set_active_palette(custom_ids=req.custom_color_ids)
    else:
        set_active_palette(filament_types=req.filament_types)

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
    palette = get_active_palette()
    flat = [idx for row in result["pixel_grid"] for idx in row if idx is not None]
    counts = Counter(flat)
    color_summary = [
        {
            "color_id":      palette[idx]["id"],
            "name":          palette[idx]["name"],
            "hex":           palette[idx]["hex"],
            "filament_type": palette[idx]["type"],
            "count":         cnt,
        }
        for idx, cnt in sorted(counts.items(), key=lambda x: -x[1])
    ]

    total_studs = sum(c["count"] for c in color_summary)

    response: dict[str, Any] = {
        "preview":       f"data:image/png;base64,{preview_b64}",
        "pixel_grid":    result["pixel_grid"],
        "dimensions":    {"w": result["width_studs"], "h": result["height_studs"]},
        "color_summary": color_summary,
        "total_studs":   total_studs,
    }

    # Optional depth / relief
    if req.depth_layers > 1:
        try:
            depth_map = estimate_depth(pil_img.convert("RGB"))
            layers = depth_to_layers(depth_map, result["pixel_grid"], req.depth_layers)
            depth_preview_img = depth_to_preview(depth_map)
            buf2 = io.BytesIO()
            depth_preview_img.save(buf2, format="PNG")
            response["layers"]        = layers
            response["depth_preview"] = "data:image/png;base64," + base64.b64encode(buf2.getvalue()).decode()
            response["num_layers"]    = req.depth_layers
        except Exception as e:
            # Depth is optional — return flat if it fails
            response["depth_error"] = str(e)

    return response


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


# ── /instructions ─────────────────────────────────────────────────────────────

class InstructionsRequest(BaseModel):
    bom: list[dict[str, Any]]
    dimensions: dict[str, int]
    total_studs: int
    total_bricks: int
    optimization_ratio: float


@router.post("/instructions")
async def instructions(req: InstructionsRequest):
    try:
        pdf_bytes = generate_pdf(
            bom=req.bom,
            dimensions=req.dimensions,
            total_studs=req.total_studs,
            total_bricks=req.total_bricks,
            optimization_ratio=req.optimization_ratio,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="demibrick_instructions.pdf"'},
    )


# ── /stl ──────────────────────────────────────────────────────────────────────

class StlRequest(BaseModel):
    bom: list[dict[str, Any]]


@router.post("/stl")
async def stl_export(req: StlRequest):
    try:
        zip_bytes = generate_all_stls(req.bom)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"STL generation failed: {e}")
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="demibrick_stl.zip"'},
    )


# ── /palette ──────────────────────────────────────────────────────────────────

class PaletteRequest(BaseModel):
    filament_types: list[str] = []
    custom_ids: list[str] = []


@router.get("/palette")
async def get_palette():
    return {"colors": ALL_COLORS}


@router.post("/palette")
async def set_palette(req: PaletteRequest):
    if req.custom_ids:
        set_active_palette(custom_ids=req.custom_ids)
    elif req.filament_types:
        set_active_palette(filament_types=req.filament_types)
    return {"active": get_active_palette()}
