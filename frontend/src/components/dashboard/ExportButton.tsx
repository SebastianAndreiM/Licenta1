import React from 'react';
import { Button } from '../ui/Button';
import type {SentinelScene} from '../../types/sentinel.types';
import type {Era5DataPoint} from '../../types/era5.types';
import type {TranslationKeys} from '../../ i18n';

interface ExportButtonProps {
    scenes: SentinelScene[];
    era5Data: Era5DataPoint[];
    t: TranslationKeys;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ scenes, era5Data, t }) => {
    const handleExport = () => {
        if (scenes.length === 0) return;

        const headers = [
            'acquisition_date', 'county', 'year', 'mean_ndvi',
            'min_ndvi', 'max_ndvi', 'cloud_ratio', 'valid_ratio',
            'is_good', 't2m_mean_c', 'precip_total_mm',
            'soil_moisture_l1', 'aridity_index',
        ];

        const rows = scenes.map(scene => {
            const era5 = era5Data.find(e => e.acquisitionDate === scene.acquisitionDate);
            return [
                scene.acquisitionDate,
                scene.county,
                scene.year,
                scene.meanNdvi?.toFixed(4),
                scene.minNdvi?.toFixed(4),
                scene.maxNdvi?.toFixed(4),
                scene.cloudRatioValid?.toFixed(4),
                scene.validRatio?.toFixed(4),
                scene.isGood ? '1' : '0',
                era5?.t2mMeanC?.toFixed(2) ?? '',
                era5?.precipTotalMm?.toFixed(2) ?? '',
                era5?.soilMoistureL1Mean?.toFixed(4) ?? '',
                era5?.aridityIndex?.toFixed(4) ?? '',
            ].join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `desertification_export_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            disabled={scenes.length === 0}
        >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {t.dashboard.export}
        </Button>
    );
};