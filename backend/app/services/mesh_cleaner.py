"""
Mesh cleanup pipeline using trimesh.
Fixes normals, winding, holes; merges vertices; falls back to convex hull.
"""

import io
import trimesh
import numpy as np


def clean_mesh(mesh_bytes: bytes, file_type: str = "glb") -> bytes:
    """
    Load mesh, apply repair pipeline, return cleaned GLB bytes.

    Pipeline:
      fix_normals → fix_winding → fill_holes → merge_vertices → convex_hull fallback
    """
    mesh = _load(mesh_bytes, file_type)
    mesh = _repair(mesh)
    return _to_glb(mesh)


def _load(mesh_bytes: bytes, file_type: str) -> trimesh.Trimesh:
    """Load bytes → single Trimesh, concatenating scenes."""
    result = trimesh.load(io.BytesIO(mesh_bytes), file_type=file_type, force="mesh")
    if isinstance(result, trimesh.Scene):
        geometries = list(result.geometry.values())
        if not geometries:
            raise ValueError("Empty scene — no geometry found")
        result = trimesh.util.concatenate(geometries)
    if not isinstance(result, trimesh.Trimesh):
        raise ValueError(f"Expected Trimesh, got {type(result)}")
    return result


def _repair(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Apply full repair pipeline."""
    # 1. Merge duplicate/close vertices
    mesh.merge_vertices()

    # 2. Remove degenerate faces (zero-area)
    mask = mesh.nondegenerate_faces()
    mesh.update_faces(mask)

    # 3. Fix face winding (outward normals)
    trimesh.repair.fix_winding(mesh)

    # 4. Fix normals direction
    trimesh.repair.fix_normals(mesh)

    # 5. Fill small holes
    try:
        trimesh.repair.fill_holes(mesh)
    except Exception:
        pass  # non-fatal — some meshes can't be fully repaired

    # 6. Remove duplicate faces + unreferenced vertices
    mesh.remove_duplicate_faces()
    mesh.remove_unreferenced_vertices()

    # 7. Convex hull fallback if mesh is still degenerate
    if not mesh.is_valid or len(mesh.faces) < 4:
        try:
            mesh = mesh.convex_hull
        except Exception:
            pass

    # 8. Center at origin, normalize to unit cube for stable voxelization
    mesh.vertices -= mesh.center_mass
    extents = mesh.extents
    if extents.max() > 0:
        mesh.apply_scale(1.0 / extents.max())

    return mesh


def _to_glb(mesh: trimesh.Trimesh) -> bytes:
    """Export Trimesh → GLB bytes."""
    scene = trimesh.Scene(mesh)
    buf = io.BytesIO()
    scene.export(buf, file_type="glb")
    return buf.getvalue()


def get_mesh_info(mesh_bytes: bytes, file_type: str = "glb") -> dict:
    """Return basic stats about a mesh."""
    mesh = _load(mesh_bytes, file_type)
    return {
        "vertices": len(mesh.vertices),
        "faces": len(mesh.faces),
        "is_valid": mesh.is_valid,
        "is_watertight": mesh.is_watertight,
        "extents": mesh.extents.tolist(),
        "volume": float(mesh.volume) if mesh.is_watertight else None,
    }
