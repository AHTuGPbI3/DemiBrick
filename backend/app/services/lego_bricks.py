"""
LEGO plate catalogue used by the brick optimizer.
All sizes are in studs (width × height on the mosaic plane).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Plate:
    name: str
    part_number: str
    width: int   # studs
    height: int  # studs

    @property
    def area(self) -> int:
        return self.width * self.height


# Catalogue: ordered largest → smallest for greedy algorithm
PLATES: list[Plate] = [
    Plate("Plate 2×8",  "3034", 2, 8),
    Plate("Plate 2×6",  "3795", 2, 6),
    Plate("Plate 2×4",  "3020", 2, 4),
    Plate("Plate 2×3",  "3021", 2, 3),
    Plate("Plate 2×2",  "3022", 2, 2),
    Plate("Plate 1×8",  "3460", 1, 8),
    Plate("Plate 1×6",  "3666", 1, 6),
    Plate("Plate 1×4",  "3710", 1, 4),
    Plate("Plate 1×3",  "3623", 1, 3),
    Plate("Plate 1×2",  "3023", 1, 2),
    Plate("Plate 1×1",  "3024", 1, 1),
]

# All orientations (w×h and h×w if different)
def all_orientations(plate: Plate) -> list[tuple[int, int, Plate]]:
    """Return list of (width, height, plate) for each valid orientation."""
    orientations = [(plate.width, plate.height, plate)]
    if plate.width != plate.height:
        orientations.append((plate.height, plate.width, plate))
    return orientations


SORTED_PLATES = sorted(PLATES, key=lambda p: p.area, reverse=True)
