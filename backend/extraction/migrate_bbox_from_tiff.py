"""
Script de migrare unica: citeste bbox-ul real al fiecarei scene din
fisierul TIFF si actualizeaza coloanele min_lon/min_lat/max_lon/max_lat
in DB cu valorile reale (in grade, EPSG:4326).

Inainte de rulare, scenele aveau bbox-ul judetului (grosier). Dupa rulare,
fiecare scena are bbox-ul tile-ului ei satelitar real (~110km), ceea ce
permite indexare spatiala fina si refolosire corecta la nivel de celula.

Rulare din folderul backend:
    python -m extraction.migrate_bbox_from_tiff
    python -m extraction.migrate_bbox_from_tiff --dry-run   (doar afiseaza, nu scrie)
"""

from __future__ import annotations

import os
import argparse

import rasterio
from rasterio.warp import transform_bounds
from sqlmodel import select

from app.core.config import settings
from extraction.db import get_session
from app.db.models import SatelliteScene

DATA_ROOT = r"C:\Users\Sebi\Desktop\An4\licenta\data"

def tiff_real_bbox(tiff_path: str) -> tuple[float, float, float, float] | None:
    """
    Citeste bbox-ul real al unui TIFF si il intoarce in grade (lon/lat).

    TIFF-urile Sentinel sunt in proiectie UTM (metri). Transformam
    marginile din CRS-ul nativ in EPSG:4326 (grade).
    Intoarce (min_lon, min_lat, max_lon, max_lat) sau None la eroare.
    """
    try:
        with rasterio.open(tiff_path) as src:
            bounds = src.bounds  # in CRS-ul nativ (probabil UTM)
            src_crs = src.crs

            if src_crs is None:
                print(f"    FARA CRS: {os.path.basename(tiff_path)}")
                return None

            # transform_bounds intoarce (west, south, east, north) = (min_lon, min_lat, max_lon, max_lat)
            min_lon, min_lat, max_lon, max_lat = transform_bounds(
                src_crs, "EPSG:4326",
                bounds.left, bounds.bottom, bounds.right, bounds.top,
            )
            return (min_lon, min_lat, max_lon, max_lat)
    except Exception as e:
        print(f"    EROARE citire TIFF {os.path.basename(tiff_path)}: {e}")
        return None


def run_migration(dry_run: bool = False) -> None:
    session = get_session()

    updated = 0
    skipped = 0
    errors = 0

    try:
        scenes = session.exec(select(SatelliteScene)).all()
        print(f"Total scene in DB: {len(scenes)}\n")

        for idx, scene in enumerate(scenes, start=1):
            if not scene.file_tiff:
                print(f"[{idx}/{len(scenes)}] {scene.scene_id[:40]} - fara file_tiff, skip")
                skipped += 1
                continue

            tiff_path = os.path.join(DATA_ROOT, scene.file_tiff)

            if not os.path.exists(tiff_path):
                print(f"[{idx}/{len(scenes)}] LIPSA fisier: {tiff_path}")
                errors += 1
                continue

            bbox = tiff_real_bbox(tiff_path)
            if bbox is None:
                errors += 1
                continue

            min_lon, min_lat, max_lon, max_lat = bbox

            print(
                f"[{idx}/{len(scenes)}] {scene.county} {scene.acquisition_date} | "
                f"bbox real: [{min_lon:.4f}, {min_lat:.4f}, {max_lon:.4f}, {max_lat:.4f}]"
            )

            if not dry_run:
                scene.min_lon = round(min_lon, 6)
                scene.min_lat = round(min_lat, 6)
                scene.max_lon = round(max_lon, 6)
                scene.max_lat = round(max_lat, 6)
                session.add(scene)
                # commit periodic ca sa nu tinem totul in memorie
                if idx % 50 == 0:
                    session.commit()
                    print(f"    ... commit la {idx} scene")

            updated += 1

        if not dry_run:
            session.commit()

    finally:
        session.close()

    print("\n=== REZUMAT ===")
    print(f"Actualizate: {updated}")
    print(f"Sarite (fara file_tiff): {skipped}")
    print(f"Erori (lipsa/citire): {errors}")
    if dry_run:
        print("\n(DRY RUN - nu s-a scris nimic in DB)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrare bbox real din TIFF in DB")
    parser.add_argument("--dry-run", action="store_true", help="Doar afiseaza, nu scrie in DB")
    args = parser.parse_args()
    run_migration(dry_run=args.dry_run)


if __name__ == "__main__":
    main()