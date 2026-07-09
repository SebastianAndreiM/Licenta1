export interface SentinelScene {
    sceneId: string;
    county: string;
    year: number;
    acquisitionDate: string;
    acquisitionDatetime: string;
    cloudRatioValid: number;
    cloudRatioCover: number;
    meanNdvi: number;
    minNdvi: number;
    maxNdvi: number;
    meanB11: number;
    meanB12: number;
    validRatio: number;
    validPixels: number;
    totalPixels: number;
    isGood: boolean;
    filePreview: string;
    fileTiff: string;
    errorFlag: string;
}