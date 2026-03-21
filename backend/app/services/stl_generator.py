"""
STL generator — LEGO-compatible brick geometry.

Dimensions per Bartneck / official technical drawing #3001.
All units: millimetres.  Studs are smooth (no logo, no text).

Body clearance: 0.1 mm each side (0.2 mm total) so bricks slide
next to each other without friction but without play.
"""

import io
import math
import zipfile
from typing import Any

import numpy as np

# ── Physical constants (mm) ───────────────────────────────────────────────────
STUD_PITCH   = 8.0          # centre-to-centre distance
STUD_R       = 2.4          # stud radius  (diameter 4.8 mm)
STUD_H       = 1.8          # stud height above body top
WALL         = 1.2          # side / end wall thickness
CEILING      = 1.0          # top wall (ceiling) thickness
BRICK_H      = 9.6          # body height — standard brick  (3 plates)
PLATE_H      = 3.2          # body height — plate
CLEARANCE    = 0.2          # total XY clearance (0.1 mm per side)
TUBE_OUT_R   = 6.51 / 2     # anti-stud tube outer radius
TUBE_IN_R    = 4.80 / 2     # anti-stud tube inner radius  (= stud diameter)
RIB_T        = 0.8          # rib thickness (1×N bricks)
RIB_D        = 0.6          # rib protrusion depth from inner wall
SEG          = 24           # cylinder polygon segments  (≥24 for smooth print)


# ── Primitive helpers ─────────────────────────────────────────────────────────

def _p(x: float, y: float, z: float) -> np.ndarray:
    return np.array([x, y, z], dtype=np.float32)


def _quad(a: np.ndarray, b: np.ndarray,
          c: np.ndarray, d: np.ndarray) -> list[np.ndarray]:
    """Two CCW triangles from a planar quad a→b→c→d.
    Normal = (b-a) × (c-a) by right-hand rule."""
    return [
        np.array([a, b, c], dtype=np.float32),
        np.array([a, c, d], dtype=np.float32),
    ]


def _circle(cx: float, cy: float, z: float,
            r: float, n: int) -> list[np.ndarray]:
    return [_p(cx + r * math.cos(2 * math.pi * i / n),
               cy + r * math.sin(2 * math.pi * i / n), z)
            for i in range(n)]


def _cylinder(cx: float, cy: float, z0: float,
              r: float, h: float, n: int = SEG,
              cap_bot: bool = True, cap_top: bool = True) -> list[np.ndarray]:
    """Solid cylinder, normals pointing outward."""
    tris: list[np.ndarray] = []
    bot = _circle(cx, cy, z0,     r, n)
    top = _circle(cx, cy, z0 + h, r, n)
    ct  = _p(cx, cy, z0 + h)
    cb  = _p(cx, cy, z0)
    for i in range(n):
        j = (i + 1) % n
        tris += _quad(bot[i], bot[j], top[j], top[i])          # side
        if cap_top:
            tris.append(np.array([ct, top[i], top[j]], dtype=np.float32))
        if cap_bot:
            tris.append(np.array([cb, bot[j], bot[i]], dtype=np.float32))
    return tris


def _tube(cx: float, cy: float, z0: float,
          outer_r: float, inner_r: float,
          h: float, n: int = SEG) -> list[np.ndarray]:
    """Hollow annular tube — watertight."""
    tris: list[np.ndarray] = []
    ob = _circle(cx, cy, z0,     outer_r, n)
    ot = _circle(cx, cy, z0 + h, outer_r, n)
    ib = _circle(cx, cy, z0,     inner_r, n)
    it = _circle(cx, cy, z0 + h, inner_r, n)
    for i in range(n):
        j = (i + 1) % n
        tris += _quad(ob[i], ob[j], ot[j], ot[i])          # outer wall
        tris += _quad(ib[j], ib[i], it[i], it[j])          # inner wall (rev)
        tris += _quad(ot[i], ot[j], it[j], it[i])          # top annulus
        tris += _quad(ob[j], ob[i], ib[i], ib[j])          # bot annulus (rev)
    return tris


def _box(x0: float, y0: float, z0: float,
         x1: float, y1: float, z1: float) -> list[np.ndarray]:
    """Solid axis-aligned box, normals pointing outward, 6 faces."""
    p = _p
    tris: list[np.ndarray] = []
    tris += _quad(p(x0,y0,z0), p(x1,y0,z0), p(x1,y0,z1), p(x0,y0,z1))  # front -y
    tris += _quad(p(x1,y1,z0), p(x0,y1,z0), p(x0,y1,z1), p(x1,y1,z1))  # back  +y
    tris += _quad(p(x0,y1,z0), p(x0,y0,z0), p(x0,y0,z1), p(x0,y1,z1))  # left  -x
    tris += _quad(p(x1,y0,z0), p(x1,y1,z0), p(x1,y1,z1), p(x1,y0,z1))  # right +x
    tris += _quad(p(x0,y0,z1), p(x1,y0,z1), p(x1,y1,z1), p(x0,y1,z1))  # top   +z
    tris += _quad(p(x1,y0,z0), p(x0,y0,z0), p(x0,y1,z0), p(x1,y1,z0))  # bot   -z
    return tris


def _hollow_body(bw: float, bd: float, bh: float) -> list[np.ndarray]:
    """
    Hollow brick body open at the bottom (z = 0).

    Geometry:
      • 4 outer side faces + outer top face
      • 4 inner side faces + inner ceiling face
      • 4 bottom rim strips connecting outer and inner walls at z = 0
    """
    W  = WALL
    C  = CEILING
    ch = bh - C          # cavity height (floor to ceiling)
    # Inner bounds
    ix0, ix1 = W, bw - W
    iy0, iy1 = W, bd - W
    p = _p
    tris: list[np.ndarray] = []

    # ── Outer faces (5, no bottom) ────────────────────────────────────────────
    tris += _quad(p(0,0,0),  p(bw,0,0),  p(bw,0,bh),  p(0,0,bh) )   # front -y
    tris += _quad(p(bw,bd,0),p(0,bd,0),  p(0,bd,bh),  p(bw,bd,bh))   # back  +y
    tris += _quad(p(0,bd,0), p(0,0,0),   p(0,0,bh),   p(0,bd,bh) )   # left  -x
    tris += _quad(p(bw,0,0), p(bw,bd,0), p(bw,bd,bh), p(bw,0,bh))    # right +x
    tris += _quad(p(0,0,bh), p(bw,0,bh), p(bw,bd,bh), p(0,bd,bh))    # top   +z

    # ── Inner faces (reversed normals — cavity walls) ─────────────────────────
    # inner front  (+y normal → faces interior)
    tris += _quad(p(ix1,iy0,0), p(ix0,iy0,0), p(ix0,iy0,ch), p(ix1,iy0,ch))
    # inner back   (-y normal)
    tris += _quad(p(ix0,iy1,0), p(ix1,iy1,0), p(ix1,iy1,ch), p(ix0,iy1,ch))
    # inner left   (+x normal)
    tris += _quad(p(ix0,iy0,0), p(ix0,iy1,0), p(ix0,iy1,ch), p(ix0,iy0,ch))
    # inner right  (-x normal)
    tris += _quad(p(ix1,iy1,0), p(ix1,iy0,0), p(ix1,iy0,ch), p(ix1,iy1,ch))
    # ceiling      (-z normal, faces down into cavity)
    tris += _quad(p(ix0,iy0,ch), p(ix0,iy1,ch), p(ix1,iy1,ch), p(ix1,iy0,ch))

    # ── Bottom rim (4 strips, normal -z) ──────────────────────────────────────
    # front strip  x=[0,bw]          y=[0, W]
    tris += _quad(p(ix0,iy0,0), p(ix1,iy0,0), p(bw,0,0),   p(0,0,0)  )
    # back strip   x=[0,bw]          y=[bd-W, bd]
    tris += _quad(p(ix1,iy1,0), p(ix0,iy1,0), p(0,bd,0),   p(bw,bd,0))
    # left strip   x=[0, W]          y=[W, bd-W]
    tris += _quad(p(ix0,iy1,0), p(ix0,iy0,0), p(0,iy0,0),  p(0,iy1,0))
    # right strip  x=[bw-W, bw]      y=[W, bd-W]
    tris += _quad(p(ix1,iy0,0), p(ix1,iy1,0), p(bw,iy1,0), p(bw,iy0,0))

    return tris


def _rib(x0: float, y_c: float, z0: float,
         depth: float, thickness: float, height: float) -> list[np.ndarray]:
    """Rectangular rib protruding from an inner wall."""
    return _box(x0, y_c - thickness / 2, z0,
                x0 + depth, y_c + thickness / 2, z0 + height)


# ── STL writer ────────────────────────────────────────────────────────────────

def _write_stl(triangles: list[np.ndarray]) -> bytes:
    """Binary STL.  Normals computed from vertex winding."""
    buf = io.BytesIO()
    buf.write(b"DemiBrick" + b"\x00" * 71)           # 80-byte header
    buf.write(np.uint32(len(triangles)).tobytes())
    for tri in triangles:
        v0, v1, v2 = tri[0], tri[1], tri[2]
        n = np.cross(v1 - v0, v2 - v0).astype(np.float32)
        ln = float(np.linalg.norm(n))
        if ln > 0:
            n /= ln
        buf.write(n.tobytes())
        buf.write(v0.astype(np.float32).tobytes())
        buf.write(v1.astype(np.float32).tobytes())
        buf.write(v2.astype(np.float32).tobytes())
        buf.write(b"\x00\x00")
    return buf.getvalue()


# ── Public API ────────────────────────────────────────────────────────────────

def generate_brick_stl(
    w: int,
    d: int,
    h: int = 1,
    calibration: dict[str, float] | None = None,
) -> bytes:
    """
    Generate a LEGO-compatible brick / plate STL.

    Parameters
    ----------
    w : int   — width in studs
    d : int   — depth in studs
    h : int   — height in plate-heights  (1 = plate 3.2 mm, 3 = brick 9.6 mm)
    calibration : optional tolerance adjustments in mm
        stud_adj  — add to stud diameter   (+0.1 → tighter, -0.1 → looser)
        hole_adj  — add to tube inner dia  (+0.1 → looser fit for incoming studs)
        body_adj  — add to body XY dims    (usually 0)
    """
    cal       = calibration or {}
    body_h    = h * PLATE_H                                   # total body height
    body_w    = w * STUD_PITCH - CLEARANCE + cal.get("body_adj", 0.0)
    body_d    = d * STUD_PITCH - CLEARANCE + cal.get("body_adj", 0.0)
    cav_h     = body_h - CEILING                              # cavity depth
    stud_r    = STUD_R    + cal.get("stud_adj", 0.0) / 2
    tube_in_r = TUBE_IN_R + cal.get("hole_adj", 0.0) / 2

    tris: list[np.ndarray] = []

    # ── 1. Hollow body ────────────────────────────────────────────────────────
    tris += _hollow_body(body_w, body_d, body_h)

    # ── 2. Studs (smooth cylinders, no logo) ─────────────────────────────────
    for sx in range(w):
        for sy in range(d):
            cx = (sx + 0.5) * STUD_PITCH - CLEARANCE / 2
            cy = (sy + 0.5) * STUD_PITCH - CLEARANCE / 2
            tris += _cylinder(cx, cy, body_h, stud_r, STUD_H,
                               cap_bot=False, cap_top=True)

    # ── 3. Internal geometry ──────────────────────────────────────────────────
    if w >= 2:
        # Anti-stud tubes at every stud-grid intersection inside the body
        for tx in range(1, w):
            for ty in range(1, d):
                tcx = tx * STUD_PITCH - CLEARANCE / 2
                tcy = ty * STUD_PITCH - CLEARANCE / 2
                tris += _tube(tcx, tcy, 0.0, TUBE_OUT_R, tube_in_r, cav_h)

    elif w == 1 and d >= 2:
        # Ribs on both inner side walls for 1×N bricks / plates
        for ty in range(1, d):
            rib_cy = ty * STUD_PITCH - CLEARANCE / 2
            # Left inner wall (x = WALL) → rib protrudes rightward
            tris += _rib(WALL, rib_cy, 0.0, RIB_D, RIB_T, cav_h)
            # Right inner wall (x = body_w - WALL) → rib protrudes leftward
            tris += _rib(body_w - WALL - RIB_D, rib_cy, 0.0, RIB_D, RIB_T, cav_h)

    return _write_stl(tris)


def generate_plate_stl(width: int, length: int) -> bytes:
    """Convenience alias — plate is h=1."""
    return generate_brick_stl(width, length, h=1)


def generate_calibration_strip() -> bytes:
    """
    Five 1×1 plates side by side, each with a different stud height:
    1.6 / 1.7 / 1.8 / 1.9 / 2.0 mm — print once, find the best fit
    against a real LEGO brick.
    """
    tris: list[np.ndarray] = []
    for i, sh in enumerate([1.6, 1.7, 1.8, 1.9, 2.0]):
        xoff = i * STUD_PITCH * 2.0
        bw   = STUD_PITCH - CLEARANCE
        bd   = STUD_PITCH - CLEARANCE
        bh   = PLATE_H
        # Solid base (no cavity — simpler for calibration piece)
        tris += [np.array([[xoff + v[0], v[1], v[2]], *rest], dtype=np.float32)
                 if False else tri
                 for tri in _box(xoff, 0, 0, xoff + bw, bd, bh)]
        # Single stud with this height variant
        cx = xoff + bw / 2
        cy = bd / 2
        tris += _cylinder(cx, cy, bh, STUD_R, sh, cap_bot=False, cap_top=True)
    return _write_stl(tris)


def generate_all_stls(bom: list[dict[str, Any]]) -> bytes:
    """
    Generate a ZIP with one STL per unique brick / plate type in the BOM,
    plus a README.txt with print recommendations.
    """
    # Collect unique piece types
    piece_types: dict[str, tuple[int, int, int]] = {}   # name → (w, d, h_plates)
    for entry in bom:
        name = entry.get("name", "")
        if name in piece_types:
            continue
        try:
            kind, dims = name.replace("×", "x").lower().split(" ", 1)
            w_str, d_str = dims.split("x")
            w, d = int(w_str), int(d_str)
            h = 3 if kind == "brick" else 1
            piece_types[name] = (w, d, h)
        except Exception:
            continue

    # Count quantities
    qty: dict[str, int] = {}
    for entry in bom:
        n = entry.get("name", "")
        qty[n] = qty.get(n, 0) + entry.get("count", 0)

    readme_lines = [
        "DemiBrick — 3D Print Guide",
        "=" * 40,
        "",
        "Recommended settings:",
        "  Layer height : 0.16 – 0.20 mm",
        "  Nozzle       : 0.4 mm",
        "  Infill       : 15 – 20 %",
        "  Material     : PLA (standard) or PETG (stronger)",
        "  Supports     : none needed",
        "  Orientation  : studs facing up (best stud quality)",
        "",
        "Parts list:",
    ]
    for name, (w, d, _) in piece_types.items():
        readme_lines.append(f"  {name:20s}  {qty.get(name, 0):>4} pcs")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("README.txt", "\n".join(readme_lines))
        for name, (w, d, h) in piece_types.items():
            stl_bytes = generate_brick_stl(w, d, h)
            filename = name.replace(" ", "_").replace("×", "x") + ".stl"
            zf.writestr(filename, stl_bytes)

    return buf.getvalue()
