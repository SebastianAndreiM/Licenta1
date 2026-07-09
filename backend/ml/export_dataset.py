"""
Exporta datele de antrenare din DB intr-un fisier CSV.
Imbina scenele Sentinel (NDVI) cu datele climatice ERA5 pe scene_id.

Ruleaza din folderul backend:
    python -m ml.export_dataset

Produce:
    ml/dataset.csv
"""

from __future__ import annotations

import os
import pandas as pd

from sqlmodel import Session, select
from app.db.database import engine
from app.db.models import SatelliteScene, Era5Data

ML_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(ML_DIR, "dataset.csv")

FEATURE_COLUMNS = [
    "t2m_mean_c",
    "t2m_max_c",
    "t2m_min_c",
    "skin_temp_mean_c",
    "precip_total_mm",
    "pet_total_mm",
    "evap_bare_soil_mm",
    "surface_runoff_mm",
    "soil_moisture_l1_mean",
    "soil_moisture_l2_mean",
    "wind_speed_mean_ms",
    "aridity_index",
]

TARGET_COLUMN = "mean_ndvi"


def export() -> None:
    with Session(engine) as session:
        scenes = session.exec(select(SatelliteScene)).all()
        era5 = session.exec(select(Era5Data)).all()

    scene_ndvi = {
        s.scene_id: s.mean_ndvi
        for s in scenes
        if s.mean_ndvi is not None and s.is_good
    }
    scene_meta = {
        s.scene_id: {"county": s.county, "year": s.year, "acquisition_date": s.acquisition_date}
        for s in scenes
    }

    rows = []
    for e in era5:
        ndvi = scene_ndvi.get(e.scene_id)
        if ndvi is None:
            continue

        meta = scene_meta.get(e.scene_id, {})
        row = {
            "scene_id": e.scene_id,
            "county": meta.get("county", ""),
            "year": meta.get("year", ""),
            "acquisition_date": meta.get("acquisition_date", ""),
            TARGET_COLUMN: ndvi,
        }
        for col in FEATURE_COLUMNS:
            row[col] = getattr(e, col, None)
        rows.append(row)

    df = pd.DataFrame(rows)
    print(f"Inregistrari brute: {len(df)}")

    df = df.dropna(subset=FEATURE_COLUMNS + [TARGET_COLUMN])
    print(f"Inregistrari dupa curatare: {len(df)}")

    df.to_csv(CSV_PATH, index=False)
    print(f"Dataset salvat in {CSV_PATH}")
    print(f"Coloane: {list(df.columns)}")


if __name__ == "__main__":
    export()