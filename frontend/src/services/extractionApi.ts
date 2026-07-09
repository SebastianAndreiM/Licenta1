import { apiRequest } from './apiClient';
import type { QueryParams } from '../types/dashboard.types';
import type { Bbox } from '../components/dashboard/RegionMap';

interface StartResponse {
    job_id: number;
    status: string;
    label?: string;
    message: string;
}

interface CancelResponse {
    found: boolean;
    job_id?: number;
    status?: string;
    message: string;
}

export interface JobStatus {
    found: boolean;
    job_id?: number;
    county?: string;
    label?: string;
    status?: string;
    stage?: string;
    progress?: number;
    message?: string;
    logs?: string;
}

export const extractionApi = {
    // Extragere pe judet (ramane pentru compatibilitate)
    async start(params: QueryParams): Promise<StartResponse> {
        const qs = new URLSearchParams({
            county: params.county,
            start_year: String(params.startYear),
            end_year: String(params.endYear),
            start_month: String(params.startMonth),
            end_month: String(params.endMonth),
        });
        return apiRequest<StartResponse>(`/extractions/start?${qs.toString()}`, {
            method: 'POST',
        });
    },

    // Extragere pe bbox (regiune desenata pe harta)
    async startBbox(bbox: Bbox, params: QueryParams): Promise<StartResponse> {
        const qs = new URLSearchParams({
            min_lon: String(bbox.minLon),
            min_lat: String(bbox.minLat),
            max_lon: String(bbox.maxLon),
            max_lat: String(bbox.maxLat),
            start_year: String(params.startYear),
            end_year: String(params.endYear),
            start_month: String(params.startMonth),
            end_month: String(params.endMonth),
        });
        return apiRequest<StartResponse>(`/extractions/start?${qs.toString()}`, {
            method: 'POST',
        });
    },

    async status(jobId: number): Promise<JobStatus> {
        return apiRequest<JobStatus>(`/extractions/status/${jobId}`, {
            method: 'GET',
        });
    },

    // NOU: joburile active ale userului curent (pentru recuperare la revenire)
    async myActive(): Promise<JobStatus[]> {
        return apiRequest<JobStatus[]>(`/extractions/my-active`, {
            method: 'GET',
        });
    },

    async cancel(jobId: number): Promise<CancelResponse> {
        return apiRequest<CancelResponse>(`/extractions/cancel/${jobId}`, {
            method: 'POST',
        });
    },
};