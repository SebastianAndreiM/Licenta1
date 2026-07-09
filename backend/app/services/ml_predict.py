"""
Serviciu de predictie NDVI folosind modelul Random Forest antrenat.
Incarca modelul o singura data (la pornire) si il refoloseste.
"""

from __future__ import annotations

import os
import joblib
from typing import Optional

# Calea spre modelul antrenat (in folderul ml/)
ML_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "ml")
MODEL_PATH = os.path.join(ML_DIR, "model_random_forest.joblib")

# Variabilele de intrare, in ordinea cu care a fost antrenat modelul
FEATURE_COLUMNS = [
    "t2m_mean_c", "t2m_max_c", "t2m_min_c", "skin_temp_mean_c",
    "precip_total_mm", "pet_total_mm", "evap_bare_soil_mm", "surface_runoff_mm",
    "soil_moisture_l1_mean", "soil_moisture_l2_mean", "wind_speed_mean_ms", "aridity_index",
]

# Incarcam modelul o data (cache la nivel de modul)
_model_bundle: Optional[dict] = None


def _load_model() -> dict:
    global _model_bundle
    if _model_bundle is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Modelul nu exista la {MODEL_PATH}. "
                "Ruleaza intai: python -m ml.compare_models"
            )
        _model_bundle = joblib.load(MODEL_PATH)
    return _model_bundle


def predict_ndvi(features: dict) -> float:
    """
    Prezice NDVI dintr-un dict cu cele 12 variabile climatice.
    features: {"t2m_mean_c": 22.5, "precip_total_mm": 150.0, ...}
    """
    bundle = _load_model()
    model = bundle["model"]
    cols = bundle["features"]

    # Construim vectorul de input in ordinea corecta
    row = [[features[col] for col in cols]]

    # Random Forest nu foloseste scalare (bundle["scaled"] == False)
    pred = model.predict(row)
    return float(pred[0])


def model_is_available() -> bool:
    """Verifica daca modelul exista pe disc."""
    return os.path.exists(MODEL_PATH)