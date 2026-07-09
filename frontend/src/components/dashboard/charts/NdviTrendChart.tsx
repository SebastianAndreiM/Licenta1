import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import type { SentinelScene } from '../../../types/sentinel.types.ts';
import type { TranslationKeys } from '../../../ i18n';

interface NdviTrendChartProps {
    scenes: SentinelScene[];
    t: TranslationKeys;
}

interface YearlyPoint {
    year: number;
    avgNdvi: number;
    sceneCount: number;
}

function computeYearlyTrend(scenes: SentinelScene[]): YearlyPoint[] {
    const goodScenes = scenes.filter(s => s.isGood);

    // Grupam scenele pe an
    const byYear = new Map<number, number[]>();
    for (const scene of goodScenes) {
        const list = byYear.get(scene.year) ?? [];
        list.push(scene.meanNdvi);
        byYear.set(scene.year, list);
    }

    // Calculam media per an, sortat crescator
    const points: YearlyPoint[] = [];
    for (const [year, ndviValues] of byYear) {
        const sum = ndviValues.reduce((a, b) => a + b, 0);
        points.push({
            year,
            avgNdvi: sum / ndviValues.length,
            sceneCount: ndviValues.length,
        });
    }

    return points.sort((a, b) => a.year - b.year);
}

export const NdviTrendChart: React.FC<NdviTrendChartProps> = ({ scenes, t }) => {
    const data = computeYearlyTrend(scenes);

    // Daca avem date pe un singur an, graficul de trend nu are sens
    if (data.length < 2) {
        return (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                {t.charts.trendNeedsMoreYears}
            </p>
        );
    }

    return (
        <div className="w-full" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="year"
                        stroke="#9ca3af"
                        style={{ fontSize: 12 }}
                    />
                    <YAxis
                        domain={[0, 1]}
                        stroke="#9ca3af"
                        style={{ fontSize: 12 }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1f2937',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 12,
                            color: '#f9fafb',
                        }}
                        formatter={(value) => [Number(value).toFixed(3), 'NDVI mediu']}                        labelFormatter={(year) => `Anul ${year}`}
                    />
                    <Line
                        type="monotone"
                        dataKey="avgNdvi"
                        stroke="#16a34a"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#16a34a' }}
                        activeDot={{ r: 6 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};
export default NdviTrendChart