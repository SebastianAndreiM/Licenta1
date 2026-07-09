"""
Compara 4 modele de regresie pentru predictia NDVI din variabile climatice:
  - Regresie liniara  (baseline liniar)
  - Random Forest     (bagging pe arbori)
  - XGBoost           (boosting pe arbori)
  - MLP               (retea neuronala, cu epoci)

Toate folosesc EXACT aceleasi date, aceeasi impartire train/test si aceleasi
metrici - singurul mod corect de a compara.

Ruleaza din folderul backend:
    python -m ml.compare_models

Produce:
    ml/model_<nume>.joblib       - fiecare model antrenat
    ml/comparison_results.csv    - tabelul comparativ (pentru lucrare)
    ml/comparison_r2.png         - grafic comparativ R2
    ml/feature_importance.png    - importanta variabilelor (XGBoost / RF)
    ml/predicted_vs_actual.png   - predictie vs realitate (modelul castigator)
    ml/mlp_loss_curve.png        - curba de invatare pe epoci a retelei MLP
"""

from __future__ import annotations

import os
import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
from sklearn.model_selection import GroupShuffleSplit


try:
    from xgboost import XGBRegressor
    HAS_XGB = True
except ImportError:
    HAS_XGB = False
    print("XGBoost nu e instalat - se sare (ruleaza: pip install xgboost).")

ML_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(ML_DIR, "dataset.csv")

FEATURE_COLUMNS = [
    "t2m_mean_c", "t2m_max_c", "t2m_min_c", "skin_temp_mean_c",
    "precip_total_mm", "pet_total_mm", "evap_bare_soil_mm", "surface_runoff_mm",
    "soil_moisture_l1_mean", "soil_moisture_l2_mean", "wind_speed_mean_ms", "aridity_index",
]

FEATURE_LABELS = {
    "t2m_mean_c": "Temp. medie", "t2m_max_c": "Temp. max", "t2m_min_c": "Temp. min",
    "skin_temp_mean_c": "Temp. sol", "precip_total_mm": "Precipitatii",
    "pet_total_mm": "Evapotranspiratie", "evap_bare_soil_mm": "Evap. sol gol",
    "surface_runoff_mm": "Scurgere", "soil_moisture_l1_mean": "Umiditate sol L1",
    "soil_moisture_l2_mean": "Umiditate sol L2", "wind_speed_mean_ms": "Viteza vant",
    "aridity_index": "Indice ariditate",
}

TARGET_COLUMN = "mean_ndvi"


def load_data() -> pd.DataFrame:
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(
            f"Nu gasesc {CSV_PATH}. Ruleaza intai: python -m ml.export_dataset"
        )
    df = pd.read_csv(CSV_PATH)
    df = df.dropna(subset=FEATURE_COLUMNS + [TARGET_COLUMN])
    print(f"Inregistrari folosite: {len(df)}")
    return df


def main() -> None:
    df = load_data()
    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    # Split pe SCENE intregi (nu random pe celule) - evita data leakage:
    # toate celulele unei scene merg fie in train, fie in test.
    # Grupul = scena unica (judet + data achizitiei).
    groups = df["county"].astype(str) + "_" + df["acquisition_date"].astype(str)
    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(gss.split(X, y, groups=groups))

    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

    n_scene_train = groups.iloc[train_idx].nunique()
    n_scene_test = groups.iloc[test_idx].nunique()
    print(f"Split pe scene: {n_scene_train} scene train / {n_scene_test} scene test")
    print(f"Antrenare: {len(X_train)} | Testare: {len(X_test)}\n")

    scaler = StandardScaler().fit(X_train)
    X_train_s = scaler.transform(X_train)
    X_test_s = scaler.transform(X_test)

    results = []
    trained = {}

    lin = LinearRegression()
    lin.fit(X_train_s, y_train)
    pred = lin.predict(X_test_s)
    _record("Regresie liniara", y_test, pred, results)
    trained["Regresie liniara"] = (lin, True)

    rf = RandomForestRegressor(
        n_estimators=300,
        min_samples_leaf=2,
        max_features="sqrt",
        random_state=42, n_jobs=-1,
    )
    rf.fit(X_train, y_train)
    pred = rf.predict(X_test)
    _record("Random Forest", y_test, pred, results)
    trained["Random Forest"] = (rf, False)

    if HAS_XGB:
        xgb = XGBRegressor(
            n_estimators=600,
            max_depth=8,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42, n_jobs=-1, verbosity=0,
        )
        xgb.fit(X_train, y_train)
        pred = xgb.predict(X_test)
        _record("XGBoost", y_test, pred, results)
        trained["XGBoost"] = (xgb, False)

    mlp = MLPRegressor(
        hidden_layer_sizes=(64, 32),
        activation="relu",
        solver="adam",
        max_iter=500,
        early_stopping=True,
        n_iter_no_change=20,
        random_state=42,
    )
    mlp.fit(X_train_s, y_train)
    pred = mlp.predict(X_test_s)
    _record("MLP (retea neuronala)", y_test, pred, results)
    trained["MLP (retea neuronala)"] = (mlp, True)
    print(f"  (MLP a rulat {mlp.n_iter_} epoci)")

    for name, (model, scaled) in trained.items():
        fname = name.lower().replace(" ", "_").replace("(", "").replace(")", "")
        joblib.dump(
            {"model": model, "features": FEATURE_COLUMNS,
             "scaled": scaled, "scaler": scaler if scaled else None},
            os.path.join(ML_DIR, f"model_{fname}.joblib"),
        )

    res_df = pd.DataFrame(results).sort_values("R2", ascending=False).reset_index(drop=True)
    res_df.to_csv(os.path.join(ML_DIR, "comparison_results.csv"), index=False)
    print("\n=== CLASAMENT (dupa R2) ===")
    print(res_df.to_string(index=False))

    best_name = res_df.iloc[0]["Model"]
    print(f"\nCel mai bun model: {best_name}")

    plt.figure(figsize=(8, 5))
    colors = ["#1B7A3E", "#25408F", "#d97706", "#941333"][:len(res_df)]
    plt.bar(res_df["Model"], res_df["R2"], color=colors)
    plt.ylabel("R2 (mai mare = mai bun)")
    plt.title("Comparatie modele - predictie NDVI din clima")
    plt.xticks(rotation=15, ha="right")
    plt.ylim(0, 1)
    for i, v in enumerate(res_df["R2"]):
        plt.text(i, v + 0.02, f"{v:.3f}", ha="center", fontsize=10)
    plt.tight_layout()
    plt.savefig(os.path.join(ML_DIR, "comparison_r2.png"), dpi=120)
    plt.close()

    tree_model, tree_name = None, None
    for cand in ["XGBoost", "Random Forest"]:
        if cand in trained:
            tree_model = trained[cand][0]
            tree_name = cand
            break
    if tree_model is not None and hasattr(tree_model, "feature_importances_"):
        importances = tree_model.feature_importances_
        order = np.argsort(importances)
        labels = [FEATURE_LABELS.get(FEATURE_COLUMNS[i], FEATURE_COLUMNS[i]) for i in order]
        plt.figure(figsize=(8, 6))
        plt.barh(range(len(order)), importances[order], color="#1B7A3E")
        plt.yticks(range(len(order)), labels)
        plt.xlabel("Importanta")
        plt.title(f"Importanta variabilelor ({tree_name})")
        plt.tight_layout()
        plt.savefig(os.path.join(ML_DIR, "feature_importance.png"), dpi=120)
        plt.close()

    best_model, best_scaled = trained[best_name]
    Xt = X_test_s if best_scaled else X_test
    y_pred_best = best_model.predict(Xt)
    plt.figure(figsize=(6, 6))
    plt.scatter(y_test, y_pred_best, alpha=0.4, color="#25408F", s=20)
    lims = [min(y_test.min(), y_pred_best.min()), max(y_test.max(), y_pred_best.max())]
    plt.plot(lims, lims, color="#941333", linestyle="--", label="Predictie perfecta")
    plt.xlabel("NDVI real")
    plt.ylabel("NDVI prezis")
    plt.title(f"Predictie vs realitate - {best_name}")
    plt.legend()
    plt.tight_layout()
    plt.savefig(os.path.join(ML_DIR, "predicted_vs_actual.png"), dpi=120)
    plt.close()

    if hasattr(mlp, "loss_curve_"):
        plt.figure(figsize=(7, 5))
        plt.plot(range(1, len(mlp.loss_curve_) + 1), mlp.loss_curve_, color="#941333")
        plt.xlabel("Epoca")
        plt.ylabel("Pierdere (loss)")
        plt.title("Curba de invatare MLP - pierderea scade cu fiecare epoca")
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig(os.path.join(ML_DIR, "mlp_loss_curve.png"), dpi=120)
        plt.close()

    print(f"\nFisiere salvate in {ML_DIR}:")
    print("  comparison_results.csv, comparison_r2.png,")
    print("  feature_importance.png, predicted_vs_actual.png, mlp_loss_curve.png")
    print("  + model_*.joblib pentru fiecare model")


def _record(name, y_true, y_pred, results):
    r2 = r2_score(y_true, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    mae = mean_absolute_error(y_true, y_pred)
    results.append({"Model": name, "R2": r2, "RMSE": rmse, "MAE": mae})
    print(f"{name:24s} | R2={r2:.4f} | RMSE={rmse:.4f} | MAE={mae:.4f}")


if __name__ == "__main__":
    main()