import {API_BASE_URL, apiRequest} from "./apiClient.ts";
import type {QueryParams} from '../types/dashboard.types';
import type {SentinelScene} from '../types/sentinel.types';
import type {Era5DataPoint} from '../types/era5.types';
import type {Bbox} from "../components/dashboard/RegionMap.tsx";

interface BackendScene{
    scene_id: string;
    county: string;
    year: number;
    acquisition_date: string;
    acquisition_datetime: string;
    mean_ndvi: number | null;
    min_ndvi: number | null;
    max_ndvi: number | null;
    mean_b11: number | null;
    mean_b12: number | null;
    cloud_ratio_valid: number | null;
    catalog_cloud_cover: number | null;
    valid_ratio: number | null;
    is_good: boolean;
    file_preview: string | null;
}

interface BackendEra5{
    scene_id: string;
    county: string;
    year: number;
    acquisition_date: string;
    window_start: string | null;
    window_end: string | null;
    t2m_mean_c: number | null;
    t2m_max_c: number | null;
    t2m_min_c: number | null;
    skin_temp_mean_c: number | null;
    precip_total_mm: number | null;
    pet_total_mm: number | null;
    evap_bare_soil_mm: number | null;
    soil_moisture_l1_mean: number | null;
    soil_moisture_l1_min: number | null;
    soil_moisture_l2_mean: number | null;
    wind_speed_mean_ms: number | null;
    wind_speed_max_ms: number | null;
    lai_high_veg_mean: number | null;
    lai_low_veg_mean: number | null;
    aridity_index: number | null;
    surface_runoff_mm: number | null;
}

interface BackendDashboardResponse {
    county: string;
    start_year: number;
    end_year: number;
    start_month: number;
    end_month: number;
    scenes: BackendScene[];
    era5_data: BackendEra5[];
    scenes_count: number;
    extracted_at: string;
    data_exists: boolean;
}

export interface DashboardResponse {
    county: string;
    startYear: number;
    endYear: number;
    startMonth: number;
    endMonth: number;
    scenes: SentinelScene[];
    era5Data: Era5DataPoint[];
    scenesCount: number;
    extractedAt: string;
    dataExists: boolean;
}

interface BackendAnalysis {
    county: string;
    scenes_analyzed: number;
    ndvi_mean: number | null;
    ndvi_trend_slope: number | null;
    trend_label: string;
    trend_direction: string;
    aridity_mean: number | null;
    aridity_class: string;
    risk_level: string;
    risk_explanation: string;
}

export interface AnalysisResult {
    county: string;
    scenesAnalyzed: number;
    ndviMean: number | null;
    ndviTrendSlope: number | null;
    trendLabel: string;
    trendDirection: string;
    aridityMean: number | null;
    aridityClass: string;
    riskLevel: string;
    riskExplanation: string;
}

export interface CoverageResult {
    totalCells: number;
    coveredCells: number;
    missingCells: number;
    coveragePercent: number;   // 0..100
}

export interface AnomalyCellData {
    cell_lat: number;
    cell_lon: number;
    real_ndvi: number;
    predicted_ndvi: number;
    anomaly: number;
}

export interface AnomalyResult {
    cells: AnomalyCellData[];
    summary: {
        n_cells: number;
        mean_anomaly?: number;
        min_anomaly?: number;
        max_anomaly?: number;
    };
}
export interface MissingPeriod {
    year: number;
    month: number;
}

export interface TemporalCoverageResult {
    totalPeriods: number;
    presentPeriods: number;
    missingPeriods: number;
    missing: MissingPeriod[];
    fullyCovered: boolean;
}
function numberOrZero(value: number | null |undefined ): number{
    return value ?? 0;
}

function buildImageUrl(sceneId: string, county: string): string {
    const params = new URLSearchParams({
        county: county,
        scene_id: sceneId,
        image_type: 'ndvi_preview',
    });
    return `${API_BASE_URL}/images/by-scene?${params.toString()}`;
}

function mapScene(scene: BackendScene): SentinelScene{
    return {
        sceneId: scene.scene_id,
        county: scene.county,
        year: scene.year,
        acquisitionDate: scene.acquisition_date,
        acquisitionDatetime: scene.acquisition_datetime,
        cloudRatioValid: numberOrZero(scene.cloud_ratio_valid),
        cloudRatioCover: numberOrZero(scene.catalog_cloud_cover),
        meanNdvi: numberOrZero(scene.mean_ndvi),
        minNdvi: numberOrZero(scene.min_ndvi),
        maxNdvi: numberOrZero(scene.max_ndvi),
        meanB11: numberOrZero(scene.mean_b11),
        meanB12: numberOrZero(scene.mean_b12),
        validRatio: numberOrZero(scene.valid_ratio),
        validPixels: 0,
        totalPixels: 0,
        isGood: scene.is_good,
        filePreview: buildImageUrl(scene.scene_id, scene.county),
        fileTiff: '',
        errorFlag: '',
    };
}
function mapEra5(row: BackendEra5): Era5DataPoint {
    return {
        county: row.county,
        year: row.year,
        acquisitionDate: row.acquisition_date,
        gridLat: 0,
        gridLon: 0,
        windowStart: row.window_start ?? '',
        windowEnd: row.window_end ?? '',
        t2mMeanC: numberOrZero(row.t2m_mean_c),
        t2mMaxC: numberOrZero(row.t2m_max_c),
        t2mMinC: numberOrZero(row.t2m_min_c),
        skinTempMeanC: numberOrZero(row.skin_temp_mean_c),
        precipTotalMm: numberOrZero(row.precip_total_mm),
        petTotalMm: numberOrZero(row.pet_total_mm),
        evapBareSoilMm: numberOrZero(row.evap_bare_soil_mm),
        surfaceRunoffMm: numberOrZero(row.surface_runoff_mm),
        soilMoistureL1Mean: numberOrZero(row.soil_moisture_l1_mean),
        soilMoistureL1Min: numberOrZero(row.soil_moisture_l1_min),
        soilMoistureL2Mean: numberOrZero(row.soil_moisture_l2_mean),
        windSpeedMeanMs: numberOrZero(row.wind_speed_mean_ms),
        windSpeedMaxMs: numberOrZero(row.wind_speed_max_ms),
        laiHighVegMean: numberOrZero(row.lai_high_veg_mean),
        laiLowVegMean: numberOrZero(row.lai_low_veg_mean),
        aridityIndex: numberOrZero(row.aridity_index),
        sentinelMeanNdvi: 0,
        sentinelIsGood: false,
    };
}

export const dashboardApi = {
    async query(params: QueryParams): Promise<DashboardResponse> {
        const response = await apiRequest<BackendDashboardResponse>('/dashboard/query', {
            method: 'POST',
            body: JSON.stringify({
                county: params.county,
                start_year: params.startYear,
                end_year: params.endYear,
                start_month: params.startMonth,
                end_month: params.endMonth,
            }),
        });

        return {
            county: response.county,
            startYear: response.start_year,
            endYear: response.end_year,
            startMonth: response.start_month,
            endMonth: response.end_month,
            scenes: response.scenes.map(mapScene),
            era5Data: response.era5_data.map(mapEra5),
            scenesCount: response.scenes_count,
            extractedAt: response.extracted_at,
            dataExists: response.data_exists,
        };
    },
    async analysis(params: QueryParams): Promise<AnalysisResult> {
        const response = await apiRequest<BackendAnalysis>('/dashboard/analysis', {
            method: 'POST',
            body: JSON.stringify({
                county: params.county,
                start_year: params.startYear,
                end_year: params.endYear,
                start_month: params.startMonth,
                end_month: params.endMonth,
            }),
        });

        return {
            county: response.county,
            scenesAnalyzed: response.scenes_analyzed,
            ndviMean: response.ndvi_mean,
            ndviTrendSlope: response.ndvi_trend_slope,
            trendLabel: response.trend_label,
            trendDirection: response.trend_direction,
            aridityMean: response.aridity_mean,
            aridityClass: response.aridity_class,
            riskLevel: response.risk_level,
            riskExplanation: response.risk_explanation,
        };
    },

    async temporalCoverage(bbox: Bbox, params: QueryParams): Promise<TemporalCoverageResult> {
        const res = await apiRequest<{
            total_periods: number;
            present_periods: number;
            missing_periods: number;
            missing: { year: number; month: number; scene_count: number }[];
            fully_covered: boolean;
        }>(`/dashboard/temporal-coverage`, {
            method: 'POST',
            body: JSON.stringify({
                min_lon: bbox.minLon,
                min_lat: bbox.minLat,
                max_lon: bbox.maxLon,
                max_lat: bbox.maxLat,
                start_year: params.startYear,
                end_year: params.endYear,
                start_month: params.startMonth,
                end_month: params.endMonth,
            }),
        });
        return {
            totalPeriods: res.total_periods,
            presentPeriods: res.present_periods,
            missingPeriods: res.missing_periods,
            missing: res.missing.map(m => ({ year: m.year, month: m.month })),
            fullyCovered: res.fully_covered,
        };
    },
    async anomalyBbox(bbox: Bbox, params: QueryParams): Promise<AnomalyResult> {
        const res = await apiRequest<AnomalyResult>(`/dashboard/anomaly-bbox`, {
            method: 'POST',
            body: JSON.stringify({
                min_lon: bbox.minLon,
                min_lat: bbox.minLat,
                max_lon: bbox.maxLon,
                max_lat: bbox.maxLat,
                start_year: params.startYear,
                end_year: params.endYear,
                start_month: params.startMonth,
                end_month: params.endMonth,
            }),
        });
        return res;
    },
    async coverage(bbox: Bbox, params: QueryParams): Promise<CoverageResult> {
        const body = {
            min_lon: bbox.minLon,
            min_lat: bbox.minLat,
            max_lon: bbox.maxLon,
            max_lat: bbox.maxLat,
            start_year: params.startYear,
            end_year: params.endYear,
            start_month: params.startMonth,
            end_month: params.endMonth,
        };
        const res = await apiRequest<{
            total_cells: number;
            covered_cells: number;
            missing_cells: number;
        }>(`/dashboard/coverage`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        const total = res.total_cells || 1;
        return {
            totalCells: res.total_cells,
            coveredCells: res.covered_cells,
            missingCells: res.missing_cells,
            coveragePercent: (res.covered_cells / total) * 100,
        };
    },
    async queryBbox(
        bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number },
        params: { startYear: number; endYear: number; startMonth: number; endMonth: number },
    ): Promise<DashboardResponse> {
        const response = await apiRequest<BackendDashboardResponse>('/dashboard/query-bbox', {
            method: 'POST',
            body: JSON.stringify({
                min_lon: bbox.minLon,
                min_lat: bbox.minLat,
                max_lon: bbox.maxLon,
                max_lat: bbox.maxLat,
                start_year: params.startYear,
                end_year: params.endYear,
                start_month: params.startMonth,
                end_month: params.endMonth,
            }),
        });

        return {
            county: response.county,
            startYear: response.start_year,
            endYear: response.end_year,
            startMonth: response.start_month,
            endMonth: response.end_month,
            scenes: response.scenes.map(mapScene),
            era5Data: response.era5_data.map(mapEra5),
            scenesCount: response.scenes_count,
            extractedAt: response.extracted_at,
            dataExists: response.data_exists,
        };
    },
};