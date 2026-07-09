import React from 'react';
import type { SentinelScene } from '../../types/sentinel.types';
import type { Era5DataPoint } from '../../types/era5.types';
import type { TranslationKeys } from '../../ i18n';

interface MetricCardProps {
    label: string;
    value: string;
    unit?: string;
    hint?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, unit, hint }) => {
    return (
        <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                {label}
            </p>
            <p className="text-2xl font-bold text-[var(--copernicus-green)]">
                {value}
                {unit && (
                    <span className="text-sm font-normal ml-1 text-gray-500 dark:text-gray-400">
                        {unit}
                    </span>
                )}
            </p>
            {hint && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{hint}</p>
            )}
        </div>
    );
};

interface MetricsGridProps {
    scenes: SentinelScene[];
    era5Data: Era5DataPoint[];
    t: TranslationKeys;
}

const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

const fmt = (n: number, decimals = 2) =>
    isNaN(n) ? 'N/A' : n.toFixed(decimals);

/** Interpreteaza indicele de ariditate conform clasificarii UNEP. */
function aridityClass(value: number): string {
    if (value < 0.05) return 'hiperarid';
    if (value < 0.2) return 'arid';
    if (value < 0.5) return 'semiarid';
    if (value < 0.65) return 'sub-umed uscat';
    return 'umed';
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ scenes, era5Data, t }) => {
    const goodScenes = scenes.filter(s => s.isGood);

    const meanNdvi = avg(goodScenes.map(s => s.meanNdvi));
    const meanCloud = avg(scenes.map(s => s.cloudRatioValid * 100));
    const meanValid = avg(scenes.map(s => s.validRatio * 100));

    const meanTemp = avg(era5Data.map(e => e.t2mMeanC));
    const totalPrecip = avg(era5Data.map(e => e.precipTotalMm));
    const meanSoil = avg(era5Data.map(e => e.soilMoistureL1Mean));
    const meanAridity = avg(era5Data.map(e => e.aridityIndex));
    const meanWind = avg(era5Data.map(e => e.windSpeedMeanMs));

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
            <MetricCard label={t.metrics.ndvi} value={fmt(meanNdvi)} />
            <MetricCard label={t.metrics.cloudRatio} value={fmt(meanCloud, 1)} unit="%" />
            <MetricCard label={t.metrics.validRatio} value={fmt(meanValid, 1)} unit="%" />
            <MetricCard label={t.metrics.temperature} value={fmt(meanTemp, 1)} unit="°C" />
            <MetricCard label={t.metrics.precipitation} value={fmt(totalPrecip, 0)} unit="mm" hint="/30 zile" />
            <MetricCard label={t.metrics.soilMoisture} value={fmt(meanSoil, 3)} unit="m³/m³" />
            <MetricCard label={t.metrics.aridity} value={fmt(meanAridity, 3)} hint={aridityClass(meanAridity)} />
            <MetricCard label={t.metrics.wind} value={fmt(meanWind, 1)} unit="m/s" />
        </div>
    );
};