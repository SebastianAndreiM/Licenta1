"""
Seed script - importa CSV-urile Sentinel + ERA5 in PostgreSQL.

Ruleaza o singura data, manual:
    python -m app.seed_data
"""

import os
import csv
import glob
from collections import defaultdict
from datetime import datetime, timezone

from sqlmodel import Session, delete

from app.db.database import engine
from app.db.models import (
    ExtractedPeriod,
    SatelliteScene,
    Era5Data,
)

# ============================================================
# CONFIG - cai catre fisiere
# ============================================================

DATA_DIR = r"C:\Users\Sebi\Desktop\An4\licenta\data"
SENTINEL_CSV = os.path.join(
    DATA_DIR, "dataset_desertificare_multiscene", "quality_report_multiscene.csv"
)
ERA5_DIR = os.path.join(DATA_DIR, "dataset_era5")


# ============================================================
# HELPERS - conversii sigure
# ============================================================

def to_float(value):
    """Converteste un string in float. Returneaza None daca nu se poate."""
    try:
        if value is None or value == "" or value == "nan":
            return None
        return float(value)
    except (ValueError, TypeError):
        return None


def to_int(value):
    """Converteste un string in int. Returneaza None daca nu se poate."""
    try:
        if value is None or value == "" or value == "nan":
            return None
        return int(float(value))
    except (ValueError, TypeError):
        return None


def to_bool(value):
    """Converteste un string in bool."""
    if value is None:
        return False
    return str(value).strip().lower() in ("true", "1", "1.0", "yes")


def avg(values):
    """Media unei liste de numere, ignorand None."""
    clean = [v for v in values if v is not None]
    return sum(clean) / len(clean) if clean else None


# ============================================================
# PASUL 1 - citeste scenele Sentinel din CSV (fara duplicate)
# ============================================================

def load_sentinel_scenes():
    if not os.path.exists(SENTINEL_CSV):
        raise FileNotFoundError(f"Nu gasesc {SENTINEL_CSV}")

    scenes = []
    seen_ids = set()

    with open(SENTINEL_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row.get("acquisition_date") or not row.get("file_tiff"):
                continue

            scene_id = row.get("scene_id", "")
            county = row.get("county", "")
            key = f"{scene_id}|{county}"
            if key in seen_ids:
                continue
            seen_ids.add(key)

            scenes.append(row)

    print(f"  Citite {len(scenes)} scene Sentinel unice.")
    return scenes

# ============================================================
# PASUL 2 - citeste ERA5 si calculeaza media per scena+judet
# ============================================================

def load_era5_averaged():
    """
    Citeste toate fisierele era5_extracted_*.csv din toate folderele.
    Pentru fiecare scena+judet calculeaza MEDIA grid points.

    Returneaza un dict: "scene_id|county" -> {date ERA5 mediate}

    Cheia e scene_id + county pentru ca aceeasi scena Sentinel
    poate aparea in mai multe judete (tile-uri care se suprapun).
    """
    pattern = os.path.join(ERA5_DIR, "**", "era5_extracted_*.csv")
    csv_files = glob.glob(pattern, recursive=True)
    print(f"  Gasite {len(csv_files)} fisiere ERA5.")

    # Grupam toate randurile dupa cheia scene_id|county
    rows_by_key = defaultdict(list)

    for csv_path in csv_files:
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                scene_id = row.get("scene_id", "")
                county = row.get("county", "")
                if scene_id and county:
                    key = f"{scene_id}|{county}"
                    rows_by_key[key].append(row)

    # Pentru fiecare cheie calculam media coloanelor numerice
    era5_by_key = {}

    for key, rows in rows_by_key.items():
        first = rows[0]  # pentru campurile care nu se mediaza

        era5_by_key[key] = {
            "scene_id": first.get("scene_id", ""),
            "county": first.get("county", ""),
            "year": to_int(first.get("year")),
            "acquisition_date": first.get("acquisition_date", ""),
            "window_start": first.get("window_start", ""),
            "window_end": first.get("window_end", ""),

            # Toate astea sunt MEDIA grid points
            "t2m_mean_c": avg([to_float(r.get("t2m_mean_c")) for r in rows]),
            "t2m_max_c": avg([to_float(r.get("t2m_max_c")) for r in rows]),
            "t2m_min_c": avg([to_float(r.get("t2m_min_c")) for r in rows]),
            "skin_temp_mean_c": avg([to_float(r.get("skin_temp_mean_c")) for r in rows]),

            "precip_total_mm": avg([to_float(r.get("precip_total_mm")) for r in rows]),
            "pet_total_mm": avg([to_float(r.get("pet_total_mm")) for r in rows]),
            "evap_bare_soil_mm": avg([to_float(r.get("evap_bare_soil_mm")) for r in rows]),
            "surface_runoff_mm": avg([to_float(r.get("surface_runoff_mm")) for r in rows]),

            "soil_moisture_l1_mean": avg([to_float(r.get("soil_moisture_l1_mean")) for r in rows]),
            "soil_moisture_l1_min": avg([to_float(r.get("soil_moisture_l1_min")) for r in rows]),
            "soil_moisture_l2_mean": avg([to_float(r.get("soil_moisture_l2_mean")) for r in rows]),

            "wind_speed_mean_ms": avg([to_float(r.get("wind_speed_mean_ms")) for r in rows]),
            "wind_speed_max_ms": avg([to_float(r.get("wind_speed_max_ms")) for r in rows]),

            "lai_high_veg_mean": avg([to_float(r.get("lai_high_veg_mean")) for r in rows]),
            "lai_low_veg_mean": avg([to_float(r.get("lai_low_veg_mean")) for r in rows]),

            "aridity_index": avg([to_float(r.get("aridity_index")) for r in rows]),
        }

    print(f"  Calculate medii ERA5 pentru {len(era5_by_key)} combinatii scena+judet.")
    return era5_by_key


# ============================================================
# PASUL 3 - importul propriu-zis in DB
# ============================================================

def seed_database():
    """Importa tot in PostgreSQL."""

    print("Citesc datele din CSV-uri...")
    sentinel_scenes = load_sentinel_scenes()
    era5_by_key = load_era5_averaged()

    with Session(engine) as session:

        # --- Curatam datele vechi (rerularea seed-ului) ---
        print("Curat datele vechi din DB...")
        session.exec(delete(Era5Data))
        session.exec(delete(SatelliteScene))
        session.exec(delete(ExtractedPeriod))
        session.commit()

        # --- Grupam scenele Sentinel pe judet+an ---
        scenes_by_period = defaultdict(list)
        for scene in sentinel_scenes:
            county = scene.get("county", "")
            year = to_int(scene.get("year"))
            if county and year:
                scenes_by_period[(county, year)].append(scene)

        print(f"Creez {len(scenes_by_period)} perioade...")

        total_scenes = 0
        total_era5 = 0

        for (county, year), scenes in scenes_by_period.items():
            # Creeaza perioada (un an intreg = o perioada)
            period = ExtractedPeriod(
                county=county,
                start_year=year,
                end_year=year,
                start_month=1,
                end_month=12,
                scenes_count=len(scenes),
                era5_csv_path=os.path.join(
                    ERA5_DIR, county, f"era5_extracted_{county}_{year}.csv"
                ),
                extracted_at=datetime.now(timezone.utc),
            )
            session.add(period)
            session.commit()
            session.refresh(period)

            # Importa scenele Sentinel pentru aceasta perioada
            for scene in scenes:
                scene_id = scene.get("scene_id", "")

                db_scene = SatelliteScene(
                    period_id=period.id,
                    scene_id=scene_id,
                    county=county,
                    year=year,
                    acquisition_date=scene.get("acquisition_date", ""),
                    acquisition_datetime=scene.get("acquisition_datetime", ""),
                    mean_ndvi=to_float(scene.get("mean_ndvi")),
                    min_ndvi=to_float(scene.get("min_ndvi")),
                    max_ndvi=to_float(scene.get("max_ndvi")),
                    mean_b11=to_float(scene.get("mean_b11")),
                    mean_b12=to_float(scene.get("mean_b12")),
                    cloud_ratio_valid=to_float(scene.get("cloud_ratio_valid")),
                    catalog_cloud_cover=to_float(scene.get("catalog_cloud_cover")),
                    valid_ratio=to_float(scene.get("valid_ratio")),
                    valid_pixels=to_int(scene.get("valid_pixels")),
                    total_pixels=to_int(scene.get("total_pixels")),
                    is_good=to_bool(scene.get("is_good")),
                    file_tiff=scene.get("file_tiff", ""),
                    file_preview=scene.get("file_preview", ""),
                    error_flag=scene.get("error_flag", ""),
                )
                session.add(db_scene)
                total_scenes += 1

                # Importa datele ERA5 mediate pentru aceasta scena+judet
                era5 = era5_by_key.get(f"{scene_id}|{county}")
                if era5:
                    db_era5 = Era5Data(
                        scene_id=scene_id,
                        county=county,
                        year=year,
                        acquisition_date=era5["acquisition_date"],
                        window_start=era5["window_start"],
                        window_end=era5["window_end"],
                        t2m_mean_c=era5["t2m_mean_c"],
                        t2m_max_c=era5["t2m_max_c"],
                        t2m_min_c=era5["t2m_min_c"],
                        skin_temp_mean_c=era5["skin_temp_mean_c"],
                        precip_total_mm=era5["precip_total_mm"],
                        pet_total_mm=era5["pet_total_mm"],
                        evap_bare_soil_mm=era5["evap_bare_soil_mm"],
                        surface_runoff_mm=era5["surface_runoff_mm"],
                        soil_moisture_l1_mean=era5["soil_moisture_l1_mean"],
                        soil_moisture_l1_min=era5["soil_moisture_l1_min"],
                        soil_moisture_l2_mean=era5["soil_moisture_l2_mean"],
                        wind_speed_mean_ms=era5["wind_speed_mean_ms"],
                        wind_speed_max_ms=era5["wind_speed_max_ms"],
                        lai_high_veg_mean=era5["lai_high_veg_mean"],
                        lai_low_veg_mean=era5["lai_low_veg_mean"],
                        aridity_index=era5["aridity_index"],
                    )
                    session.add(db_era5)
                    total_era5 += 1

            session.commit()
            print(f"  {county} {year}: {len(scenes)} scene importate.")

        print()
        print("=" * 50)
        print(f"GATA. Importate:")
        print(f"  {len(scenes_by_period)} perioade")
        print(f"  {total_scenes} scene Sentinel")
        print(f"  {total_era5} randuri ERA5 (mediate)")
        print("=" * 50)


if __name__ == "__main__":
    seed_database()