import type {SentinelScene} from "./sentinel.types.ts";
import type {Era5DataPoint} from "./era5.types.ts";

export interface QueryParams{
    county: string;
    startYear: number;
    endYear: number;
    startMonth:number;
    endMonth:number;
}

export interface DashboardData {
    scenes: SentinelScene[];
    era5Data: Era5DataPoint[];
    period: QueryParams;
    extractedAt: string;
}

export interface ExtractionStatus{
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    message: string;
    logs: string[];
    startedAt: string;
    completedAt?: string;
}

export const COUNTIES =[
    'Dolj',
    'Olt',
    'Teleorman',
    'Giurgiu',
    'Calarasi',
    'Mehedinti',
] as const;

export type County = typeof COUNTIES[number];

export const MONTHS = [
    {value: 1, label: 'January / Ianuarie'},
    {value: 2, label: 'February / Februarie'},
    {value: 3, label: 'March / Martie'},
    {value: 4, label: 'April / Aprilie'},
    {value: 5, label: 'May / Mai'},
    {value: 6, label: 'June / Iunie'},
    {value: 7, label: 'July / Iulie'},
    {value: 8, label: 'August / August'},
    {value: 9, label: 'September / Septembrie'},
    {value: 10, label: 'October / Octombrie'},
    {value: 11, label: 'November / Noiembrie'},
    {value: 12, label: 'December / Decembrie'},
] as const;