from datetime import datetime, timezone
from typing import Optional

from pydantic_core.core_schema import nullable_schema
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, LargeBinary, UniqueConstraint


class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(default=None, unique=True, index=True)
    institution: str
    hashed_password: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)


class ExtractedPeriod(SQLModel, table=True):
    __tablename__ = "extracted_periods"
    id: Optional[int] = Field(default=None, primary_key=True)
    county: str = Field(index=True)
    start_year: int
    end_year: int
    start_month: int
    end_month: int
    scenes_count: int = Field(default=0)
    era5_csv_path: Optional[str] = Field(default=None)
    extracted_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False
    )


class SatelliteScene(SQLModel, table=True):
    __tablename__ = "satellite_scenes"

    id: Optional[int] = Field(default=None, primary_key=True)

    period_id: Optional[int] = Field(default=None, foreign_key="extracted_periods.id", index=True)

    scene_id: str = Field(index=True)
    county: str = Field(index=True)
    min_lon: Optional[float] = Field(default=None)
    min_lat: Optional[float] = Field(default=None)
    max_lon: Optional[float] = Field(default=None)
    max_lat: Optional[float] = Field(default=None)
    year: int = Field(index=True)
    acquisition_date: str
    acquisition_datetime: str

    mean_ndvi: Optional[float] = Field(default=None)
    min_ndvi: Optional[float] = Field(default=None)
    max_ndvi: Optional[float] = Field(default=None)

    mean_b11: Optional[float] = Field(default=None)
    mean_b12: Optional[float] = Field(default=None)

    cloud_ratio_valid: Optional[float] = Field(default=None)
    catalog_cloud_cover: Optional[float] = Field(default=None)
    valid_ratio: Optional[float] = Field(default=None)
    valid_pixels: Optional[int] = Field(default=None)
    total_pixels: Optional[int] = Field(default=None)
    is_good: bool = Field(default=False)

    file_tiff: Optional[str] = Field(default=None)
    file_preview: Optional[str] = Field(default=None)

    error_flag: Optional[str] = Field(default=None)

class Era5Data(SQLModel, table=True):
    __tablename__ = "era5_data"
    id: Optional[int] = Field(default=None, primary_key=True)
    scene_id: str = Field(index=True)
    county: str = Field(index=True)
    min_lon: Optional[float] = Field(default=None)
    min_lat: Optional[float] = Field(default=None)
    max_lon: Optional[float] = Field(default=None)
    max_lat: Optional[float] = Field(default=None)
    year: int = Field(index=True)
    acquisition_date: str

    window_start: Optional[str] = Field(default=None)
    window_end: Optional[str] = Field(default=None)

    t2m_mean_c: Optional[float] = Field(default=None)
    t2m_max_c: Optional[float] = Field(default=None)
    t2m_min_c: Optional[float] = Field(default=None)
    skin_temp_mean_c: Optional[float] = Field(default=None)

    precip_total_mm: Optional[float] = Field(default=None)
    pet_total_mm: Optional[float] = Field(default=None)
    evap_bare_soil_mm: Optional[float] = Field(default=None)
    surface_runoff_mm: Optional[float] = Field(default=None)

    soil_moisture_l1_mean: Optional[float] = Field(default=None)
    soil_moisture_l1_min: Optional[float] = Field(default=None)
    soil_moisture_l2_mean: Optional[float] = Field(default=None)

    wind_speed_mean_ms: Optional[float] = Field(default=None)
    wind_speed_max_ms: Optional[float] = Field(default=None)

    lai_high_veg_mean: Optional[float] = Field(default=None)
    lai_low_veg_mean: Optional[float] = Field(default=None)

    aridity_index: Optional[float] = Field(default=None)


class ProcessLog(SQLModel, table=True):
    __tablename__ = "process_logs"
    id: Optional[int] = Field(default=None, primary_key=True)
    county: str
    start_year: int
    end_year: int
    start_month: int
    end_month: int

    min_lon: Optional[float] = Field(default=None)
    min_lat: Optional[float] = Field(default=None)
    max_lon: Optional[float] = Field(default=None)
    max_lat: Optional[float] = Field(default=None)
    label: Optional[str] = Field(default=None)


    user_id: Optional[int] = Field(default=None, index=True)

    status: str = Field(default="pending", index=True)
    stage: str = Field(default="queued")
    progress: int = Field(default=0)
    message: Optional[str] = Field(default=None)
    logs: str = Field(default="")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    started_at: Optional[datetime] = Field(default=None)
    completed_at: Optional[datetime] = Field(default=None)
class SatelliteImage(SQLModel, table=True):
    __tablename__ = "satellite_images"

    __table_args__ = (
        UniqueConstraint(
            "scene_id",
            "county",
            "image_type",
            name="uq_satellite_images_scene_county_type",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)

    scene_id: str = Field(index=True)
    county: str = Field(index=True)
    year: int = Field(index=True)

    image_type: str = Field(index=True)
    filename: str
    mime_type: str = Field(default="image/png")
    size_bytes: int

    content: bytes = Field(sa_column=Column(LargeBinary, nullable=False))

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SceneCell(SQLModel, table=True):
    __tablename__ = "scene_cells"
    id: Optional[int] = Field(default=None, primary_key=True)

    county: str = Field(index=True)
    year: int = Field(index=True)
    acquisition_date: str = Field(index=True)

    # pozitia celulei (centrul celulei ERA5)
    cell_lat: float
    cell_lon: float

    # NDVI din pixelii Sentinel din celula
    mean_ndvi: float
    n_valid_pixels: int

    # clima ERA5 nativa a celulei (identic cu Era5Data)
    t2m_mean_c: Optional[float] = Field(default=None)
    t2m_max_c: Optional[float] = Field(default=None)
    t2m_min_c: Optional[float] = Field(default=None)
    skin_temp_mean_c: Optional[float] = Field(default=None)
    precip_total_mm: Optional[float] = Field(default=None)
    pet_total_mm: Optional[float] = Field(default=None)
    evap_bare_soil_mm: Optional[float] = Field(default=None)
    surface_runoff_mm: Optional[float] = Field(default=None)
    soil_moisture_l1_mean: Optional[float] = Field(default=None)
    soil_moisture_l1_min: Optional[float] = Field(default=None)
    soil_moisture_l2_mean: Optional[float] = Field(default=None)
    wind_speed_mean_ms: Optional[float] = Field(default=None)
    wind_speed_max_ms: Optional[float] = Field(default=None)
    lai_high_veg_mean: Optional[float] = Field(default=None)
    lai_low_veg_mean: Optional[float] = Field(default=None)
    aridity_index: Optional[float] = Field(default=None)

    source_tiff: Optional[str] = Field(default=None)