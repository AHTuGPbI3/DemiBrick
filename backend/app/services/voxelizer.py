"""
3D voxelizer: mesh → color_grid[z][y][x].
Surface sampling maps each voxel to the nearest Bambu Lab color.
"""

import io
from collections import Counter
from typing import Any

import numpy as np
import trimesh
from trimesh.proximity import closest_point

from app.services.bambu_colors import (
    find_nearest_color_batch,
    get_active_palette,
    set_active_palette,
)

# Interior fill color (Jade White — minimal visible material)
INTERIOR_COLOR_ID = "basic-01"

VALID_RESOLUTIONS = (8, 16, 24, 32)


def voxelize_mesh(
    mesh_bytes: bytes,
    resolution: int,
    filament_types: list[str] | None = None,
    custom_color_ids: list[str] | None = None,
) -> dict[str, Any]:
    """
    Voxelize a cleaned GLB mesh and map each surface voxel to a Bambu color.

    Returns:
        voxel_grid    – list[list[list[str|None]]]  [z][y][x]  (None = empty)
        dimensions    – {w, d, h}
        total_voxels  – int
        color_summary – list[{color_id, name, hex, filament_type, count}]
        spools_needed – list[str] of color names
    """
    if resolution not in VALID_RESOLUTIONS:
        raise ValueError(f"resolution must be one of {list(VALID_RESOLUTIONS)}")

    # Activate palette
    if custom_color_ids:
        set_active_palette(custom_ids=custom_color_ids)
    elif filament_types:
        set_active_palette(filament_types=filament_types)
    else:
        set_active_palette(filament_types=["PLA Basic"])

    # Load mesh
    mesh = _load_mesh(mesh_bytes)

    # Scale to resolution³
    mesh = _scale_to_resolution(mesh, resolution)

    # Voxelize (pitch = 1 unit = 1 stud)
    vg = mesh.voxelized(pitch=1.0)
    vg = vg.fill()  # fill interior

    grid_matrix = vg.matrix        # bool[nx, ny, nz]
    nx, ny, nz = grid_matrix.shape

    # Map (ix, iy, iz) → center point in world coords
    voxel_centers = vg.indices_to_points(
        np.argwhere(grid_matrix)
    )  # shape [n, 3]

    # Get colors for surface voxels by querying nearest mesh point
    occupied_indices = np.argwhere(grid_matrix)  # [n, 3]: (ix, iy, iz)
    colors_rgb = _sample_colors(mesh, voxel_centers)  # [n, 3] uint8

    # Map each RGB → palette index
    palette = get_active_palette()
    n = len(colors_rgb)
    # reshape for find_nearest_color_batch
    rgb_2d = colors_rgb.reshape(1, n, 3)
    color_idx_flat = find_nearest_color_batch(rgb_2d)[0]  # [n]

    # Build 3D color grid [z][y][x] using color_id strings
    # trimesh voxel axes: x=first, y=second, z=third → we want [z][y][x]
    voxel_map: dict[tuple, str] = {}
    for i, (ix, iy, iz) in enumerate(occupied_indices):
        voxel_map[(ix, iy, iz)] = palette[int(color_idx_flat[i])]["id"]

    # Fill interior voxels (occupied but not on surface) with interior color
    # "interior" = occupied in the filled grid but not in the unfilled
    try:
        vg_surface = mesh.voxelized(pitch=1.0)
        surface_matrix = vg_surface.matrix
        interior_mask = grid_matrix & ~surface_matrix
        for ix, iy, iz in np.argwhere(interior_mask):
            voxel_map[(ix, iy, iz)] = INTERIOR_COLOR_ID
    except Exception:
        pass  # skip interior fill if it fails

    # Build nested list [z][y][x]
    voxel_grid: list[list[list]] = []
    for iz in range(nz):
        layer = []
        for iy in range(ny):
            row = []
            for ix in range(nx):
                row.append(voxel_map.get((ix, iy, iz)))
            layer.append(row)
        voxel_grid.append(layer)

    # Color summary
    all_ids = [v for v in voxel_map.values() if v is not None]
    id_counts = Counter(all_ids)
    palette_by_id = {c["id"]: c for c in palette}

    color_summary = [
        {
            "color_id":      cid,
            "name":          palette_by_id[cid]["name"] if cid in palette_by_id else cid,
            "hex":           palette_by_id[cid]["hex"] if cid in palette_by_id else "#888888",
            "filament_type": palette_by_id[cid]["type"] if cid in palette_by_id else "PLA Basic",
            "count":         cnt,
        }
        for cid, cnt in sorted(id_counts.items(), key=lambda x: -x[1])
    ]

    spools_needed = list({c["name"] for c in color_summary})

    return {
        "voxel_grid":    voxel_grid,
        "dimensions":    {"w": nx, "d": ny, "h": nz},
        "total_voxels":  len(occupied_indices),
        "color_summary": color_summary,
        "spools_needed": spools_needed,
    }


# ── helpers ──────────────────────────────────────────────────────────────────

def _load_mesh(mesh_bytes: bytes) -> trimesh.Trimesh:
    """Load GLB/OBJ bytes → single Trimesh."""
    try:
        result = trimesh.load(io.BytesIO(mesh_bytes), file_type="glb", force="mesh")
    except Exception:
        result = trimesh.load(io.BytesIO(mesh_bytes), force="mesh")

    if isinstance(result, trimesh.Scene):
        geometries = [g for g in result.geometry.values() if len(g.faces) > 0]
        if not geometries:
            raise ValueError("Empty mesh scene")
        result = trimesh.util.concatenate(geometries)

    if not isinstance(result, trimesh.Trimesh) or len(result.faces) == 0:
        raise ValueError("Could not load a valid mesh")

    return result


def _scale_to_resolution(mesh: trimesh.Trimesh, resolution: int) -> trimesh.Trimesh:
    """
    Center mesh and scale so the longest axis spans `resolution` units.
    """
    mesh = mesh.copy()
    mesh.vertices -= mesh.bounds.mean(axis=0)
    extent = mesh.extents.max()
    if extent > 0:
        mesh.apply_scale(resolution / extent)
    return mesh


def _sample_colors(mesh: trimesh.Trimesh, points: np.ndarray) -> np.ndarray:
    """
    Sample RGB colors at each query point by projecting onto the mesh surface.
    Returns uint8 array of shape [n, 3].
    """
    if len(points) == 0:
        return np.zeros((0, 3), dtype=np.uint8)

    # Get vertex colors
    vc = _get_vertex_colors(mesh)

    if vc is None:
        # No color info — return mid-gray
        return np.full((len(points), 3), 128, dtype=np.uint8)

    # Find nearest mesh point for each voxel center
    try:
        _, _, tri_indices = closest_point(mesh, points)
        # Average vertex colors across triangle vertices
        face_verts = mesh.faces[tri_indices]            # [n, 3]
        colors = vc[face_verts].mean(axis=1)            # [n, 3]
        return colors.astype(np.uint8)
    except Exception:
        return np.full((len(points), 3), 128, dtype=np.uint8)


def _get_vertex_colors(mesh: trimesh.Trimesh) -> np.ndarray | None:
    """Extract vertex colors (RGB uint8) from mesh visual, or None."""
    try:
        if hasattr(mesh.visual, "vertex_colors") and mesh.visual.vertex_colors is not None:
            vc = np.array(mesh.visual.vertex_colors)
            if vc.ndim == 2 and vc.shape[1] >= 3:
                return vc[:, :3].astype(np.uint8)
        if hasattr(mesh.visual, "to_color"):
            vc_obj = mesh.visual.to_color()
            vc = np.array(vc_obj.vertex_colors)
            if vc.ndim == 2 and vc.shape[1] >= 3:
                return vc[:, :3].astype(np.uint8)
    except Exception:
        pass
    return None
