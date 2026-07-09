from __future__ import annotations

import random
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.database import get_session
from app.db.models import User, SatelliteScene, Era5Data
from app.routers.auth import get_current_user
from app.services.ml_predict import predict_ndvi, model_is_available, FEATURE_COLUMNS
from pydantic import BaseModel

router = APIRouter(
    prefix="/ml",
    tags=["Machine Learning"],
)


class PredictionResponse(BaseModel):
    scene_id: str
    county: str
    acquisition_date: str
    predicted_ndvi: float
    actual_ndvi: float
    error: float            # diferenta absoluta
    features_used: dict     # variabilele climatice folosite


class RandomSceneResponse(BaseModel):
    scene_id: str


@router.get("/status")
def ml_status():
    """Verifica daca modelul este disponibil."""
    return {"model_available": model_is_available()}


@router.get("/random-scene", response_model=RandomSceneResponse)
def get_random_scene(
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_user),
):
    """Intoarce un scene_id aleatoriu dintre scenele bune care au si date ERA5."""
    # luam scene_id-urile care exista si in ERA5
    era5_ids = session.exec(select(Era5Data.scene_id)).all()
    era5_id_set = set(era5_ids)

    good_scenes = session.exec(
        select(SatelliteScene.scene_id).where(
            SatelliteScene.is_good == True,  # noqa: E712
            SatelliteScene.mean_ndvi.is_not(None),
        )
    ).all()

    candidates = [sid for sid in good_scenes if sid in era5_id_set]
    if not candidates:
        raise HTTPException(status_code=404, detail="Nicio scena disponibila pentru predictie.")

    return RandomSceneResponse(scene_id=random.choice(candidates))


@router.get("/predict-scene/{scene_id}", response_model=PredictionResponse)
def predict_scene(
        scene_id: str,
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_user),
):
    """
    Prezice NDVI pentru o scena reala, folosind doar variabilele climatice ERA5,
    si compara cu NDVI-ul real masurat din satelit.
    """
    if not model_is_available():
        raise HTTPException(
            status_code=503,
            detail="Modelul nu este antrenat. Ruleaza compare_models.py.",
        )

    scene = session.exec(
        select(SatelliteScene).where(SatelliteScene.scene_id == scene_id)
    ).first()
    if scene is None:
        raise HTTPException(status_code=404, detail="Scena nu exista.")
    if scene.mean_ndvi is None:
        raise HTTPException(status_code=400, detail="Scena nu are NDVI masurat.")

    era5 = session.exec(
        select(Era5Data).where(Era5Data.scene_id == scene_id)
    ).first()
    if era5 is None:
        raise HTTPException(status_code=404, detail="Scena nu are date climatice ERA5.")

    # construim dict-ul de features din datele ERA5 reale
    features = {}
    for col in FEATURE_COLUMNS:
        val = getattr(era5, col, None)
        if val is None:
            raise HTTPException(
                status_code=400,
                detail=f"Lipseste variabila climatica '{col}' pentru aceasta scena.",
            )
        features[col] = float(val)

    predicted = predict_ndvi(features)
    actual = float(scene.mean_ndvi)

    return PredictionResponse(
        scene_id=scene.scene_id,
        county=scene.county,
        acquisition_date=scene.acquisition_date,
        predicted_ndvi=round(predicted, 4),
        actual_ndvi=round(actual, 4),
        error=round(abs(predicted - actual), 4),
        features_used=features,
    )