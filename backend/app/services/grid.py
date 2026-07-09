from __future__ import annotations
from dataclasses import dataclass

# Dimensiunea unei celule de grid, in grade.
# 0.25 grade ~ 25-28 km la latitudinea Romaniei.
CELL_SIZE = 0.25


@dataclass
class GridCell:
    """O celula din grid-ul spatial fix."""
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float

    @property
    def cell_id(self) -> str:
        # Identificator stabil bazat pe coltul de jos-stanga
        return f"cell_{self.min_lat:.2f}_{self.min_lon:.2f}"


def snap_down(value: float, size: float) -> float:
    """Rotunjeste in jos la cel mai apropiat multiplu de size."""
    return (value // size) * size


def bbox_to_cells(
        min_lon: float,
        min_lat: float,
        max_lon: float,
        max_lat: float,
        cell_size: float = CELL_SIZE,
) -> list[GridCell]:
    """
    Imparte un bbox arbitrar in celulele de grid fix pe care le atinge.

    Fiecare celula e aliniata la grid (multiplu de cell_size), deci
    aceeasi zona geografica produce mereu aceleasi celule -
    asta permite refolosirea datelor intre cereri diferite.
    """
    # Aliniem marginile la grid
    start_lon = snap_down(min_lon, cell_size)
    start_lat = snap_down(min_lat, cell_size)

    cells: list[GridCell] = []

    lat = start_lat
    while lat < max_lat:
        lon = start_lon
        while lon < max_lon:
            cells.append(GridCell(
                min_lon=round(lon, 2),
                min_lat=round(lat, 2),
                max_lon=round(lon + cell_size, 2),
                max_lat=round(lat + cell_size, 2),
            ))
            lon += cell_size
        lat += cell_size

    return cells