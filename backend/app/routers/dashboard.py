from __future__ import annotations
from calendar import monthrange
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.db.database import get_session
from app.db.models import User, ExtractedPeriod, SatelliteScene, Era5Data
from app.routers.auth import get_current_user
from app.schemas.dashboard import (
    DashboardQueryRequest,
    DashboardDataResponse,
    SceneResponse,
    Era5Response,
)
from urllib.parse import quote
from app.schemas.dashboard import AnalysisResponse
from app.services.analysis import build_analysis
from app.schemas.dashboard import BboxQueryRequest
from app.schemas.dashboard import CoverageRequest, CoverageResponse, CellCoverage
from app.services.grid import bbox_to_cells
from sqlalchemy import func
from statistics import mean

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)

def build_date_range (
        start_year:int,
        end_year:int,
        start_month:int,
        end_month:int,
)->tuple[str,str]:
    date_from = f"{start_year:04d}-{start_month:02d}-01"
    last_day = monthrange(end_year, end_month)[1]
    date_to = f"{end_year:04d}-{end_month:02d}-{last_day:02d}"
    return date_from, date_to

@router.post("/query", response_model=DashboardDataResponse)
def query_dashboard(
        query:DashboardQueryRequest,
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_user),
):
    date_from,date_to = build_date_range(
        query.start_year,
        query.end_year,
        query.start_month,
        query.end_month,
    )
    scenes_stmt = select(SatelliteScene).where(
        SatelliteScene.county == query.county,
        SatelliteScene.acquisition_date >= date_from,
        SatelliteScene.acquisition_date <= date_to,
    ).order_by(SatelliteScene.acquisition_date)

    scenes = session.exec(scenes_stmt).all()

    if not scenes:
        return DashboardDataResponse(
            county=query.county,
            start_year=query.start_year,
            end_year=query.end_year,
            start_month=query.start_month,
            end_month=query.end_month,
            scenes=[],
            era5_data=[],
            scenes_count=0,
            extracted_at="",
            data_exists=False,
        )
    scene_ids = [s.scene_id for s in scenes]
    era5_stmt = select(Era5Data).where(
        Era5Data.scene_id.in_(scene_ids),
        Era5Data.county == query.county,
    )
    era5_rows = session.exec(era5_stmt).all()

    scene_responses = []

    for scene in scenes:
        scene_response = SceneResponse.model_validate(scene)

        scene_response.file_preview = (
            f"/images/by-scene"
            f"?county={quote(scene.county)}"
            f"&scene_id={quote(scene.scene_id)}"
            f"&image_type=ndvi_preview"
        )

        scene_responses.append(scene_response)
        era5_responses = [Era5Response.model_validate(e) for e in era5_rows]

    return DashboardDataResponse(
        county=query.county,
        start_year=query.start_year,
        end_year=query.end_year,
        start_month=query.start_month,
        end_month=query.end_month,
        scenes=scene_responses,
        era5_data=era5_responses,
        scenes_count=len(scene_responses),
        extracted_at=scenes[0].acquisition_datetime,
        data_exists=True,
    )

@router.post("/analysis", response_model=AnalysisResponse)
def analyze_dashboard(
        query: DashboardQueryRequest,
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_user),
):
    date_from, date_to = build_date_range(
        query.start_year, query.end_year,
        query.start_month, query.end_month,
    )

    scenes_stmt = select(SatelliteScene).where(
        SatelliteScene.county == query.county,
        SatelliteScene.acquisition_date >= date_from,
        SatelliteScene.acquisition_date <= date_to,
    )
    scenes = session.exec(scenes_stmt).all()

    scene_ids = [s.scene_id for s in scenes]
    era5_rows = []
    if scene_ids:
        era5_stmt = select(Era5Data).where(
            Era5Data.scene_id.in_(scene_ids),
            Era5Data.county == query.county,
        )
        era5_rows = session.exec(era5_stmt).all()

    result = build_analysis(scenes, era5_rows)
    result["county"] = query.county

    return AnalysisResponse(**result)

@router.post("/query-bbox", response_model=DashboardDataResponse)
def query_dashboard_bbox(
        query: BboxQueryRequest,
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_user),
):
    date_from = f"{query.start_year:04d}-{query.start_month:02d}-01"
    last_day = monthrange(query.end_year, query.end_month)[1]
    date_to = f"{query.end_year:04d}-{query.end_month:02d}-{last_day:02d}"

    scenes_stmt = select(SatelliteScene).where(
        SatelliteScene.acquisition_date >= date_from,
        SatelliteScene.acquisition_date <= date_to,
        SatelliteScene.min_lon < query.max_lon,
        SatelliteScene.max_lon > query.min_lon,
        SatelliteScene.min_lat < query.max_lat,
        SatelliteScene.max_lat > query.min_lat,
    ).order_by(SatelliteScene.acquisition_date)

    scenes = session.exec(scenes_stmt).all()

    if not scenes:
        return DashboardDataResponse(
            county="custom",
            start_year=query.start_year,
            end_year=query.end_year,
            start_month=query.start_month,
            end_month=query.end_month,
            scenes=[],
            era5_data=[],
            scenes_count=0,
            extracted_at="",
            data_exists=False,
        )

    scene_ids = [s.scene_id for s in scenes]
    era5_stmt = select(Era5Data).where(
        Era5Data.scene_id.in_(scene_ids),
    )
    era5_rows = session.exec(era5_stmt).all()

    scene_responses = [SceneResponse.model_validate(s) for s in scenes]
    era5_responses = [Era5Response.model_validate(e) for e in era5_rows]

    return DashboardDataResponse(
        county="custom",
        start_year=query.start_year,
        end_year=query.end_year,
        start_month=query.start_month,
        end_month=query.end_month,
        scenes=scene_responses,
        era5_data=era5_responses,
        scenes_count=len(scene_responses),
        extracted_at=scenes[0].acquisition_datetime,
        data_exists=True,
    )


@router.post("/temporal-coverage")
def check_temporal_coverage(
        query: BboxQueryRequest,
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_user),
):
    missing: list[dict] = []
    present: list[dict] = []

    for year in range(query.start_year, query.end_year + 1):
        for month in range(query.start_month, query.end_month + 1):
            m_from = f"{year:04d}-{month:02d}-01"
            last_day = monthrange(year, month)[1]
            m_to = f"{year:04d}-{month:02d}-{last_day:02d}"

            count_stmt = select(func.count()).select_from(SatelliteScene).where(
                SatelliteScene.acquisition_date >= m_from,
                SatelliteScene.acquisition_date <= m_to,
                SatelliteScene.min_lon < query.max_lon,
                SatelliteScene.max_lon > query.min_lon,
                SatelliteScene.min_lat < query.max_lat,
                SatelliteScene.max_lat > query.min_lat,
            )
            n = session.exec(count_stmt).one()

            entry = {"year": year, "month": month, "scene_count": n}
            if n > 0:
                present.append(entry)
            else:
                missing.append(entry)

    total = len(present) + len(missing)
    return {
        "total_periods": total,
        "present_periods": len(present),
        "missing_periods": len(missing),
        "missing": missing,
        "fully_covered": len(missing) == 0,
    }
@router.post("/coverage", response_model=CoverageResponse)
def check_coverage(
        query: CoverageRequest,
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_user),
):
    date_from = f"{query.start_year:04d}-{query.start_month:02d}-01"
    last_day = monthrange(query.end_year, query.end_month)[1]
    date_to = f"{query.end_year:04d}-{query.end_month:02d}-{last_day:02d}"

    cells = bbox_to_cells(query.min_lon, query.min_lat, query.max_lon, query.max_lat)

    cell_results: list[CellCoverage] = []
    covered = 0

    for cell in cells:
        # Numaram scenele care se intersecteaza cu aceasta celula, in perioada
        count_stmt = select(func.count()).select_from(SatelliteScene).where(
            SatelliteScene.acquisition_date >= date_from,
            SatelliteScene.acquisition_date <= date_to,
            SatelliteScene.min_lon < cell.max_lon,
            SatelliteScene.max_lon > cell.min_lon,
            SatelliteScene.min_lat < cell.max_lat,
            SatelliteScene.max_lat > cell.min_lat,
        )
        scene_count = session.exec(count_stmt).one()
        is_covered = scene_count > 0
        if is_covered:
            covered += 1

        cell_results.append(CellCoverage(
            cell_id=cell.cell_id,
            min_lon=cell.min_lon,
            min_lat=cell.min_lat,
            max_lon=cell.max_lon,
            max_lat=cell.max_lat,
            scene_count=scene_count,
            covered=is_covered,
        ))

    return CoverageResponse(
        total_cells=len(cells),
        covered_cells=covered,
        missing_cells=len(cells) - covered,
        cells=cell_results,
    )


ANOMALY_FEATURES = [
    "t2m_mean_c", "t2m_max_c", "t2m_min_c", "skin_temp_mean_c",
    "precip_total_mm", "pet_total_mm", "evap_bare_soil_mm", "surface_runoff_mm",
    "soil_moisture_l1_mean", "soil_moisture_l2_mean", "wind_speed_mean_ms", "aridity_index",
]


@router.post("/anomaly-bbox")
def anomaly_bbox(
        query: BboxQueryRequest,
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_user),
):
    from app.db.models import SceneCell
    from app.services.ml_predict import predict_ndvi, model_is_available

    if not model_is_available():
        return {"error": "Modelul AI nu e disponibil.", "cells": []}

    # data range din perioada ceruta
    date_from = f"{query.start_year:04d}-{query.start_month:02d}-01"
    date_to = f"{query.end_year:04d}-{query.end_month:02d}-31"

    # celulele din scene_cells care cad in bbox + perioada
    stmt = select(SceneCell).where(
        SceneCell.acquisition_date >= date_from,
        SceneCell.acquisition_date <= date_to,
        SceneCell.cell_lon >= query.min_lon,
        SceneCell.cell_lon <= query.max_lon,
        SceneCell.cell_lat >= query.min_lat,
        SceneCell.cell_lat <= query.max_lat,
    )
    rows = session.exec(stmt).all()

    # grupam pe celula (o celula poate avea mai multe scene in perioada) si mediem
    by_cell: dict = {}
    for r in rows:
        # verificam ca are toate features
        if any(getattr(r, f, None) is None for f in ANOMALY_FEATURES):
            continue
        if r.mean_ndvi is None:
            continue
        key = (round(r.cell_lat, 2), round(r.cell_lon, 2))
        by_cell.setdefault(key, []).append(r)

    cells = []
    for (lat, lon), cell_rows in by_cell.items():
        # NDVI real mediu pe celula (peste scenele din perioada)
        real_ndvi = mean(cr.mean_ndvi for cr in cell_rows)

        # clima medie pe celula -> predictie
        feats = {}
        for f in ANOMALY_FEATURES:
            feats[f] = mean(getattr(cr, f) for cr in cell_rows)
        try:
            pred_ndvi = predict_ndvi(feats)
        except Exception:
            continue

        anomaly = real_ndvi - pred_ndvi
        cells.append({
            "cell_lat": lat,
            "cell_lon": lon,
            "real_ndvi": round(real_ndvi, 4),
            "predicted_ndvi": round(pred_ndvi, 4),
            "anomaly": round(anomaly, 4),
        })

    # statistici sumare
    if cells:
        anomalies = [c["anomaly"] for c in cells]
        summary = {
            "n_cells": len(cells),
            "mean_anomaly": round(mean(anomalies), 4),
            "min_anomaly": round(min(anomalies), 4),
            "max_anomaly": round(max(anomalies), 4),
        }
    else:
        summary = {"n_cells": 0}

    return {"cells": cells, "summary": summary}
