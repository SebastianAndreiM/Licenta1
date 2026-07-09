from __future__ import annotations

import os
import csv

from sqlmodel import select
from extraction.db import get_session
from app.db.models import SceneCell

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
TARGET = "mean_ndvi"

# coloane suplimentare utile (nu strica antrenarea; compare_models ignora ce nu-i in FEATURE_COLUMNS)
EXTRA_INFO = ["county", "year", "acquisition_date", "cell_lat", "cell_lon", "n_valid_pixels"]

OUTPUT_CSV = os.path.join("ml", "dataset.csv")


def main():
    session = get_session()
    try:
        rows = session.exec(select(SceneCell)).all()
        print(f"[export] {len(rows)} randuri in scene_cells")

        os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)

        header = EXTRA_INFO + FEATURE_COLUMNS + [TARGET]
        written = 0
        skipped = 0

        with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(header)

            for r in rows:
                # sarim randurile cu vreo valoare lipsa (feature sau target)
                feat_vals = [getattr(r, c, None) for c in FEATURE_COLUMNS]
                target_val = getattr(r, TARGET, None)
                if target_val is None or any(v is None for v in feat_vals):
                    skipped += 1
                    continue

                info_vals = [getattr(r, c, None) for c in EXTRA_INFO]
                writer.writerow(info_vals + feat_vals + [target_val])
                written += 1

        print(f"[export] Scris {written} randuri curate in {OUTPUT_CSV} ({skipped} sarite pt valori lipsa)")
    finally:
        session.close()


if __name__ == "__main__":
    main()