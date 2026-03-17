import base64
import io

from fastapi import APIRouter, HTTPException, UploadFile, File
from PIL import Image

from app.services.background_removal import remove_background

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg"}


@router.post("/health")
async def health():
    return {"status": "ok"}


@router.post("/remove-background")
async def remove_bg(file: UploadFile = File(...)):
    # Validate content type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Only JPEG and PNG are allowed.",
        )

    image_bytes = await file.read()

    # Validate file size
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 10 MB.",
        )

    # Validate it's a real image
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
    return {
        "image": f"data:image/png;base64,{b64}",
        "width": width,
        "height": height,
    }
