import React from 'react';
import type { AnalysisResult } from '../../services/dashboardApi';
import type { TranslationKeys } from '../../ i18n';

interface RiskSummaryProps {
    analysis: AnalysisResult;
    t: TranslationKeys;
}

function riskColor(level: string): string {
    if (level === 'ridicat') return 'var(--metric-danger)';
    if (level === 'moderat') return 'var(--metric-warning)';
    return 'var(--copernicus-green)';
}

export const RiskSummary: React.FC<RiskSummaryProps> = ({ analysis, t }) => {
    const fmt = (n: number | null, d = 3) =>
        n === null ? 'N/A' : n.toFixed(d);

    return (
        <div className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t.analysis.riskLevel}
                </span>
                <span
                    className="text-sm font-bold uppercase px-3 py-1 text-white"
                    style={{ backgroundColor: riskColor(analysis.riskLevel) }}
                >
                    {analysis.riskLevel}
                </span>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300">
                {analysis.riskExplanation}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t.analysis.trend}</p>
                    <p className="text-sm font-semibold">{analysis.trendLabel}</p>
                    <p className="text-xs text-gray-400">
                        {analysis.ndviTrendSlope === null
                            ? 'N/A'
                            : `${analysis.ndviTrendSlope >= 0 ? '+' : ''}${analysis.ndviTrendSlope.toExponential(2)} /an`}
                    </p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t.metrics.ndvi}</p>
                    <p className="text-sm font-semibold">{fmt(analysis.ndviMean)}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t.metrics.aridity}</p>
                    <p className="text-sm font-semibold">{fmt(analysis.aridityMean)}</p>
                    <p className="text-xs text-gray-400">{analysis.aridityClass}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t.common.scenes}</p>
                    <p className="text-sm font-semibold">{analysis.scenesAnalyzed}</p>
                </div>
            </div>
        </div>
    );
};