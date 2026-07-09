from __future__ import annotations

import os
import io
import json
import time
import argparse
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
import numpy as np
import rasterio
import matplotlib
matplotlib.use("Agg")  # backend fara fereastra grafica, pentru rulare pe server
import matplotlib.pyplot as plt
from dotenv import load_dotenv

from sqlmodel import select
from extraction.db import get_session
from app.db.models import SatelliteScene, SatelliteImage

# =========================================================
# CONFIG
# =========================================================

load_dotenv()

CLIENT_ID = os.getenv("COPERNICUS_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("COPERNICUS_CLIENT_SECRET", "")

TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process"
CATALOG_URL = "https://sh.dataspace.copernicus.eu/catalog/v1/search"

# TIFF-urile raman pe disk (utile pentru recalcule / lucrare)
TIFF_DIR = "dataset_tiffs"

SCENES_PER_YEAR = 999
MIN_DAYS_BETWEEN_SCENES = 5

IMAGE_WIDTH = 768
IMAGE_HEIGHT = 768

MAX_CLOUD_COVERAGE = 20.0
REQUEST_TIMEOUT = 240
RETRY_COUNT = 3
RETRY_SLEEP_SECONDS = 6

COUNTIES = {
    "Dolj": [22.30, 43.60, 24.10, 44.45],
    "Olt": [23.70, 43.65, 24.85, 44.45],
    "Teleorman": [24.50, 43.60, 25.70, 44.20],
    "Giurgiu": [25.20, 43.65, 26.20, 44.25],
    "Calarasi": [26.10, 43.65, 27.50, 44.50],
    "Mehedinti": [22.15, 43.60, 23.60, 44.85],
}

CLOUDY_SCL_VALUES = {3, 8, 9, 10, 11}
BAD_SCL_VALUES = {0, 1, 3, 8, 9, 10, 11}

# =========================================================
# HELPERS
# =========================================================

def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def make_bbox_label(bbox: List[float]) -> str:
    """Genereaza o eticheta unica din coordonate, ex: bbox_22.30_43.60_24.10_44.45"""
    return "bbox_" + "_".join(f"{c:.2f}" for c in bbox)


def sanitize_filename(text: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in text)


def make_time_window(year: int, month_day_from: str, month_day_to: str) -> Tuple[str, str]:
    return (
        f"{year}-{month_day_from}T00:00:00Z",
        f"{year}-{month_day_to}T23:59:59Z",
    )


def iso_to_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def make_day_window(acquisition_datetime: str) -> Tuple[str, str]:
    dt = iso_to_datetime(acquisition_datetime)
    start = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    end = dt.replace(hour=23, minute=59, second=59, microsecond=0)
    return (
        start.isoformat().replace("+00:00", "Z"),
        end.isoformat().replace("+00:00", "Z"),
    )


def safe_float(value: Any) -> Optional[float]:
    try:
        return None if value is None else float(value)
    except Exception:
        return None


def clean_nan(value: Any) -> Optional[float]:
    """Transforma NaN in None ca sa poata fi scris in DB."""
    if value is None:
        return None
    try:
        f = float(value)
        return None if np.isnan(f) else f
    except Exception:
        return None


# =========================================================
# AUTH
# =========================================================

def get_access_token(client_id: str, client_secret: str) -> str:
    if not client_id or not client_secret:
        raise ValueError(
            "Lipsesc credentialele Copernicus. "
            "Seteaza COPERNICUS_CLIENT_ID si COPERNICUS_CLIENT_SECRET."
        )
    payload = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
    }
    r = requests.post(TOKEN_URL, data=payload, timeout=60)
    r.raise_for_status()
    token = r.json().get("access_token")
    if not token:
        raise RuntimeError("Nu am putut obtine token-ul Copernicus.")
    return token


# =========================================================
# CATALOG SEARCH
# =========================================================

def build_catalog_payload(bbox: List[float], time_from: str, time_to: str) -> Dict[str, Any]:
    return {
        "collections": ["sentinel-2-l2a"],
        "bbox": bbox,
        "datetime": f"{time_from}/{time_to}",
        "limit": 100,
    }


def _fetch_one_window(
        headers: Dict[str, Any],
        bbox: List[float],
        time_from: str,
        time_to: str,
) -> List[Dict[str, Any]]:
    payload = build_catalog_payload(bbox, time_from, time_to)
    r = requests.post(CATALOG_URL, headers=headers, json=payload, timeout=90)

    if r.status_code == 401:
        raise PermissionError("Token expirat.")

    if not r.ok:
        try:
            body = r.json()
        except Exception:
            body = r.text[:500]
        raise RuntimeError(
            f"Catalog API {r.status_code}. "
            f"Payload={json.dumps(payload)[:300]} | Response={body}"
        )

    return r.json().get("features", [])


def search_catalog_scenes(
        access_token: str,
        bbox: List[float],
        time_from: str,
        time_to: str,
) -> List[Dict[str, Any]]:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    features = _fetch_one_window(headers, bbox, time_from, time_to)
    print(f"  Fereastra 1: {len(features)} scene")

    if len(features) >= 100:
        dt_from = iso_to_datetime(time_from)
        dt_to = iso_to_datetime(time_to)
        dt_mid = dt_from + (dt_to - dt_from) / 2
        mid_str = dt_mid.strftime("%Y-%m-%dT%H:%M:%SZ")

        print(f"  Limita atinsa, impart fereastra la {mid_str[:10]}")

        features_a = _fetch_one_window(headers, bbox, time_from, mid_str)
        features_b = _fetch_one_window(headers, bbox, mid_str, time_to)
        print(f"  Sub-fereastra A: {len(features_a)} | Sub-fereastra B: {len(features_b)}")

        seen = set()
        features = []
        for f in features_a + features_b:
            fid = f.get("id", "")
            if fid not in seen:
                seen.add(fid)
                features.append(f)

    filtered = []
    for f in features:
        props = f.get("properties", {})
        cc = props.get("eo:cloud_cover")
        if cc is None or float(cc) <= MAX_CLOUD_COVERAGE:
            filtered.append(f)

    print(f"  Total: {len(features)} scene din API, {len(filtered)} dupa filtru nori (<={MAX_CLOUD_COVERAGE}%)")
    return filtered


def extract_scene_metadata(feature: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    props = feature.get("properties", {})
    acq = props.get("datetime")
    if not acq:
        return None
    return {
        "id": feature.get("id", ""),
        "datetime": acq,
        "cloud_cover": safe_float(props.get("eo:cloud_cover")),
        "properties": props,
    }


def unique_scenes_by_day(features: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    best: Dict[str, Dict[str, Any]] = {}
    for f in features:
        scene = extract_scene_metadata(f)
        if scene is None:
            continue
        day = scene["datetime"][:10]
        prev = best.get(day)
        if prev is None:
            best[day] = scene
        else:
            pc = prev.get("cloud_cover")
            nc = scene.get("cloud_cover")
            if nc is not None and (pc is None or nc < pc):
                best[day] = scene
    return sorted(best.values(), key=lambda x: x["datetime"])


def select_spread_scenes(
        candidates: List[Dict[str, Any]],
        max_scenes: int,
        min_days_between: int,
) -> List[Dict[str, Any]]:
    if not candidates:
        return []
    selected: List[Dict[str, Any]] = []
    for scene in candidates:
        dt = iso_to_datetime(scene["datetime"])
        too_close = any(
            abs((dt - iso_to_datetime(c["datetime"])).days) < min_days_between
            for c in selected
        )
        if not too_close:
            selected.append(scene)
        if len(selected) >= max_scenes:
            break
    if len(selected) < max_scenes:
        for scene in candidates:
            if scene not in selected:
                selected.append(scene)
            if len(selected) >= max_scenes:
                break
    return selected


# =========================================================
# PROCESS API
# =========================================================

def build_evalscript() -> str:
    return """
//VERSION=3
function setup() {
  return {
    input: [{bands: ["B04","B08","B11","B12","SCL","dataMask"]}],
    output: {bands: 6, sampleType: "FLOAT32"}
  };
}
function evaluatePixel(sample) {
  return [sample.B04, sample.B08, sample.B11, sample.B12, sample.SCL, sample.dataMask];
}
"""


def build_process_payload(bbox: List[float], time_from: str, time_to: str) -> Dict[str, Any]:
    return {
        "input": {
            "bounds": {
                "bbox": bbox,
                "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
            },
            "data": [{
                "type": "sentinel-2-l2a",
                "dataFilter": {
                    "timeRange": {"from": time_from, "to": time_to},
                    "maxCloudCoverage": MAX_CLOUD_COVERAGE,
                    "mosaickingOrder": "leastCC",
                },
            }],
        },
        "output": {
            "width": IMAGE_WIDTH,
            "height": IMAGE_HEIGHT,
            "responses": [{
                "identifier": "default",
                "format": {"type": "image/tiff"},
            }],
        },
        "evalscript": build_evalscript(),
    }


def validate_tiff_bytes(raw: bytes) -> None:
    if not raw or len(raw) < 1024:
        raise RuntimeError(f"TIFF prea mic ({len(raw)} bytes) - probabil eroare API.")
    with rasterio.open(io.BytesIO(raw)) as src:
        if src.count < 6:
            raise RuntimeError(f"Asteptam 6 benzi, am primit {src.count}.")


def download_tiff(
        access_token: str,
        bbox: List[float],
        time_from: str,
        time_to: str,
        out_path: str,
) -> None:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    payload = build_process_payload(bbox, time_from, time_to)
    last_error: Optional[Exception] = None

    for attempt in range(1, RETRY_COUNT + 1):
        try:
            r = requests.post(
                PROCESS_URL,
                headers=headers,
                data=json.dumps(payload),
                timeout=REQUEST_TIMEOUT,
            )
            if r.status_code == 401:
                raise PermissionError("Token expirat la Process API.")
            if not r.ok:
                try:
                    body = r.json()
                except Exception:
                    body = r.text[:300]
                raise RuntimeError(f"Process API {r.status_code}: {body}")

            validate_tiff_bytes(r.content)
            with open(out_path, "wb") as f:
                f.write(r.content)
            return
        except PermissionError:
            raise
        except Exception as e:
            last_error = e
            print(f"    [incercare {attempt}/{RETRY_COUNT}] eroare: {e}")
            if attempt < RETRY_COUNT:
                time.sleep(RETRY_SLEEP_SECONDS)

    raise RuntimeError(f"Esec descarcare TIFF dupa {RETRY_COUNT} incercari: {last_error}")


# =========================================================
# RASTER / QUALITY
# =========================================================

def read_bands(tiff_path: str) -> Dict[str, np.ndarray]:
    with rasterio.open(tiff_path) as src:
        return {
            "b04": src.read(1).astype(np.float32),
            "b08": src.read(2).astype(np.float32),
            "b11": src.read(3).astype(np.float32),
            "b12": src.read(4).astype(np.float32),
            "scl": src.read(5).astype(np.int32),
            "data_mask": src.read(6).astype(np.int32),
        }


def build_ndvi(b04: np.ndarray, b08: np.ndarray, data_mask: np.ndarray) -> np.ndarray:
    ndvi = np.full(b04.shape, np.nan, dtype=np.float32)
    valid = data_mask == 1
    denom = b08 + b04
    ok = valid & np.isfinite(b04) & np.isfinite(b08) & (np.abs(denom) > 1e-6)
    ndvi[ok] = (b08[ok] - b04[ok]) / denom[ok]
    return ndvi


def compute_stats(tiff_path: str) -> Dict[str, Any]:
    bands = read_bands(tiff_path)
    b04, b08, b11, b12 = bands["b04"], bands["b08"], bands["b11"], bands["b12"]
    scl, data_mask = bands["scl"], bands["data_mask"]

    total_pixels = int(data_mask.size)
    valid_mask = data_mask == 1
    valid_pixels = int(valid_mask.sum())

    if valid_pixels == 0:
        return {
            "valid_ratio": 0.0, "cloud_ratio_valid": 1.0,
            "mean_ndvi": np.nan, "min_ndvi": np.nan, "max_ndvi": np.nan,
            "mean_b11": np.nan, "mean_b12": np.nan,
            "valid_pixels": valid_pixels, "total_pixels": total_pixels,
            "is_good": False, "error_flag": "no_valid_pixels",
        }

    ndvi = build_ndvi(b04, b08, data_mask)

    cloudy = valid_mask & np.isin(scl, list(CLOUDY_SCL_VALUES))
    cloud_ratio_valid = float(cloudy.sum()) / float(valid_pixels)
    valid_ratio = float(valid_pixels) / float(total_pixels)

    clean = valid_mask & ~np.isin(scl, list(BAD_SCL_VALUES))
    mean_b11 = float(np.nanmean(np.where(clean, b11, np.nan))) if clean.any() else np.nan
    mean_b12 = float(np.nanmean(np.where(clean, b12, np.nan))) if clean.any() else np.nan

    finite_ndvi = ndvi[np.isfinite(ndvi)]
    if finite_ndvi.size == 0:
        return {
            "valid_ratio": valid_ratio, "cloud_ratio_valid": cloud_ratio_valid,
            "mean_ndvi": np.nan, "min_ndvi": np.nan, "max_ndvi": np.nan,
            "mean_b11": mean_b11, "mean_b12": mean_b12,
            "valid_pixels": valid_pixels, "total_pixels": total_pixels,
            "is_good": False, "error_flag": "ndvi_all_nan",
        }

    mean_ndvi = float(np.nanmean(finite_ndvi))
    min_ndvi = float(np.nanmin(finite_ndvi))
    max_ndvi = float(np.nanmax(finite_ndvi))

    is_good = (valid_ratio > 0.35) and (cloud_ratio_valid < 0.25) and np.isfinite(mean_ndvi)

    return {
        "valid_ratio": valid_ratio, "cloud_ratio_valid": cloud_ratio_valid,
        "mean_ndvi": mean_ndvi, "min_ndvi": min_ndvi, "max_ndvi": max_ndvi,
        "mean_b11": mean_b11, "mean_b12": mean_b12,
        "valid_pixels": valid_pixels, "total_pixels": total_pixels,
        "is_good": bool(is_good), "error_flag": "",
    }


# =========================================================
# PREVIEW - genereaza PNG in memorie (bytes), nu pe disk
# =========================================================

def build_ndvi_preview_png(tiff_path: str, title: str) -> bytes:
    """Genereaza imaginea NDVI ca PNG si o returneaza ca bytes (pentru DB)."""
    bands = read_bands(tiff_path)
    ndvi = build_ndvi(bands["b04"], bands["b08"], bands["data_mask"])

    buffer = io.BytesIO()
    finite_vals = ndvi[np.isfinite(ndvi)]

    if finite_vals.size == 0:
        fig, ax = plt.subplots(figsize=(8, 8))
        ax.text(0.5, 0.5, "NDVI indisponibil\n(toate NaN)", ha="center", va="center", fontsize=14)
        ax.axis("off")
        plt.tight_layout()
        plt.savefig(buffer, format="png", dpi=120)
        plt.close()
        return buffer.getvalue()

    p5 = float(np.percentile(finite_vals, 5))
    p95 = float(np.percentile(finite_vals, 95))
    if abs(p95 - p5) < 1e-6:
        p5 -= 0.05
        p95 += 0.05

    fig, ax = plt.subplots(figsize=(8, 8))
    im = ax.imshow(ndvi, cmap="RdYlGn", vmin=p5, vmax=p95)
    plt.colorbar(im, ax=ax, label="NDVI")
    ax.set_title(title, fontsize=8)
    ax.axis("off")
    plt.tight_layout()
    plt.savefig(buffer, format="png", dpi=120)
    plt.close()
    return buffer.getvalue()


# =========================================================
# SCRIERE IN DB
# =========================================================

def scene_exists(session, scene_id: str, county: str) -> bool:
    stmt = select(SatelliteScene).where(
        SatelliteScene.scene_id == scene_id,
        SatelliteScene.county == county,
    )
    return session.exec(stmt).first() is not None


def save_scene_to_db(
        session,
        county: str,
        year: int,
        scene_id: str,
        acquisition_datetime: str,
        acquisition_date: str,
        catalog_cloud_cover: Optional[float],
        tiff_path: str,
        stats: Dict[str, Any],
        png_bytes: bytes,
        bbox: Optional[List[float]] = None,
) -> None:
    scene = SatelliteScene(
        scene_id=scene_id,
        county=county,
        year=year,
        acquisition_date=acquisition_date,
        acquisition_datetime=acquisition_datetime,
        min_lon=bbox[0] if bbox else None,
        min_lat=bbox[1] if bbox else None,
        max_lon=bbox[2] if bbox else None,
        max_lat=bbox[3] if bbox else None,
        mean_ndvi=clean_nan(stats.get("mean_ndvi")),
        min_ndvi=clean_nan(stats.get("min_ndvi")),
        max_ndvi=clean_nan(stats.get("max_ndvi")),
        mean_b11=clean_nan(stats.get("mean_b11")),
        mean_b12=clean_nan(stats.get("mean_b12")),
        cloud_ratio_valid=clean_nan(stats.get("cloud_ratio_valid")),
        catalog_cloud_cover=clean_nan(catalog_cloud_cover),
        valid_ratio=clean_nan(stats.get("valid_ratio")),
        valid_pixels=stats.get("valid_pixels"),
        total_pixels=stats.get("total_pixels"),
        is_good=bool(stats.get("is_good", False)),
        file_tiff=tiff_path,
        file_preview=None,  # imaginea e in DB acum, nu pe disk
        error_flag=stats.get("error_flag", ""),
    )
    session.add(scene)

    image = SatelliteImage(
        scene_id=scene_id,
        county=county,
        year=year,
        image_type="ndvi_preview",
        filename=f"{scene_id}_NDVI.png",
        mime_type="image/png",
        size_bytes=len(png_bytes),
        content=png_bytes,
    )
    session.add(image)
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
    # Determinam bbox-ul (area) si eticheta (db_label) sub care salvam in DB
    if bbox is not None:
        area = bbox
        db_label = label or make_bbox_label(bbox)
    else:
        if county not in COUNTIES:
            raise ValueError(f"Judet necunoscut: {county}. Optiuni: {list(COUNTIES.keys())}")
        area = COUNTIES[county]
        db_label = county

    month_day_from = f"{start_month:02d}-01"
    month_day_to = f"{end_month:02d}-28"

    ensure_dir(TIFF_DIR)
    out_dir = os.path.join(TIFF_DIR, db_label)
    ensure_dir(out_dir)

    print("Obtin token Copernicus...")
    token = get_access_token(CLIENT_ID, CLIENT_SECRET)
    print("Token obtinut.\n")

    session = get_session()

    try:
        for year in range(start_year, end_year + 1):
            search_from, search_to = make_time_window(year, month_day_from, month_day_to)
            print(f"[{db_label} - {year}] Caut in catalog ({search_from[:10]} -> {search_to[:10]})...")

            try:
                try:
                    features = search_catalog_scenes(token, area, search_from, search_to)
                except PermissionError:
                    print("  Token expirat la catalog - reinnoiesc...")
                    token = get_access_token(CLIENT_ID, CLIENT_SECRET)
                    features = search_catalog_scenes(token, area, search_from, search_to)

                print(f"  Gasite {len(features)} scene in catalog.")
                if not features:
                    print("  Nicio scena gasita.")
                    continue

                candidates = unique_scenes_by_day(features)
                selected = select_spread_scenes(candidates, SCENES_PER_YEAR, MIN_DAYS_BETWEEN_SCENES)
                if not selected:
                    print("  Nu am putut selecta scene utile.")
                    continue

                for idx, scene in enumerate(selected, start=1):
                    acq_dt = scene["datetime"]
                    acq_day = acq_dt[:10]
                    cc = scene.get("cloud_cover")
                    sid = scene.get("id", "")
                    print(f"  Scena {idx}/{len(selected)}: {acq_dt} | cloud={cc}")

                    if scene_exists(session, sid, db_label):
                        print(f"    SKIP (deja in DB): {sid[:40]}")
                        continue

                    time_from_day, time_to_day = make_day_window(acq_dt)
                    safe_sid = sanitize_filename(sid)[:40] if sid else f"scene_{idx:02d}"
                    base_name = f"{db_label}_{year}_{acq_day}_s{idx:02d}_{safe_sid}"
                    tif_path = os.path.join(out_dir, base_name + ".tif")

                    try:
                        try:
                            download_tiff(token, area, time_from_day, time_to_day, tif_path)
                        except PermissionError:
                            print("    Token expirat la Process API - reinnoiesc...")
                            token = get_access_token(CLIENT_ID, CLIENT_SECRET)
                            download_tiff(token, area, time_from_day, time_to_day, tif_path)

                        stats = compute_stats(tif_path)
                        png_bytes = build_ndvi_preview_png(tif_path, base_name)

                        save_scene_to_db(
                            session=session,
                            county=db_label,
                            year=year,
                            scene_id=sid,
                            acquisition_datetime=acq_dt,
                            acquisition_date=acq_day,
                            catalog_cloud_cover=cc,
                            tiff_path=tif_path,
                            stats=stats,
                            png_bytes=png_bytes,
                            bbox=area,
                        )

                        print(
                            f"    OK | valid={stats['valid_ratio']:.2f} "
                            f"| cloud={stats['cloud_ratio_valid']:.2f} "
                            f"| ndvi={stats['mean_ndvi']} "
                            f"| good={stats['is_good']}"
                        )

                    except Exception as e:
                        print(f"    EROARE scena {idx}: {e}")

            except Exception as e:
                print(f"  EROARE generala [{db_label} {year}]: {e}")

    finally:
        session.close()

    print(f"\nGata. Extractie completa pentru {db_label} {start_year}-{end_year}.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Extractie scene Sentinel-2 in DB")
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