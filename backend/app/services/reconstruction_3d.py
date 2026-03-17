"""
3D reconstruction via TripoSR on HuggingFace Spaces.
Fallback chain across multiple public spaces with retry logic.
"""

import base64
import io
import os
import tempfile
import time
from typing import Optional

HF_TOKEN = os.getenv("HF_TOKEN", "")

TRIPOSR_SPACES = [
    "stabilityai/TripoSR",
    "Nymbo/TripoSR",
    "cocktailpeanut/TripoSR",
]

_TIMEOUT = 120  # seconds


def _load_result_bytes(result) -> bytes:
    """Extract bytes from gradio_client result (path, tuple, or dict)."""
    if isinstance(result, (list, tuple)):
        result = result[0]
    if isinstance(result, dict):
        result = result.get("value") or result.get("path") or result.get("name")
    if isinstance(result, str) and os.path.exists(result):
        with open(result, "rb") as f:
            return f.read()
    raise RuntimeError(f"Cannot extract file from result: {type(result)} = {result!r}")


def _call_space(space: str, image_path: str) -> bytes:
    """Try one TripoSR space. Returns GLB/OBJ bytes."""
    # Import here so backend can start without gradio_client on import
    from gradio_client import Client, handle_file  # noqa: PLC0415

    token = HF_TOKEN or None
    client = Client(space, token=token)

    # --- Attempt 1: two-step (preprocess → generate) ---
    try:
        processed = client.predict(
            handle_file(image_path),
            False,   # do_remove_background (we already did it)
            0.85,    # foreground_ratio
            api_name="/preprocess",
        )
        # processed might be a filepath or a dict
        if isinstance(processed, dict):
            processed = processed.get("path") or processed.get("value") or image_path
        if not isinstance(processed, str) or not os.path.exists(processed):
            processed = image_path

        result = client.predict(
            handle_file(processed),
            256,     # mc_resolution
            api_name="/generate",
        )
        return _load_result_bytes(result)
    except Exception as e1:
        pass

    # --- Attempt 2: single-step run ---
    try:
        result = client.predict(
            handle_file(image_path),
            api_name="/run",
        )
        return _load_result_bytes(result)
    except Exception as e2:
        pass

    # --- Attempt 3: first endpoint, positional ---
    try:
        api_info = client.view_api(return_format="dict")
        endpoints = list(api_info.get("named_endpoints", {}).keys())
        if endpoints:
            result = client.predict(
                handle_file(image_path),
                api_name=endpoints[0],
            )
            return _load_result_bytes(result)
    except Exception as e3:
        raise RuntimeError(f"All approaches failed on {space}: {e1!r} / {e2!r} / {e3!r}")

    raise RuntimeError(f"Could not call {space}")


def reconstruct_3d(image_bytes: bytes) -> bytes:
    """
    Reconstruct 3D model from PNG/JPEG image bytes.
    Returns GLB bytes (converted via trimesh if needed).
    """
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp.write(image_bytes)
        img_path = tmp.name

    try:
        last_error: Optional[Exception] = None
        for space in TRIPOSR_SPACES:
            for attempt, delay in enumerate([0, 5, 15]):
                if delay:
                    time.sleep(delay)
                try:
                    raw_bytes = _call_space(space, img_path)
                    return _ensure_glb(raw_bytes)
                except Exception as e:
                    last_error = e
                    if "too many requests" in str(e).lower() or "rate" in str(e).lower():
                        time.sleep(30)
                    continue
        raise RuntimeError(f"All TripoSR spaces failed. Last: {last_error}")
    finally:
        try:
            os.unlink(img_path)
        except OSError:
            pass


def _ensure_glb(mesh_bytes: bytes) -> bytes:
    """Convert mesh to GLB format using trimesh if it's not already GLB."""
    import trimesh  # noqa: PLC0415

    # GLB magic bytes: 0x676C5446 ("glTF")
    if mesh_bytes[:4] == b"glTF":
        return mesh_bytes

    try:
        # Try to load as OBJ or other format
        ext = "obj"
        if mesh_bytes[:4] in (b"<glt", b"{\n \""):
            ext = "gltf"
        mesh = trimesh.load(io.BytesIO(mesh_bytes), file_type=ext)
        buf = io.BytesIO()
        if isinstance(mesh, trimesh.Scene):
            mesh.export(buf, file_type="glb")
        else:
            scene = trimesh.Scene(mesh)
            scene.export(buf, file_type="glb")
        return buf.getvalue()
    except Exception:
        # Return as-is if we can't convert
        return mesh_bytes


def check_health() -> dict:
    """Check availability of TripoSR spaces (fast check)."""
    from gradio_client import Client  # noqa: PLC0415

    results = {}
    for space in TRIPOSR_SPACES:
        try:
            client = Client(space, hf_token=HF_TOKEN or None)
            results[space] = "available"
        except Exception as e:
            results[space] = f"unavailable: {str(e)[:80]}"
    return results
