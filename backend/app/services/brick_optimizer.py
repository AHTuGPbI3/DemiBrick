"""
Greedy LEGO brick optimizer.
Scans left→right, top→bottom per color region and places the largest
fitting plate at each position.
"""

from collections import defaultdict
from typing import Any

from app.services.lego_bricks import SORTED_PLATES, all_orientations
from app.services.lego_colors import LEGO_COLORS


def _can_place(
    occupied: list[list[bool]],
    row: int, col: int,
    pw: int, ph: int,
    color_grid: list[list[int | None]],
    color_idx: int,
) -> bool:
    """Check if a pw×ph plate fits at (row, col) with the given color."""
    rows = len(occupied)
    cols = len(occupied[0]) if rows else 0
    if row + ph > rows or col + pw > cols:
        return False
    for r in range(row, row + ph):
        for c in range(col, col + pw):
            if occupied[r][c]:
                return False
            if color_grid[r][c] != color_idx:
                return False
    return True


def _mark_occupied(occupied: list[list[bool]], row: int, col: int, pw: int, ph: int):
    for r in range(row, row + ph):
        for c in range(col, col + pw):
            occupied[r][c] = True


def optimize_layout(pixel_grid: list[list[int | None]]) -> dict[str, Any]:
    """
    Greedy brick placement over the pixel_grid.
    pixel_grid[row][col] = index into LEGO_COLORS, or None (transparent).

    Returns:
        bricks  – placed bricks list
        bom     – bill of materials
        stats   – optimization metrics
    """
    rows = len(pixel_grid)
    cols = len(pixel_grid[0]) if rows else 0

    occupied = [[False] * cols for _ in range(rows)]
    bricks: list[dict] = []

    # Process scan order: row by row, left to right
    for r in range(rows):
        for c in range(cols):
            if occupied[r][c] or pixel_grid[r][c] is None:
                continue
            color_idx = pixel_grid[r][c]

            placed = False
            for plate in SORTED_PLATES:
                for pw, ph, base_plate in all_orientations(plate):
                    if _can_place(occupied, r, c, pw, ph, pixel_grid, color_idx):
                        _mark_occupied(occupied, r, c, pw, ph)
                        orientation = "horizontal" if pw >= ph else "vertical"
                        bricks.append({
                            "part":        base_plate.part_number,
                            "name":        base_plate.name,
                            "color_idx":   color_idx,
                            "color_id":    LEGO_COLORS[color_idx]["id"],
                            "color_name":  LEGO_COLORS[color_idx]["name"],
                            "hex":         LEGO_COLORS[color_idx]["hex"],
                            "x":           c,
                            "y":           r,
                            "w":           pw,
                            "h":           ph,
                            "orientation": orientation,
                        })
                        placed = True
                        break
                if placed:
                    break

    # Build BOM
    bom_counter: dict[tuple, int] = defaultdict(int)
    for b in bricks:
        key = (b["part"], b["name"], b["color_idx"], b["color_id"], b["color_name"], b["hex"])
        bom_counter[key] += 1

    bom = [
        {
            "part":       k[0],
            "name":       k[1],
            "color_id":   k[3],
            "color_name": k[4],
            "hex":        k[5],
            "count":      v,
        }
        for k, v in sorted(bom_counter.items(), key=lambda x: -x[1])
    ]

    total_bricks = len(bricks)
    # Count non-transparent studs
    total_studs = sum(1 for r in range(rows) for c in range(cols) if pixel_grid[r][c] is not None)
    ratio = round(total_studs / total_bricks, 2) if total_bricks else 1.0

    return {
        "bricks":                bricks,
        "bom":                   bom,
        "total_bricks":          total_bricks,
        "total_1x1_equivalent":  total_studs,
        "optimization_ratio":    ratio,
    }
