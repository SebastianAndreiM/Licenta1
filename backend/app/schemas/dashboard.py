from typing import Optional, List
from pydantic import BaseModel

class DashboardQueryRequest(BaseModel):
    county: str
    start_year:int
    end_year:int
    start_month:int
    end_month:int

class SceneResponse(BaseModel):
    scene_id: str
    county: str
    year:int
    acquisition_date: str
    acquisition_datetime: str

    mean_ndvi: Optional[float] = None
    min_ndvi: Optional[float] = None
    max_ndvi: Optional[float] = None
    mean_b11: Optional[float] = None
    mean_b12: Optional[float] = None

    cloud_ratio_valid: Optional[float] = None
    catalog_cloud_cover: Optional[float] = None
    valid_ratio: Optional[float] = None
    is_good: bool = False

    file_preview: Optional[str] = None

    class Config:
        from_attributes = True

class Era5Response(BaseModel):
    scene_id: str
    county: str
    year: int
    acquisition_date: str

    window_start: Optional[str] = None
    window_end: Optional[str] = None

    t2m_mean_c: Optional[float] = None
    t2m_max_c: Optional[float] = None
    t2m_min_c: Optional[float] = None
    skin_temp_mean_c: Optional[float] = None

    precip_total_mm: Optional[float] = None
    pet_total_mm: Optional[float] = None
    evap_bare_soil_mm: Optional[float] = None
    surface_runoff_mm: Optional[float] = None

    soil_moisture_l1_mean: Optional[float] = None
    soil_moisture_l1_min: Optional[float] = None
    soil_moisture_l2_mean: Optional[float] = None

    wind_speed_mean_ms: Optional[float] = None
    wind_speed_max_ms: Optional[float] = None

    lai_high_veg_mean: Optional[float] = None
    lai_low_veg_mean: Optional[float] = None

    aridity_index: Optional[float] = None
    class Config:
        from_attributes = True

class DashboardDataResponse(BaseModel):
    county:str
    start_year:int
    end_year:int
    start_month:int
    end_month:int
    scenes: List[SceneResponse]
    era5_data: List[Era5Response]

    scenes_count: int
    extracted_at: str

    data_exists: bool=True

class AnalysisResponse(BaseModel):
        county: str
        scenes_analyzed: int

        ndvi_mean: Optional[float] = None
        ndvi_trend_slope: Optional[float] = None
        trend_label: str
        trend_direction: str

        aridity_mean: Optional[float] = None
        aridity_class: str

        risk_level: str
        risk_explanation: str

class BboxQueryRequest(BaseModel):
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float
    start_year: int
    end_year: int
    start_month: int
    end_month: int

class CoverageRequest(BaseModel):
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float
    start_year: int
    end_year: int
    start_month: int
    end_month: int


class CellCoverage(BaseModel):
    cell_id: str
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float
    scene_count: int
    covered: bool


class CoverageResponse(BaseModel):
    total_cells: int
    covered_cells: int
    missing_cells: int
    cells: list[CellCoverage]