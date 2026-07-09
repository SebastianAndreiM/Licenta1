export interface Era5DataPoint{
    county: string;
     year: number;
     acquisitionDate: string;
     gridLat: number;
     gridLon: number;
     windowStart: string;
     windowEnd: string;
     t2mMeanC: number;
     t2mMaxC: number;
     t2mMinC: number;
     skinTempMeanC:number;
     precipTotalMm:number;
     petTotalMm?: number;
     evapBareSoilMm:number;
     soilMoistureL1Mean:number;
     soilMoistureL1Min:number;
     soilMoistureL2Mean:number;
     surfaceRunoffMm:number;
     windSpeedMeanMs:number;
     windSpeedMaxMs: number;
     laiHighVegMean:number;
     laiLowVegMean:number;
     aridityIndex: number;
     sentinelMeanNdvi: number;
     sentinelIsGood: boolean;
}