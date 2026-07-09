from __future__ import annotations
from statistics import mean


def safe_mean(values: list[float]) -> float | None:
    clean = [v for v in values if v is not None]
    return mean(clean) if clean else None


def yearly_ndvi_slope(scenes: list) -> float | None:
    good = [s for s in scenes if s.is_good and s.mean_ndvi is not None]
    if len(good) < 2:
        return None

    by_year: dict[int, list[float]] = {}
    for s in good:
        by_year.setdefault(s.year, []).append(s.mean_ndvi)

    years = sorted(by_year.keys())
    if len(years) < 2:
        return None

    points = [(y, mean(by_year[y])) for y in years]

    n = len(points)
    mean_x = mean([p[0] for p in points])
    mean_y = mean([p[1] for p in points])

    num = sum((x - mean_x) * (y - mean_y) for x, y in points)
    den = sum((x - mean_x) ** 2 for x, _ in points)

    return num / den if den != 0 else None


def classify_trend(slope: float | None) -> tuple[str, str]:
    if slope is None:
        return "insuficiente date", "necunoscut"
    if slope < -0.005:
        return "degradare", "descendent"
    if slope > 0.005:
        return "recuperare", "ascendent"
    return "stabil", "constant"


def classify_aridity(value: float | None) -> str:
    if value is None:
        return "necunoscut"
    if value < 0.05:
        return "hiperarid"
    if value < 0.2:
        return "arid"
    if value < 0.5:
        return "semiarid"
    if value < 0.65:
        return "sub-umed uscat"
    return "umed"


def assess_risk(
    ndvi_mean: float | None,
    aridity_mean: float | None,
    slope: float | None,
) -> tuple[str, str]:
    score = 0

    if ndvi_mean is not None:
        if ndvi_mean < 0.3:
            score += 2
        elif ndvi_mean < 0.45:
            score += 1

    if aridity_mean is not None:
        if aridity_mean < 0.2:
            score += 2
        elif aridity_mean < 0.5:
            score += 1

    if slope is not None and slope < -0.005:
        score += 2

    if score >= 4:
        return "ridicat", "Vegetatie redusa, conditii aride si trend descendent."
    if score >= 2:
        return "moderat", "Indicatori partiali de stres al vegetatiei."
    return "scazut", "Vegetatie sanatoasa, fara semne clare de degradare."


def build_analysis(scenes: list, era5_rows: list) -> dict:
    good = [s for s in scenes if s.is_good]

    ndvi_mean = safe_mean([s.mean_ndvi for s in good])
    aridity_mean = safe_mean([e.aridity_index for e in era5_rows])
    slope = yearly_ndvi_slope(scenes)

    trend_label, trend_direction = classify_trend(slope)
    aridity_cls = classify_aridity(aridity_mean)
    risk_level, risk_explanation = assess_risk(ndvi_mean, aridity_mean, slope)

    return {
        "scenes_analyzed": len(good),
        "ndvi_mean": ndvi_mean,
        "ndvi_trend_slope": slope,
        "trend_label": trend_label,
        "trend_direction": trend_direction,
        "aridity_mean": aridity_mean,
        "aridity_class": aridity_cls,
        "risk_level": risk_level,
        "risk_explanation": risk_explanation,
    }