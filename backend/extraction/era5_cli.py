from __future__ import annotations

import os
import argparse
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import cdsapi
import numpy as np
import xarray as xr

from sqlmodel import select
from extraction.db import get_session
from app.db.models import SatelliteScene, Era5Data

# =========================================================
# CONFIG
# =========================================================

OUTPUT_DIR = "dataset_era5"
WINDOW_DAYS = 30

ERA5_VARIABLES = [
    "2m_temperature",
    "skin_temperature",
    "total_precipitation",
    "potential_evaporation",
    "evaporation_from_bare_soil",
    "volumetric_soil_water_layer_1",
    "volumetric_soil_water_layer_2",
    "surface_runoff",
    "10m_u_component_of_wind",
    "10m_v_component_of_wind",
    "leaf_area_index_high_vegetation",
    "leaf_area_index_low_vegetation",
]

COUNTIES = {
    "Dolj":      [22.30, 43.60, 24.10, 44.45],
    "Olt":       [23.70, 43.65, 24.85, 44.45],
    "Teleorman": [24.50, 43.60, 25.70, 44.20],
    "Giurgiu":   [25.20, 43.65, 26.20, 44.25],
    "Calarasi":  [26.10, 43.65, 27.50, 44.50],
    "Mehedinti": [22.15, 43.60, 23.60, 44.85],
}

ERA5_NUMERIC_FIELDS = [
    "t2m_mean_c", "t2m_max_c", "t2m_min_c", "skin_temp_mean_c",
    "precip_total_mm", "pet_total_mm", "evap_bare_soil_mm", "surface_runoff_mm",
    "soil_moisture_l1_mean", "soil_moisture_l1_min", "soil_moisture_l2_mean",
    "wind_speed_mean_ms", "wind_speed_max_ms",
    "lai_high_veg_mean", "lai_low_veg_mean", "aridity_index",
]


# =========================================================
# HELPERS
# =========================================================

def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def make_bbox_label(bbox: List[float]) -> str:
    """Genereaza o eticheta unica din coordonate, ex: bbox_22.30_43.60_24.10_44.45"""
    return "bbox_" + "_".join(f"{c:.2f}" for c in bbox)


def clean_nan(value: Any):
    if value is None:
        return None
    try:
        f = float(value)
        return None if np.isnan(f) else f
    except Exception:
        return None


def get_window_dates(acquisition_date: str, window_days: int) -> Tuple[str, str]:
    acq = datetime.strptime(acquisition_date, "%Y-%m-%d")
    start = acq - timedelta(days=window_days)
    return start.strftime("%Y-%m-%d"), acq.strftime("%Y-%m-%d")


def bbox_to_cds_area(bbox: List[float]) -> List[float]:
    min_lon, min_lat, max_lon, max_lat = bbox
    padding = 0.1
    return [
        max_lat + padding,  # N
        min_lon - padding,  # W
        min_lat - padding,  # S
        max_lon + padding,  # E
    ]


def build_nc_filename(label: str, year: int) -> str:
    return os.path.join(OUTPUT_DIR, label, f"era5_{label}_{year}.nc")


# =========================================================
# CITIRE SCENE DIN DB
# =========================================================

def load_scenes_from_db(
        session,
        label: str,
        start_year: int,
        end_year: int,
        start_month: int,
        end_month: int,
) -> List[SatelliteScene]:
    """Incarca scenele Sentinel din DB pentru eticheta (judet sau bbox) si interval."""
    date_from = f"{start_year:04d}-{start_month:02d}-01"
    date_to = f"{end_year:04d}-{end_month:02d}-31"

    stmt = select(SatelliteScene).where(
        SatelliteScene.county == label,
        SatelliteScene.acquisition_date >= date_from,
        SatelliteScene.acquisition_date <= date_to,
    )
    scenes = session.exec(stmt).all()
    print(f"Incarcate {len(scenes)} scene din DB pentru {label} {start_year}-{end_year}.")
    return scenes


def era5_exists(session, scene_id: str, label: str) -> bool:
    stmt = select(Era5Data).where(
        Era5Data.scene_id == scene_id,
        Era5Data.county == label,
    )
    return session.exec(stmt).first() is not None


# =========================================================
# DOWNLOAD ERA5 PER ETICHETA PER AN
# =========================================================

def download_era5_for_label_year(
        client: cdsapi.Client,
        label: str,
        year: int,
        bbox: List[float],
        nc_path: str,
) -> None:
    if os.path.exists(nc_path):
        print(f"  SKIP (deja descarcat): {os.path.basename(nc_path)}")
        return

    area = bbox_to_cds_area(bbox)
    print(f"  Download ERA5: {label} {year} -> {os.path.basename(nc_path)}")

    request = {
        "product_type": "reanalysis",
        "variable": ERA5_VARIABLES,
        "year": str(year),
        "month": ["06", "07", "08", "09"],
        "day": [f"{d:02d}" for d in range(1, 32)],
        "time": ["00:00", "06:00", "12:00", "18:00"],
        "area": area,
        "format": "netcdf",
    }

    import zipfile, shutil

    tmp_path = nc_path + ".download"
    client.retrieve("reanalysis-era5-land", request, tmp_path)

    with open(tmp_path, "rb") as f:
        header = f.read(4)

    if header[:2] == b"PK":
        with zipfile.ZipFile(tmp_path, "r") as zf:
            nc_files = [n for n in zf.namelist() if n.endswith(".nc")]
            if not nc_files:
                raise RuntimeError(f"ZIP fara fisier .nc: {zf.namelist()}")
            extracted = zf.extract(nc_files[0], path=os.path.dirname(nc_path))
            shutil.move(extracted, nc_path)
        os.remove(tmp_path)
        print(f"  OK (dezarhivat): {nc_path}")
    else:
        shutil.move(tmp_path, nc_path)
        print(f"  OK: {nc_path}")


# =========================================================
# EXTRAGE GRID POINTS DIN NETCDF
# =========================================================

def extract_grid_points_for_scene(
        nc_path: str,
        acquisition_date: str,
        window_days: int,
) -> List[Dict[str, Any]]:
    if not os.path.exists(nc_path):
        print(f"  LIPSA NetCDF: {nc_path}")
        return []

    date_start, date_end = get_window_dates(acquisition_date, window_days)
    ds = xr.open_dataset(nc_path)

    try:
        ds_window = ds.sel(valid_time=slice(date_start, date_end))
    except Exception:
        try:
            ds_window = ds.sel(time=slice(date_start, date_end))
        except Exception as e:
            print(f"  EROARE selectie timp: {e}")
            ds.close()
            return []

    if ds_window.dims.get("valid_time", ds_window.dims.get("time", 0)) == 0:
        print(f"  ATENTIE: nicio inregistrare in fereastra {date_start} -> {date_end}")
        ds.close()
        return []

    lats = ds_window["latitude"].values
    lons = ds_window["longitude"].values
    rows = []

    for lat in lats:
        for lon in lons:
            try:
                point = ds_window.sel(latitude=lat, longitude=lon)
            except Exception:
                continue

            row: Dict[str, Any] = {
                "grid_lat": float(lat),
                "grid_lon": float(lon),
                "window_start": date_start,
                "window_end": date_end,
                "acquisition_date": acquisition_date,
            }

            if "t2m" in point:
                vals = point["t2m"].values.flatten()
                vals = vals[np.isfinite(vals)]
                if len(vals) > 0:
                    row["t2m_mean_c"] = float(np.mean(vals) - 273.15)
                    row["t2m_max_c"] = float(np.max(vals) - 273.15)
                    row["t2m_min_c"] = float(np.min(vals) - 273.15)
                else:
                    row["t2m_mean_c"] = np.nan
                    row["t2m_max_c"] = np.nan
                    row["t2m_min_c"] = np.nan

            if "skt" in point:
                vals = point["skt"].values.flatten()
                vals = vals[np.isfinite(vals)]
                row["skin_temp_mean_c"] = float(np.mean(vals) - 273.15) if len(vals) > 0 else np.nan

            if "tp" in point:
                vals = point["tp"].values.flatten()
                vals = vals[np.isfinite(vals)]
                row["precip_total_mm"] = float(np.sum(np.maximum(vals, 0)) * 1000) if len(vals) > 0 else np.nan

            if "pev" in point:
                vals = point["pev"].values.flatten()
                vals = vals[np.isfinite(vals)]
                row["pet_total_mm"] = float(np.sum(vals) * 1000) if len(vals) > 0 else np.nan

            if "evabs" in point:
                vals = point["evabs"].values.flatten()
                vals = vals[np.isfinite(vals)]
                row["evap_bare_soil_mm"] = float(np.sum(vals) * 1000) if len(vals) > 0 else np.nan

            if "swvl1" in point:
                vals = point["swvl1"].values.flatten()
                vals = vals[np.isfinite(vals)]
                row["soil_moisture_l1_mean"] = float(np.mean(vals)) if len(vals) > 0 else np.nan
                row["soil_moisture_l1_min"] = float(np.min(vals)) if len(vals) > 0 else np.nan

            if "swvl2" in point:
                vals = point["swvl2"].values.flatten()
                vals = vals[np.isfinite(vals)]
                row["soil_moisture_l2_mean"] = float(np.mean(vals)) if len(vals) > 0 else np.nan

            if "sro" in point:
                vals = point["sro"].values.flatten()
                vals = vals[np.isfinite(vals)]
                row["surface_runoff_mm"] = float(np.sum(vals) * 1000) if len(vals) > 0 else np.nan

            if "u10" in point and "v10" in point:
                u = point["u10"].values.flatten()
                v = point["v10"].values.flatten()
                mask = np.isfinite(u) & np.isfinite(v)
                if mask.sum() > 0:
                    speed = np.sqrt(u[mask] ** 2 + v[mask] ** 2)
                    row["wind_speed_mean_ms"] = float(np.mean(speed))
                    row["wind_speed_max_ms"] = float(np.max(speed))
                else:
                    row["wind_speed_mean_ms"] = np.nan
                    row["wind_speed_max_ms"] = np.nan

            if "lai_hv" in point:
                vals = point["lai_hv"].values.flatten()
                vals = vals[np.isfinite(vals)]
                row["lai_high_veg_mean"] = float(np.mean(vals)) if len(vals) > 0 else np.nan

            if "lai_lv" in point:
                vals = point["lai_lv"].values.flatten()
                vals = vals[np.isfinite(vals)]
                row["lai_low_veg_mean"] = float(np.mean(vals)) if len(vals) > 0 else np.nan

            precip = row.get("precip_total_mm", np.nan)
            pet = row.get("pet_total_mm", np.nan)
            if (
                    precip is not None and pet is not None
                    and np.isfinite(precip) and np.isfinite(pet)
                    and pet != 0
            ):
                row["aridity_index"] = float(abs(precip) / abs(pet))
            else:
                row["aridity_index"] = np.nan

            rows.append(row)

    ds.close()
    return rows


# =========================================================
# AGREGARE
# =========================================================

def average_grid_points(grid_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    averaged: Dict[str, Any] = {}
    for field in ERA5_NUMERIC_FIELDS:
        values = []
        for row in grid_rows:
            v = row.get(field)
            if v is not None and np.isfinite(v):
                values.append(v)
        averaged[field] = float(np.mean(values)) if values else None
    return averaged


# =========================================================
# SCRIERE IN DB
# =========================================================

def save_era5_to_db(
        session,
        scene: SatelliteScene,
        window_start: str,
        window_end: str,
        averaged: Dict[str, Any],
) -> None:
    era5 = Era5Data(
        scene_id=scene.scene_id,
        county=scene.county,
        year=scene.year,
        acquisition_date=scene.acquisition_date,
        min_lon=scene.min_lon,
        min_lat=scene.min_lat,
        max_lon=scene.max_lon,
        max_lat=scene.max_lat,
        window_start=window_start,
        window_end=window_end,
        t2m_mean_c=clean_nan(averaged.get("t2m_mean_c")),
        t2m_max_c=clean_nan(averaged.get("t2m_max_c")),
        t2m_min_c=clean_nan(averaged.get("t2m_min_c")),
        skin_temp_mean_c=clean_nan(averaged.get("skin_temp_mean_c")),
        precip_total_mm=clean_nan(averaged.get("precip_total_mm")),
        pet_total_mm=clean_nan(averaged.get("pet_total_mm")),
        evap_bare_soil_mm=clean_nan(averaged.get("evap_bare_soil_mm")),
        surface_runoff_mm=clean_nan(averaged.get("surface_runoff_mm")),
        soil_moisture_l1_mean=clean_nan(averaged.get("soil_moisture_l1_mean")),
        soil_moisture_l1_min=clean_nan(averaged.get("soil_moisture_l1_min")),
        soil_moisture_l2_mean=clean_nan(averaged.get("soil_moisture_l2_mean")),
        wind_speed_mean_ms=clean_nan(averaged.get("wind_speed_mean_ms")),
        wind_speed_max_ms=clean_nan(averaged.get("wind_speed_max_ms")),
        lai_high_veg_mean=clean_nan(averaged.get("lai_high_veg_mean")),
        lai_low_veg_mean=clean_nan(averaged.get("lai_low_veg_mean")),
        aridity_index=clean_nan(averaged.get("aridity_index")),
    )
    session.add(era5)
    session.commit()


# =========================================================
# MAIN - CLI
# =========================================================

def run_extraction(
        county: Optional[str],
        start_year: int,
        end_year: int,
        start_month: int,
        end_month: int,
        bbox: Optional[List[float]] = None,
        label: Optional[str] = None,
) -> None:
    # Determinam bbox-ul si eticheta (db_label)
    if bbox is not None:
        area = bbox
        db_label = label or make_bbox_label(bbox)
    else:
        if county not in COUNTIES:
            raise ValueError(f"Judet necunoscut: {county}. Optiuni: {list(COUNTIES.keys())}")
        area = COUNTIES[county]
        db_label = county

    ensure_dir(OUTPUT_DIR)
    ensure_dir(os.path.join(OUTPUT_DIR, db_label))

    print("Initializez clientul CDS...")
    client = cdsapi.Client()

    session = get_session()

    try:
        scenes = load_scenes_from_db(
            session, db_label, start_year, end_year, start_month, end_month
        )
        if not scenes:
            print("Nicio scena in DB pentru acest interval. Ruleaza intai extractia Sentinel.")
            return

        years_needed = sorted({s.year for s in scenes})
        for year in years_needed:
            nc_path = build_nc_filename(db_label, year)
            try:
                download_era5_for_label_year(client, db_label, year, area, nc_path)
            except Exception as e:
                print(f"  EROARE download {db_label} {year}: {e}")

        for idx, scene in enumerate(scenes, start=1):
            print(f"[{idx}/{len(scenes)}] {scene.scene_id[:40]} ({scene.acquisition_date})")

            if era5_exists(session, scene.scene_id, db_label):
                print("    SKIP (ERA5 deja in DB)")
                continue

            nc_path = build_nc_filename(db_label, scene.year)
            grid_rows = extract_grid_points_for_scene(
                nc_path, scene.acquisition_date, WINDOW_DAYS
            )

            if not grid_rows:
                print("    Niciun grid point extras.")
                continue

            averaged = average_grid_points(grid_rows)
            window_start, window_end = get_window_dates(scene.acquisition_date, WINDOW_DAYS)

            save_era5_to_db(session, scene, window_start, window_end, averaged)
            print(f"    OK | t2m={averaged.get('t2m_mean_c')} | precip={averaged.get('precip_total_mm')}")

    finally:
        session.close()

    print(f"\nGata. ERA5 extras pentru {db_label} {start_year}-{end_year}.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Extractie date ERA5-Land in DB")
    parser.add_argument("--county", help="Numele judetului (sau foloseste --bbox)")
    parser.add_argument("--bbox", help="Bbox custom: min_lon,min_lat,max_lon,max_lat")
    parser.add_argument("--label", help="Eticheta pentru salvare in DB (optional, pentru bbox)")
    parser.add_argument("--start-year", type=int, required=True)
    parser.add_argument("--end-year", type=int, required=True)
    parser.add_argument("--start-month", type=int, default=6)
    parser.add_argument("--end-month", type=int, default=9)
    args = parser.parse_args()

    bbox = None
    if args.bbox:
        parts = [float(x) for x in args.bbox.split(",")]
        if len(parts) != 4:
            raise ValueError("bbox trebuie sa aiba 4 valori: min_lon,min_lat,max_lon,max_lat")
        bbox = parts

    if not args.county and not bbox:
        raise ValueError("Trebuie sa dai fie --county, fie --bbox")

    run_extraction(
        county=args.county,
        start_year=args.start_year,
        end_year=args.end_year,
        start_month=args.start_month,
        end_month=args.end_month,
        bbox=bbox,
        label=args.label,
    )


if __name__ == "__main__":
    main()