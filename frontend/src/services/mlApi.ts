import { apiRequest } from './apiClient';

export interface Prediction {
    sceneId: string;
    county: string;
    acquisitionDate: string;
    predictedNdvi: number;
    actualNdvi: number;
    error: number;
    featuresUsed: Record<string, number>;
}

interface BackendPrediction {
    scene_id: string;
    county: string;
    acquisition_date: string;
    predicted_ndvi: number;
    actual_ndvi: number;
    error: number;
    features_used: Record<string, number>;
}

export const mlApi = {
    async randomScene(): Promise<string> {
        const res = await apiRequest<{ scene_id: string }>('/ml/random-scene', { method: 'GET' });
        return res.scene_id;
    },

    async predictScene(sceneId: string): Promise<Prediction> {
        const res = await apiRequest<BackendPrediction>(
            `/ml/predict-scene/${encodeURIComponent(sceneId)}`,
            { method: 'GET' },
        );
        return {
            sceneId: res.scene_id,
            county: res.county,
            acquisitionDate: res.acquisition_date,
            predictedNdvi: res.predicted_ndvi,
            actualNdvi: res.actual_ndvi,
            error: res.error,
            featuresUsed: res.features_used,
        };
    },
};