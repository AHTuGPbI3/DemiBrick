"""
STL generator for LEGO-compatible plates.
Generates realistic plate geometry: base + studs + anti-stud tubes.
"""

import io
import zipfile
from typing import Any

import numpy as np

# LEGO dimensions in mm
STUD_PITCH   = 8.0
PLATE_HEIGHT = 3.2
STUD_RADIUS  = 2.4    # outer radius
STUD_HEIGHT  = 1.8
TUBE_OUTER   = 3.25   # anti-stud tube outer radius
TUBE_INNER   = 2.4    # anti-stud tube inner radius
WALL         = 1.5    # plate wall thickness
SEGMENTS     = 16     # polygon segments for cylinders


def _cylinder_mesh(
    cx: float, cz: float,
    radius: float, height: float,
    y_base: float,
    segments: int = SEGMENTS,
    invert: bool = False,
) -> tuple[np.ndarray, np.ndarray]:
    """Build cylinder triangles. Returns (vertices, faces)."""
    angles = np.linspace(0, 2 * np.pi, segments, endpoint=False)
    top_y  = y_base + height
    bot_y  = y_base

    verts = []
    # Bottom centre
    verts.append([cx, bot_y, cz])
    # Bottom ring
    for a in angles:
        verts.append([cx + radius * np.cos(a), bot_y, cz + radius * np.sin(a)])
    # Top centre
    verts.append([cx, top_y, cz])
    # Top ring
    for a in angles:
        verts.append([cx + radius * np.cos(a), top_y, cz + radius * np.sin(a)])

    verts = np.array(verts, dtype=np.float32)
    n = segments

    faces = []
    # Bottom cap
    for i in range(n):
        faces.append([0, 1 + (i + 1) % n, 1 + i])
    # Top cap
    top_c = n + 1
    for i in range(n):
        faces.append([top_c, top_c + 1 + i, top_c + 1 + (i + 1) % n])
    # Side quads → triangles
    for i in range(n):
        a = 1 + i
        b = 1 + (i + 1) % n
        c = top_c + 1 + (i + 1) % n
        d = top_c + 1 + i
        faces.append([a, b, c])
        faces.append([a, c, d])

    if invert:
        faces = [[f[0], f[2], f[1]] for f in faces]

    return verts, np.array(faces, dtype=np.int32)


def _box_mesh(x0: float, y0: float, z0: float,
              x1: float, y1: float, z1: float) -> tuple[np.ndarray, np.ndarray]:
    """Axis-aligned box."""
    verts = np.array([
        [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
        [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ], dtype=np.float32)
    faces = np.array([
        [0,1,2],[0,2,3],   # front
        [5,4,7],[5,7,6],   # back
        [4,0,3],[4,3,7],   # left
        [1,5,6],[1,6,2],   # right
        [3,2,6],[3,6,7],   # top
        [4,5,1],[4,1,0],   # bottom
    ], dtype=np.int32)
    return verts, faces


def _merge(meshes: list[tuple[np.ndarray, np.ndarray]]) -> tuple[np.ndarray, np.ndarray]:
    all_verts, all_faces = [], []
    offset = 0
    for v, f in meshes:
        all_verts.append(v)
        all_faces.append(f + offset)
        offset += len(v)
    return np.vstack(all_verts), np.vstack(all_faces)


def _write_stl(verts: np.ndarray, faces: np.ndarray) -> bytes:
    """Binary STL."""
    buf = io.BytesIO()
    buf.write(b"\x00" * 80)                      # header
    buf.write(np.uint32(len(faces)).tobytes())    # triangle count

    v0 = verts[faces[:, 0]]
    v1 = verts[faces[:, 1]]
    v2 = verts[faces[:, 2]]
    normals = np.cross(v1 - v0, v2 - v0)
    norms = np.linalg.norm(normals, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    normals /= norms

    for i in range(len(faces)):
        buf.write(normals[i].astype(np.float32).tobytes())
        buf.write(v0[i].astype(np.float32).tobytes())
        buf.write(v1[i].astype(np.float32).tobytes())
        buf.write(v2[i].astype(np.float32).tobytes())
        buf.write(b"\x00\x00")                   # attribute byte count

    return buf.getvalue()


def generate_plate_stl(width: int, length: int) -> bytes:
    """
    Generate STL for a LEGO-compatible plate of size width×length studs.
    """
    plate_w = width  * STUD_PITCH
    plate_l = length * STUD_PITCH

    meshes: list[tuple[np.ndarray, np.ndarray]] = []

    # Outer shell (hollow box)
    meshes.append(_box_mesh(0, 0, 0, plate_w, PLATE_HEIGHT, plate_l))

    # Studs on top
    for sx in range(width):
        for sl in range(length):
            cx = (sx + 0.5) * STUD_PITCH
            cz = (sl + 0.5) * STUD_PITCH
            v, f = _cylinder_mesh(cx, cz, STUD_RADIUS, STUD_HEIGHT, PLATE_HEIGHT)
            meshes.append((v, f))

    # Anti-stud tubes inside (only for 2×N+ plates)
    if width >= 2 and length >= 2:
        for sx in range(width - 1):
            for sl in range(length - 1):
                cx = (sx + 1) * STUD_PITCH
                cz = (sl + 1) * STUD_PITCH
                # Outer
                v_out, f_out = _cylinder_mesh(cx, cz, TUBE_OUTER, PLATE_HEIGHT - WALL, WALL)
                # Inner (inverted normals = hollow)
                v_in, f_in = _cylinder_mesh(cx, cz, TUBE_INNER, PLATE_HEIGHT - WALL, WALL, invert=True)
                meshes.append((v_out, f_out))
                meshes.append((v_in, f_in))

    verts, faces = _merge(meshes)
    return _write_stl(verts, faces)


def generate_all_stls(bom: list[dict[str, Any]]) -> bytes:
    """
    Generate a ZIP file with one STL per unique plate type in BOM,
    plus a README.txt with printing recommendations.
    """
    buf = io.BytesIO()

    # Unique plate types
    plate_types: dict[str, tuple[int, int]] = {}
    for entry in bom:
        name = entry["name"]  # e.g. "Plate 2×4"
        if name not in plate_types:
            try:
                # Parse "Plate WxH" or "Plate W×H"
                dims = name.replace("×", "x").split(" ")[1].split("x")
                w, h = int(dims[0]), int(dims[1])
                plate_types[name] = (w, h)
            except Exception:
                continue

    readme = "DemiBrick — 3D Print Instructions\n"
    readme += "=" * 40 + "\n\n"
    readme += "Recommended print settings:\n"
    readme += "  Layer height:  0.2 mm\n"
    readme += "  Infill:        20%\n"
    readme += "  Material:      PLA\n"
    readme += "  Support:       None\n\n"
    readme += "Parts:\n"

    # Count by part type
    part_counts: dict[str, int] = {}
    for entry in bom:
        part_counts[entry["name"]] = part_counts.get(entry["name"], 0) + entry["count"]

    for name, (w, h) in plate_types.items():
        count = part_counts.get(name, 0)
        readme += f"  {name}: {count} pcs\n"

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("README.txt", readme)
        for name, (w, h) in plate_types.items():
            stl_bytes = generate_plate_stl(w, h)
            filename = f"{name.replace(' ', '_').replace('×', 'x')}.stl"
            zf.writestr(filename, stl_bytes)

    return buf.getvalue()
