import React, { useState } from 'react';
import {
    ComposedChart,
    Scatter,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import type { SentinelScene } from '../../../types/sentinel.types';
import type { Era5DataPoint } from '../../../types/era5.types';
import type { TranslationKeys } from '../../../ i18n';

interface Era5CorrelationChartProps {
    scenes: SentinelScene[];
    era5Data: Era5DataPoint[];
    t: TranslationKeys;
}

type Variable = 'precipTotalMm' | 't2mMeanC' | 'soilMoistureL1Mean' | 'aridityIndex';

interface VariableConfig {
    key: Variable;
    label: string;
    unit: string;
    color: string;
}

const VARIABLES: VariableConfig[] = [
    { key: 'precipTotalMm', label: 'Precipitatii', unit: 'mm', color: '#25408F' },
    { key: 't2mMeanC', label: 'Temperatura', unit: '°C', color: '#dc2626' },
    { key: 'soilMoistureL1Mean', label: 'Umiditate sol', unit: '', color: '#0891b2' },
    { key: 'aridityIndex', label: 'Ariditate', unit: '', color: '#d97706' },
];

interface TimePoint {
    t: number;
    year: number;
    ndvi: number;
    climate: number | null;
}

function buildTimePoints(
    scenes: SentinelScene[],
    era5Data: Era5DataPoint[],
    variable: Variable,
): TimePoint[] {
    const points: TimePoint[] = [];
    for (const scene of scenes) {
        if (!scene.isGood) continue;
        const era5 = era5Data.find(e => e.acquisitionDate === scene.acquisitionDate);
        const climateVal = era5 ? era5[variable] : null;
        const date = new Date(scene.acquisitionDate);
        points.push({
            t: date.getTime(),
            year: date.getFullYear(),
            ndvi: scene.meanNdvi,
            climate: climateVal ?? null,
        });
    }
    points.sort((a, b) => a.t - b.t);
    return points;
}

function pearsonCorrelation(pairs: { x: number; y: number }[]): number {
    const n = pairs.length;
    if (n < 3) return 0;
    const meanX = pairs.reduce((s, p) => s + p.x, 0) / n;
    const meanY = pairs.reduce((s, p) => s + p.y, 0) / n;
    let num = 0, denX = 0, denY = 0;
    for (const p of pairs) {
        const dx = p.x - meanX, dy = p.y - meanY;
        num += dx * dy; denX += dx * dx; denY += dy * dy;
    }
    const den = Math.sqrt(denX * denY);
    return den === 0 ? 0 : num / den;
}

function regression(points: { t: number; v: number }[]): { slope: number; intercept: number } {
    const n = points.length;
    if (n < 2) return { slope: 0, intercept: 0 };
    const meanT = points.reduce((s, p) => s + p.t, 0) / n;
    const meanV = points.reduce((s, p) => s + p.v, 0) / n;
    let num = 0, den = 0;
    for (const p of points) {
        const dt = p.t - meanT;
        num += dt * (p.v - meanV);
        den += dt * dt;
    }
    const slope = den === 0 ? 0 : num / den;
    return { slope, intercept: meanV - slope * meanT };
}

const fmtDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

interface SingleProps {
    points: { t: number; v: number }[];
    color: string;
    yLabel: string;
    yDomain?: [number, number];
    pointName: string;
}

const TimeChart: React.FC<SingleProps> = ({ points, color, yLabel, yDomain, pointName }) => {
    if (points.length < 2) {
        return <p className="text-xs text-gray-400 py-4 text-center">Prea putine date.</p>;
    }
    const reg = regression(points);
    const tMin = points[0].t;
    const tMax = points[points.length - 1].t;

    const data: Array<{ t: number; v: number | null; trend: number | null }> = points.map(p => ({
        t: p.t, v: p.v, trend: null,
    }));
    data.push(
        { t: tMin, v: null, trend: reg.slope * tMin + reg.intercept },
        { t: tMax, v: null, trend: reg.slope * tMax + reg.intercept },
    );
    data.sort((a, b) => a.t - b.t);

    return (
        <div className="w-full" style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 35, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        type="number"
                        dataKey="t"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={fmtDate}
                        stroke="#9ca3af"
                        style={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={50}
                    />
                    <YAxis
                        domain={yDomain ?? ['auto', 'auto']}
                        stroke={color}
                        style={{ fontSize: 12 }}
                        label={{ value: yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: color } }}
                    />
                    <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', fontSize: 12, color: '#f9fafb' }}
                        labelFormatter={(ts) => fmtDate(Number(ts))}
                        formatter={(value, name) => {
                            if (value === null || value === undefined) return ['', ''];
                            if (name === 'v') return [Number(value).toFixed(3), pointName];
                            return ['', ''];
                        }}
                    />
                    <Scatter dataKey="v" name={pointName} fill={color} fillOpacity={0.55} />
                    <Line dataKey="trend" stroke={color} strokeWidth={2} dot={false} connectNulls legendType="none" />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

export const Era5CorrelationChart: React.FC<Era5CorrelationChartProps> = ({
                                                                              scenes,
                                                                              era5Data,
                                                                              t,
                                                                          }) => {
    const [variable, setVariable] = useState<Variable>('precipTotalMm');
    const [selectedYear, setSelectedYear] = useState<number | null>(null); // null = toti anii
    const cfg = VARIABLES.find(v => v.key === variable)!;
    const allPoints = buildTimePoints(scenes, era5Data, variable);

    if (allPoints.length < 3) {
        return (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                {t.charts.correlationNeedsMore}
            </p>
        );
    }

    // Anii disponibili in date (pentru butoane)
    const years = Array.from(new Set(allPoints.map(p => p.year))).sort((a, b) => a - b);

    // Filtram pe anul selectat (sau toti)
    const points = selectedYear === null
        ? allPoints
        : allPoints.filter(p => p.year === selectedYear);

    const ndviPoints = points.map(p => ({ t: p.t, v: p.ndvi }));
    const climPoints = points.filter(p => p.climate !== null).map(p => ({ t: p.t, v: p.climate as number }));

    const pairs = points
        .filter(p => p.climate !== null)
        .map(p => ({ x: p.climate as number, y: p.ndvi }));
    const r = pearsonCorrelation(pairs);

    const strength =
        Math.abs(r) > 0.7 ? t.charts.corrStrong
            : Math.abs(r) > 0.4 ? t.charts.corrModerate
                : Math.abs(r) > 0.2 ? t.charts.corrWeak
                    : t.charts.corrNone;

    return (
        <div className="flex flex-col gap-4">
            {/* Selector variabila */}
            <div className="flex flex-wrap gap-2">
                {VARIABLES.map(v => (
                    <button
                        key={v.key}
                        onClick={() => setVariable(v.key)}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                            variable === v.key
                                ? 'bg-[var(--copernicus-green)] text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        {v.label}
                    </button>
                ))}
            </div>

            {/* Selector an */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-500 dark:text-gray-400">An:</span>
                <button
                    onClick={() => setSelectedYear(null)}
                    className={`px-2.5 py-1 transition-colors ${
                        selectedYear === null
                            ? 'bg-[var(--copernicus-blue)] text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                >
                    Toti anii
                </button>
                {years.map(y => (
                    <button
                        key={y}
                        onClick={() => setSelectedYear(y)}
                        className={`px-2.5 py-1 transition-colors ${
                            selectedYear === y
                                ? 'bg-[var(--copernicus-blue)] text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        {y}
                    </button>
                ))}
            </div>

            {/* Pearson informativ */}
            <div className="flex items-baseline gap-3 text-sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {selectedYear === null
                        ? 'Evolutia in timp pe toata perioada. Alege un an pentru a vedea dinamica sezoniera.'
                        : `Evolutia in ${selectedYear}, pe lunile disponibile.`}
                </p>
                <span className="text-gray-500 dark:text-gray-400">{t.charts.pearson}:</span>
                <span className={`font-bold text-base ${
                    Math.abs(r) > 0.5 ? 'text-[var(--copernicus-green)]'
                        : Math.abs(r) > 0.3 ? 'text-orange-500'
                            : 'text-gray-500'
                }`}>
                    r = {r.toFixed(3)}
                </span>
                <span className="text-xs text-gray-400">
                    ({pairs.length} {t.common.scenes})
                </span>
            </div>

            {/* Grafic 1: NDVI in timp */}
            <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Evolutia NDVI in timp
                </h3>
                <TimeChart points={ndviPoints} color="#16a34a" yLabel="NDVI" yDomain={[0, 1]} pointName="NDVI" />
            </div>

            {/* Grafic 2: variabila climatica in timp */}
            <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Evolutia {cfg.label.toLowerCase()} in timp{cfg.unit ? ` (${cfg.unit})` : ''}
                </h3>
                <TimeChart points={climPoints} color={cfg.color} yLabel={cfg.label} pointName={cfg.label} />
            </div>

            <div className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-sm">
                <p className="text-gray-700 dark:text-gray-300">
                    {t.charts.interpretation}: corelatie clima-NDVI <strong>{strength}</strong> (r = {r.toFixed(3)}).
                </p>
            </div>
        </div>
    );
};