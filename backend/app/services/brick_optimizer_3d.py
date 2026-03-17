"""
3D brick optimizer — faBrickation-inspired algorithm.

Pipeline:
  1. MERGE    – greedy 2D plate placement per layer (largest→smallest)
  2. GRAPH    – build brick connectivity graph (floor contact + XY overlap ≥ 1 stud)
  3. WEAK     – find bricks with ≤ 1 connections (except ground floor)
  4. RELAYOUT – break weak bricks, re-merge with stagger offset
  Repeat 2-4 up to MAX_ITER times until stable.
"""

from collections import defaultdict
from typing import Any

from app.services.bambu_colors import get_active_palette

# ── Brick catalogue ───────────────────────────────────────────────────────────

from dataclasses import dataclass


@dataclass(frozen=True)
class BrickDef:
    name: str
    part: str
    w: int   # studs X
    d: int   # studs Y
    h: int   # plate-heights (1=plate, 3=brick)


PLATES: list[BrickDef] = [
    BrickDef("Plate 2×8",  "3034", 2, 8, 1),
    BrickDef("Plate 2×6",  "3795", 2, 6, 1),
    BrickDef("Plate 2×4",  "3020", 2, 4, 1),
    BrickDef("Plate 2×3",  "3021", 2, 3, 1),
    BrickDef("Plate 2×2",  "3022", 2, 2, 1),
    BrickDef("Plate 1×8",  "3460", 1, 8, 1),
    BrickDef("Plate 1×6",  "3666", 1, 6, 1),
    BrickDef("Plate 1×4",  "3710", 1, 4, 1),
    BrickDef("Plate 1×3",  "3623", 1, 3, 1),
    BrickDef("Plate 1×2",  "3023", 1, 2, 1),
    BrickDef("Plate 1×1",  "3024", 1, 1, 1),
]

BRICKS: list[BrickDef] = [
    BrickDef("Brick 2×6",  "2456", 2, 6, 3),
    BrickDef("Brick 2×4",  "3001", 2, 4, 3),
    BrickDef("Brick 2×3",  "3002", 2, 3, 3),
    BrickDef("Brick 2×2",  "3003", 2, 2, 3),
    BrickDef("Brick 1×6",  "3009", 1, 6, 3),
    BrickDef("Brick 1×4",  "3010", 1, 4, 3),
    BrickDef("Brick 1×3",  "3622", 1, 3, 3),
    BrickDef("Brick 1×2",  "3004", 1, 2, 3),
    BrickDef("Brick 1×1",  "3005", 1, 1, 3),
]

# Sorted by area (largest first) — used in per-layer placement
SORTED_PLATES = sorted(PLATES, key=lambda p: p.w * p.d, reverse=True)

# Full catalogue (plates + bricks) sorted by volume — for future multi-layer merge
ALL_BRICKS = sorted(BRICKS + PLATES, key=lambda b: b.w * b.d * b.h, reverse=True)

MAX_ITER = 5


# ── Public API ────────────────────────────────────────────────────────────────

def optimize_layout_3d(
    voxel_grid: list[list[list]],
    hollow: bool = False,
) -> dict[str, Any]:
    """
    Optimize 3D brick placement over voxel_grid[z][y][x].
    Each cell is a color_id string ("basic-09") or None.

    Returns:
        bricks   – list of brick dicts
        bom      – bill of materials
        stats    – optimization metrics + stability score
    """
    if not voxel_grid:
        return _empty_result()

    nz = len(voxel_grid)
    ny = len(voxel_grid[0]) if nz else 0
    nx = len(voxel_grid[0][0]) if ny else 0

    if hollow:
        voxel_grid = _apply_hollow(voxel_grid, nz, ny, nx)

    # STEP 1: greedy merge per layer
    bricks: list[dict] = []
    for z in range(nz):
        layer_bricks = _merge_layer(voxel_grid[z], z, stagger=0)
        bricks.extend(layer_bricks)

    # STEPS 2-4: stability improvement (max MAX_ITER)
    for _ in range(MAX_ITER):
        adj = _build_graph(bricks)
        weak = _find_weak(bricks, adj)
        if not weak:
            break
        bricks = _relayout(bricks, weak, voxel_grid, adj)

    # Build BOM
    bom = _build_bom(bricks)

    # Stats
    total_voxels = sum(
        1
        for z in range(nz)
        for y in range(ny)
        for x in range(nx)
        if voxel_grid[z][y][x] is not None
    )
    stability = _compute_stability(bricks, _build_graph(bricks))

    return {
        "bricks":             bricks,
        "bom":                bom,
        "total_bricks":       len(bricks),
        "total_voxels":       total_voxels,
        "optimization_ratio": round(total_voxels / len(bricks), 2) if bricks else 1.0,
        "stability":          stability,
    }


# ── Step 1: greedy layer merge ────────────────────────────────────────────────

def _merge_layer(
    layer: list[list],
    z: int,
    stagger: int = 0,
) -> list[dict]:
    """Greedy 2D brick placement for one layer."""
    ny = len(layer)
    nx = len(layer[0]) if ny else 0
    occupied = [[False] * nx for _ in range(ny)]
    placed: list[dict] = []

    palette_cache: dict[str, dict] = {}

    def _palette(cid: str) -> dict:
        if cid not in palette_cache:
            for c in get_active_palette():
                if c["id"] == cid:
                    palette_cache[cid] = c
                    break
            else:
                palette_cache[cid] = {"id": cid, "name": cid, "hex": "#888888", "type": "PLA Basic"}
        return palette_cache[cid]

    for y in range(ny):
        for x in range(nx):
            rx = (x + stagger) % nx  # apply stagger offset
            if occupied[y][rx] or layer[y][rx] is None:
                continue
            cid = layer[y][rx]

            best: BrickDef | None = None
            best_ow, best_od = 1, 1

            # Per-layer: use plates only (h=1) to avoid cross-layer overlap
            for bdef in SORTED_PLATES:
                for bw, bd in _orientations(bdef):
                    if _can_place(layer, occupied, y, rx, bw, bd, cid, ny, nx):
                        best = bdef
                        best_ow, best_od = bw, bd
                        break
                if best:
                    break

            if best:
                _mark(occupied, y, rx, best_ow, best_od)
                p = _palette(cid)
                placed.append({
                    "part":          best.part,
                    "name":          best.name,
                    "color_id":      cid,
                    "color_name":    p["name"],
                    "color_hex":     p["hex"],
                    "filament_type": p["type"],
                    "x":             rx,
                    "y":             y,
                    "z_floor":       z,
                    "w":             best_ow,
                    "d":             best_od,
                    "h":             1,         # plates only per layer
                    "layer":         z,
                })

    return placed


def _can_place(
    layer: list[list], occupied: list[list[bool]],
    row: int, col: int, bw: int, bd: int,
    cid: str, ny: int, nx: int,
) -> bool:
    if row + bd > ny or col + bw > nx:
        return False
    for dy in range(bd):
        for dx in range(bw):
            if occupied[row + dy][col + dx]:
                return False
            if layer[row + dy][col + dx] != cid:
                return False
    return True


def _mark(occupied: list[list[bool]], row: int, col: int, bw: int, bd: int) -> None:
    for dy in range(bd):
        for dx in range(bw):
            occupied[row + dy][col + dx] = True


def _orientations(bdef: BrickDef) -> list[tuple[int, int]]:
    """Both orientations of a brick (w×d and d×w)."""
    result = [(bdef.w, bdef.d)]
    if bdef.w != bdef.d:
        result.append((bdef.d, bdef.w))
    return result


# ── Step 2: connectivity graph ────────────────────────────────────────────────

def _build_graph(bricks: list[dict]) -> list[list[int]]:
    """
    Adjacency list: bricks[i] ↔ bricks[j] if they're on adjacent floors
    and their XY projections overlap by at least 1 stud².
    """
    n = len(bricks)
    adj: list[list[int]] = [[] for _ in range(n)]
    for i in range(n):
        a = bricks[i]
        a_top = a["z_floor"] + a["h"]
        for j in range(i + 1, n):
            b = bricks[j]
            b_top = b["z_floor"] + b["h"]
            # One sits on the other
            if a_top == b["z_floor"] or b_top == a["z_floor"]:
                if _xy_overlap(a, b) >= 1:
                    adj[i].append(j)
                    adj[j].append(i)
    return adj


def _xy_overlap(a: dict, b: dict) -> int:
    """XY projection overlap area in stud²."""
    ox = max(0, min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"]))
    oy = max(0, min(a["y"] + a["d"], b["y"] + b["d"]) - max(a["y"], b["y"]))
    return ox * oy


# ── Step 3: find weak bricks ──────────────────────────────────────────────────

def _find_weak(bricks: list[dict], adj: list[list[int]]) -> set[int]:
    """
    Weak = brick with ≤ 1 structural connection AND not on the ground (z_floor > 0).
    Ground floor bricks (z_floor == 0) are always stable.
    """
    weak: set[int] = set()
    for i, brick in enumerate(bricks):
        if brick["z_floor"] == 0:
            continue
        if len(adj[i]) <= 1:
            weak.add(i)
    return weak


# ── Step 4: relayout ──────────────────────────────────────────────────────────

def _relayout(
    bricks: list[dict],
    weak: set[int],
    voxel_grid: list[list[list]],
    adj: list[list[int]],
) -> list[dict]:
    """
    Break weak bricks + their first-degree neighbors, re-merge with stagger=1.
    Keep all other bricks unchanged.
    """
    to_remove: set[int] = set(weak)
    for i in weak:
        to_remove.update(adj[i])

    kept = [b for idx, b in enumerate(bricks) if idx not in to_remove]

    # Collect affected (z, layer) pairs and re-merge them
    layers_to_redo: set[int] = {bricks[i]["z_floor"] for i in to_remove}

    # Build per-layer occupied masks from kept bricks
    for z in layers_to_redo:
        layer_kept = [b for b in kept if b["z_floor"] == z]
        layer_data = voxel_grid[z]
        ny = len(layer_data)
        nx = len(layer_data[0]) if ny else 0
        occupied = [[False] * nx for _ in range(ny)]
        for b in layer_kept:
            _mark(occupied, b["y"], b["x"], b["w"], b["d"])
        new_bricks = _merge_layer_with_mask(layer_data, z, occupied, stagger=1)
        kept.extend(new_bricks)

    return kept


def _merge_layer_with_mask(
    layer: list[list], z: int,
    pre_occupied: list[list[bool]],
    stagger: int,
) -> list[dict]:
    """Greedy merge respecting pre-existing occupied cells."""
    ny = len(layer)
    nx = len(layer[0]) if ny else 0
    # Copy pre_occupied so we don't mutate the caller's version
    occupied = [row[:] for row in pre_occupied]
    placed: list[dict] = []

    palette_cache: dict[str, dict] = {}

    def _palette(cid: str) -> dict:
        if cid not in palette_cache:
            for c in get_active_palette():
                if c["id"] == cid:
                    palette_cache[cid] = c
                    break
            else:
                palette_cache[cid] = {"id": cid, "name": cid, "hex": "#888888", "type": "PLA Basic"}
        return palette_cache[cid]

    for y in range(ny):
        for x in range(nx):
            rx = (x + stagger) % nx
            if occupied[y][rx] or layer[y][rx] is None:
                continue
            cid = layer[y][rx]
            best = None
            best_ow, best_od = 1, 1
            for bdef in SORTED_PLATES:
                for bw, bd in _orientations(bdef):
                    if _can_place(layer, occupied, y, rx, bw, bd, cid, ny, nx):
                        best = bdef
                        best_ow, best_od = bw, bd
                        break
                if best:
                    break
            if best:
                _mark(occupied, y, rx, best_ow, best_od)
                p = _palette(cid)
                placed.append({
                    "part":          best.part,
                    "name":          best.name,
                    "color_id":      cid,
                    "color_name":    p["name"],
                    "color_hex":     p["hex"],
                    "filament_type": p["type"],
                    "x":             rx,
                    "y":             y,
                    "z_floor":       z,
                    "w":             best_ow,
                    "d":             best_od,
                    "h":             1,
                    "layer":         z,
                })
    return placed


# ── Stability score ───────────────────────────────────────────────────────────

def _compute_stability(bricks: list[dict], adj: list[list[int]]) -> float:
    """
    Stability ∈ [0, 1].
    1.0 = all non-ground bricks have ≥ 2 connections.
    """
    non_ground = [i for i, b in enumerate(bricks) if b["z_floor"] > 0]
    if not non_ground:
        return 1.0
    stable = sum(1 for i in non_ground if len(adj[i]) >= 2)
    return round(stable / len(non_ground), 3)


# ── BOM ───────────────────────────────────────────────────────────────────────

def _build_bom(bricks: list[dict]) -> list[dict]:
    counter: dict[tuple, int] = defaultdict(int)
    for b in bricks:
        key = (b["part"], b["name"], b["color_id"], b["color_name"], b["color_hex"], b["filament_type"])
        counter[key] += 1
    return [
        {
            "part":          k[0],
            "name":          k[1],
            "color_id":      k[2],
            "color_name":    k[3],
            "color_hex":     k[4],
            "filament_type": k[5],
            "hex":           k[4],
            "count":         v,
        }
        for k, v in sorted(counter.items(), key=lambda x: -x[1])
    ]


# ── Hollow interior ───────────────────────────────────────────────────────────

def _apply_hollow(
    voxel_grid: list[list[list]], nz: int, ny: int, nx: int,
) -> list[list[list]]:
    """
    Remove interior voxels (surrounded on all 6 sides) leaving only shell.
    Operates on a copy.
    """
    result = [[row[:] for row in layer] for layer in voxel_grid]
    for z in range(1, nz - 1):
        for y in range(1, ny - 1):
            for x in range(1, nx - 1):
                if result[z][y][x] is None:
                    continue
                if (
                    result[z - 1][y][x] is not None
                    and result[z + 1][y][x] is not None
                    and result[z][y - 1][x] is not None
                    and result[z][y + 1][x] is not None
                    and result[z][y][x - 1] is not None
                    and result[z][y][x + 1] is not None
                ):
                    result[z][y][x] = None
    return result


def _empty_result() -> dict:
    return {
        "bricks": [],
        "bom": [],
        "total_bricks": 0,
        "total_voxels": 0,
        "optimization_ratio": 1.0,
        "stability": 1.0,
    }
