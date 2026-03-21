"""
3D reconstruction via HuggingFace Spaces.
Fallback chain: InstantMesh → TripoSR (multiple mirrors) → StableFast3D.
"""

import base64
import io
import os
import tempfile
import time
from typing import Optional

HF_TOKEN = os.getenv("HF_TOKEN", "")

# Ordered fallback chain — tried in sequence until one succeeds.
# "type" hints which _call_space branch to use.
RECONSTRUCTION_CHAIN = [
    {"name": "InstantMesh",       "space": "TencentARC/InstantMesh",         "type": "instantmesh"},
    {"name": "TripoSR",           "space": "stabilityai/TripoSR",            "type": "triposr"},
    {"name": "TripoSR (Nymbo)",   "space": "Nymbo/TripoSR",                  "type": "triposr"},
    {"name": "TripoSR (cocktail)","space": "cocktailpeanut/TripoSR",         "type": "triposr"},
    {"name": "StableFast3D",      "space": "stabilityai/stable-fast-3d",     "type": "generic"},
]

# Keep legacy name for backward-compat with existing code that imports TRIPOSR_SPACES
TRIPOSR_SPACES = [e["space"] for e in RECONSTRUCTION_CHAIN if e["type"] == "triposr"]

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


def _call_triposr(client, image_path: str) -> bytes:
    """Try TripoSR space: two-step (preprocess→generate), then /run, then auto-discover."""
    from gradio_client import handle_file  # noqa: PLC0415

    # Attempt 1: two-step
    try:
        processed = client.predict(
            handle_file(image_path),
            False,   # do_remove_background (already done)
            0.85,    # foreground_ratio
            api_name="/preprocess",
        )
        if isinstance(processed, dict):
            processed = processed.get("path") or processed.get("value") or image_path
        if not isinstance(processed, str) or not os.path.exists(processed):
            processed = image_path
        result = client.predict(handle_file(processed), 256, api_name="/generate")
        return _load_result_bytes(result)
    except Exception:
        pass

    # Attempt 2: single /run
    try:
        result = client.predict(handle_file(image_path), api_name="/run")
        return _load_result_bytes(result)
    except Exception:
        pass

    # Attempt 3: first auto-discovered endpoint
    api_info  = client.view_api(return_format="dict")
    endpoints = list(api_info.get("named_endpoints", {}).keys())
    if not endpoints:
        raise RuntimeError("No endpoints found")
    result = client.predict(handle_file(image_path), api_name=endpoints[0])
    return _load_result_bytes(result)


def _call_instantmesh(client, image_path: str) -> bytes:
    """Try InstantMesh space (different API from TripoSR)."""
    from gradio_client import handle_file  # noqa: PLC0415

    # Try documented InstantMesh API
    try:
        result = client.predict(
            handle_file(image_path),
            True,   # do_remove_background
            42,     # seed
            75,     # steps
            api_name="/generate_mesh",
        )
        return _load_result_bytes(result)
    except Exception:
        pass

    # Fallback: auto-discover
    try:
        api_info  = client.view_api(return_format="dict")
        endpoints = list(api_info.get("named_endpoints", {}).keys())
        if endpoints:
            result = client.predict(handle_file(image_path), api_name=endpoints[0])
            return _load_result_bytes(result)
    except Exception:
        pass

    raise RuntimeError("InstantMesh: no working endpoint found")


def _call_generic(client, image_path: str) -> bytes:
    """Generic fallback: try /predict then first auto-discovered endpoint."""
    from gradio_client import handle_file  # noqa: PLC0415

    try:
        result = client.predict(handle_file(image_path), api_name="/predict")
        return _load_result_bytes(result)
    except Exception:
        pass

    api_info  = client.view_api(return_format="dict")
    endpoints = list(api_info.get("named_endpoints", {}).keys())
    if not endpoints:
        raise RuntimeError("No endpoints found")
    result = client.predict(handle_file(image_path), api_name=endpoints[0])
    return _load_result_bytes(result)


def _call_space(entry: dict, image_path: str) -> bytes:
    """Dispatch to the correct handler based on space type."""
    from gradio_client import Client  # noqa: PLC0415

    token  = HF_TOKEN or None
    client = Client(entry["space"], token=token)

    kind = entry.get("type", "generic")
    if kind == "triposr":
        return _call_triposr(client, image_path)
    elif kind == "instantmesh":
        return _call_instantmesh(client, image_path)
    else:
        return _call_generic(client, image_path)


def reconstruct_3d(image_bytes: bytes) -> bytes:
    """
    Reconstruct 3D model from PNG/JPEG image bytes.
    Returns GLB bytes.
    Tries each space in RECONSTRUCTION_CHAIN until one succeeds.
    """
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp.write(image_bytes)
        img_path = tmp.name

    try:
        last_error: Optional[Exception] = None
        for entry in RECONSTRUCTION_CHAIN:
            for attempt, delay in enumerate([0, 5, 15]):
                if delay:
                    time.sleep(delay)
                try:
                    raw_bytes = _call_space(entry, img_path)
                    return _ensure_glb(raw_bytes)
                except Exception as e:
                    last_error = e
                    if "too many requests" in str(e).lower() or "rate" in str(e).lower():
                        time.sleep(30)
                    continue
        raise RuntimeError(f"All reconstruction spaces failed. Last: {last_error}")
    finally:
        try:
            os.unlink(img_path)
        except OSError:
            pass


def _ensure_glb(mesh_bytes: bytes) -> bytes:
    """Convert mesh to GLB format using trimesh if it's not already GLB."""
    import trimesh  # noqa: PLC0415

    if mesh_bytes[:4] == b"glTF":
        return mesh_bytes

    try:
        ext = "obj"
        if mesh_bytes[:4] in (b"<glt", b"{\n \""):
            ext = "gltf"
        mesh = trimesh.load(io.BytesIO(mesh_bytes), file_type=ext)
        buf  = io.BytesIO()
        if isinstance(mesh, trimesh.Scene):
            mesh.export(buf, file_type="glb")
        else:
            trimesh.Scene(mesh).export(buf, file_type="glb")
        return buf.getvalue()
    except Exception:
        return mesh_bytes


def check_health() -> dict:
    """Check availability of reconstruction spaces (fast check)."""
    from gradio_client import Client  # noqa: PLC0415

    results = {}
    for entry in RECONSTRUCTION_CHAIN:
        space = entry["space"]
        try:
            Client(space, token=HF_TOKEN or None)
            results[space] = "available"
        except Exception as e:
            results[space] = f"unavailable: {str(e)[:80]}"
    return results
