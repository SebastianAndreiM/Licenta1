"""
==============================================================================
recalc_granular.py  -  Reprocesare GRANULARA din fisiere locale (fara download)
==============================================================================
Refoloseste EXACT logica din sentinel_cli.py si era5_cli.py, dar in loc de
1 rand mediu per scena, produce cate un rand per celula ERA5 (~9km).

  - NDVI per celula: pixelii Sentinel B04/B08 din celula, filtrati cu SCL
    (acelasi BAD_SCL_VALUES ca sentinel_cli.py) si data_mask.
  - Clima per celula: valorile native ERA5 din .nc, agregate pe fereastra de
    WINDOW_DAYS zile INAINTE de data scenei (identic cu era5_cli.py).
  - Scrie in tabela NOUA scene_cells. Datele vechi raman intacte.

RULARE (din backend/):
    python recalc_granular.py                 # tot datasetul
    python recalc_granular.py --limit 3        # doar primele 3 TIFF-uri (test)
==============================================================================
"""
from __future__ import annotations

import os
import glob
import re
import argparse
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import numpy as np
import rasterio
import xarray as xr
from rasterio.windows import from_bounds

TIFF_DIR = r"C:\Users\Sebi\Desktop\An4\licenta\data\dataset_desertificare_multiscene"
ERA5_DIR = r"C:\Users\Sebi\Desktop\An4\licenta\data\dataset_era5"
CELL_SIZE = 0.1                 # rezolutia ERA5 (~9km)
MIN_VALID_PIXELS = 10           # minim pixeli valizi intr-o celula
WINDOW_DAYS = 30                # identic cu era5_cli.py

# benzi TIFF (identic cu read_bands din sentinel_cli.py)
# 1=B04, 2=B08, 3=B11, 4=B12, 5=SCL, 6=dataMask
BAD_SCL_VALUES = {0, 1, 3, 8, 9, 10, 11}   # identic cu sentinel_cli.py


# ---------------------------------------------------------------------------
# NDVI granular dintr-un TIFF -> {(cell_lat, cell_lon): (mean_ndvi, n_pixels)}
# ---------------------------------------------------------------------------
def ndvi_cells_from_tiff(tiff_path: str) -> dict:
    src = rasterio.open(tiff_path)
    b04 = src.read(1).astype(np.float32)
    b08 = src.read(2).astype(np.float32)
    scl = src.read(5).astype(np.int32)
    data_mask = src.read(6).astype(np.int32)

    # NDVI identic cu build_ndvi
    ndvi = np.full(b04.shape, np.nan, dtype=np.float32)
    denom = b08 + b04
    ok = (denom > 0) & (data_mask == 1)
    ndvi[ok] = (b08[ok] - b04[ok]) / denom[ok]

    # filtru nori identic cu compute_stats
    valid_mask = (data_mask == 1)
    clean = valid_mask & ~np.isin(scl, list(BAD_SCL_VALUES))
    ndvi = np.where(clean, ndvi, np.nan)

    tb = src.bounds
    lon0 = np.floor(tb.left * 10) / 10
    lon1 = np.ceil(tb.right * 10) / 10
    lat0 = np.floor(tb.bottom * 10) / 10
    lat1 = np.ceil(tb.top * 10) / 10
    lons = np.round(np.arange(lon0, lon1 + 1e-6, CELL_SIZE), 2)
    lats = np.round(np.arange(lat0, lat1 + 1e-6, CELL_SIZE), 2)

    out = {}
    for lat in lats:
        for lon in lons:
            a, b = lon - CELL_SIZE / 2, lon + CELL_SIZE / 2
            c, d = lat - CELL_SIZE / 2, lat + CELL_SIZE / 2
            if b < tb.left or a > tb.right or d < tb.bottom or c > tb.top:
                continue
            win = from_bounds(
                max(a, tb.left), max(c, tb.bottom),
                min(b, tb.right), min(d, tb.top),
                src.transform,
            )
            r0 = max(0, int(win.row_off))
            c0 = max(0, int(win.col_off))
            r1 = min(ndvi.shape[0], int(win.row_off + win.height))
            c1 = min(ndvi.shape[1], int(win.col_off + win.width))
            if r1 <= r0 or c1 <= c0:
                continue
            sub = ndvi[r0:r1, c0:c1]
            valid = sub[np.isfinite(sub)]
            if len(valid) < MIN_VALID_PIXELS:
                continue
            out[(round(float(lat), 2), round(float(lon), 2))] = (
                round(float(valid.mean()), 4),
                int(len(valid)),
            )
    src.close()
    return out


# ---------------------------------------------------------------------------
# Clima ERA5 per celula - conversii IDENTICE cu era5_cli.py
# fereastra = [acq - WINDOW_DAYS, acq]
# ---------------------------------------------------------------------------
def era5_cells_for_date(nc_path: str, acquisition_date: str) -> dict:
    if not os.path.exists(nc_path):
        return {}

    acq = datetime.strptime(acquisition_date, "%Y-%m-%d")
    date_start = (acq - timedelta(days=WINDOW_DAYS)).strftime("%Y-%m-%d")
    date_end = acq.strftime("%Y-%m-%d")

    ds = xr.open_dataset(nc_path)
    try:
        dsw = ds.sel(valid_time=slice(date_start, date_end))
    except Exception:
        try:
            dsw = ds.sel(time=slice(date_start, date_end))
        except Exception:
            ds.close()
            return {}

    nt = dsw.dims.get("valid_time", dsw.dims.get("time", 0))
    if nt == 0:
        ds.close()
        return {}

    lats = dsw["latitude"].values
    lons = dsw["longitude"].values
    out = {}

    for lat in lats:
        for lon in lons:
            try:
                p = dsw.sel(latitude=lat, longitude=lon)
            except Exception:
                continue

            row: Dict[str, Any] = {}

            if "t2m" in p:
                v = p["t2m"].values.flatten(); v = v[np.isfinite(v)]
                if len(v) > 0:
                    row["t2m_mean_c"] = float(np.mean(v) - 273.15)
                    row["t2m_max_c"] = float(np.max(v) - 273.15)
                    row["t2m_min_c"] = float(np.min(v) - 273.15)
            if "skt" in p:
                v = p["skt"].values.flatten(); v = v[np.isfinite(v)]
                if len(v) > 0:
                    row["skin_temp_mean_c"] = float(np.mean(v) - 273.15)
            if "tp" in p:
                v = p["tp"].values.flatten(); v = v[np.isfinite(v)]
                if len(v) > 0:
                    row["precip_total_mm"] = float(np.sum(np.maximum(v, 0)) * 1000)
            if "pev" in p:
                v = p["pev"].values.flatten(); v = v[np.isfinite(v)]
                if len(v) > 0:
                    row["pet_total_mm"] = float(np.sum(v) * 1000)
            if "evabs" in p:
                v = p["evabs"].values.flatten(); v = v[np.isfinite(v)]
                if len(v) > 0:
                    row["evap_bare_soil_mm"] = float(np.sum(v) * 1000)
            if "swvl1" in p:
                v = p["swvl1"].values.flatten(); v = v[np.isfinite(v)]
                if len(v) > 0:
                    row["soil_moisture_l1_mean"] = float(np.mean(v))
                    row["soil_moisture_l1_min"] = float(np.min(v))
            if "swvl2" in p:
                v = p["swvl2"].values.flatten(); v = v[np.isfinite(v)]
                if len(v) > 0:
                    row["soil_moisture_l2_mean"] = float(np.mean(v))
            if "sro" in p:
                v = p["sro"].values.flatten(); v = v[np.isfinite(v)]
                if len(v) > 0:
                    row["surface_runoff_mm"] = float(np.sum(v) * 1000)
            if "u10" in p and "v10" in p:
                u = p["u10"].values.flatten(); vv = p["v10"].values.flatten()
                m = np.isfinite(u) & np.isfinite(vv)
                if m.sum() > 0:
                    sp = np.sqrt(u[m] ** 2 + vv[m] ** 2)
                    row["wind_speed_mean_ms"] = float(np.mean(sp))
                    row["wind_speed_max_ms"] = float(np.max(sp))
            if "lai_hv" in p:
                v = p["lai_hv"].values.flatten(); v = v[np.isfinite(v)]
                if len(v) > 0:
                    row["lai_high_veg_mean"] = float(np.mean(v))
            if "lai_lv" in p:
                v = p["lai_lv"].values.flatten(); v = v[np.isfinite(v)]
                if len(v) > 0:
                    row["lai_low_veg_mean"] = float(np.mean(v))

            precip = row.get("precip_total_mm")
            pet = row.get("pet_total_mm")
            if precip is not None and pet is not None and pet != 0:
                row["aridity_index"] = float(abs(precip) / abs(pet))

            out[(round(float(lat), 2), round(float(lon), 2))] = row

    ds.close()
    return out


# ---------------------------------------------------------------------------
# Imperechere fisiere
# ---------------------------------------------------------------------------
def parse_tiff_name(fname: str):
    """Ex: Dolj_2015_2015-07-29_s01_S2A_MSIL2A_...tif -> (Dolj, 2015, date)"""
    base = os.path.basename(fname)
    m = re.match(r"([A-Za-z]+)_(\d{4})_(\d{4}-\d{2}-\d{2})", base)
    if not m:
        return None
    return m.group(1), int(m.group(2)), datetime.strptime(m.group(3), "%Y-%m-%d")


def find_era5_for(county: str, year: int) -> Optional[str]:
    """Structura ta: dataset_era5\\<Judet>\\era5_<Judet>_<An>.nc"""
    p = os.path.join(ERA5_DIR, county, f"era5_{county}_{year}.nc")
    if os.path.exists(p):
        return p
    # fallback: cauta orice .nc cu judetul si anul in nume
    cands = glob.glob(os.path.join(ERA5_DIR, county, f"*{year}*.nc"))
    if cands:
        return cands[0]
    cands = glob.glob(os.path.join(ERA5_DIR, f"**/*{county}*{year}*.nc"), recursive=True)
    return cands[0] if cands else None


def clean_nan(value):
    if value is None:
        return None
    try:
        f = float(value)
        return None if np.isnan(f) else f
    except Exception:
        return None


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="Proceseaza doar primele N TIFF (0=toate)")
    args = ap.parse_args()

    tiffs = sorted(glob.glob(os.path.join(TIFF_DIR, "**/*.tif*"), recursive=True))
    if args.limit:
        tiffs = tiffs[:args.limit]
    print(f"[recalc] {len(tiffs)} TIFF-uri de procesat")

    from extraction.db import get_session
    from app.db.models import SceneCell

    session = get_session()
    total = 0
    skipped = 0

    try:
        for idx, tiff in enumerate(tiffs, 1):
            info = parse_tiff_name(tiff)
            if info is None:
                print(f"  [{idx}/{len(tiffs)}] SKIP nume: {os.path.basename(tiff)}")
                skipped += 1
                continue
            county, year, scene_date = info
            date_str = scene_date.strftime("%Y-%m-%d")

            nc = find_era5_for(county, year)
            if nc is None:
                print(f"  [{idx}/{len(tiffs)}] SKIP fara ERA5: {county} {year}")
                skipped += 1
                continue

            try:
                ndvi_cells = ndvi_cells_from_tiff(tiff)
                era5_cells = era5_cells_for_date(nc, date_str)
            except Exception as e:
                print(f"  [{idx}/{len(tiffs)}] EROARE: {e}")
                skipped += 1
                continue

            n_here = 0
            for key, (mean_ndvi, n_pix) in ndvi_cells.items():
                clim = era5_cells.get(key)
                if clim is None:
                    continue
                row = SceneCell(
                    county=county,
                    year=year,
                    acquisition_date=date_str,
                    cell_lat=key[0],
                    cell_lon=key[1],
                    mean_ndvi=mean_ndvi,
                    n_valid_pixels=n_pix,
                    source_tiff=os.path.basename(tiff),
                    t2m_mean_c=clean_nan(clim.get("t2m_mean_c")),
                    t2m_max_c=clean_nan(clim.get("t2m_max_c")),
                    t2m_min_c=clean_nan(clim.get("t2m_min_c")),
                    skin_temp_mean_c=clean_nan(clim.get("skin_temp_mean_c")),
                    precip_total_mm=clean_nan(clim.get("precip_total_mm")),
                    pet_total_mm=clean_nan(clim.get("pet_total_mm")),
                    evap_bare_soil_mm=clean_nan(clim.get("evap_bare_soil_mm")),
                    surface_runoff_mm=clean_nan(clim.get("surface_runoff_mm")),
                    soil_moisture_l1_mean=clean_nan(clim.get("soil_moisture_l1_mean")),
                    soil_moisture_l1_min=clean_nan(clim.get("soil_moisture_l1_min")),
                    soil_moisture_l2_mean=clean_nan(clim.get("soil_moisture_l2_mean")),
                    wind_speed_mean_ms=clean_nan(clim.get("wind_speed_mean_ms")),
                    wind_speed_max_ms=clean_nan(clim.get("wind_speed_max_ms")),
                    lai_high_veg_mean=clean_nan(clim.get("lai_high_veg_mean")),
                    lai_low_veg_mean=clean_nan(clim.get("lai_low_veg_mean")),
                    aridity_index=clean_nan(clim.get("aridity_index")),
                )
                session.add(row)
                n_here += 1
                total += 1

            if n_here:
                session.commit()
            print(f"  [{idx}/{len(tiffs)}] {os.path.basename(tiff)[:42]:42} -> {n_here} celule")

    finally:
        session.close()

    print(f"\n[recalc] GATA. {total} randuri granulare in scene_cells. {skipped} fisiere sarite.")


if __name__ == "__main__":
    main()