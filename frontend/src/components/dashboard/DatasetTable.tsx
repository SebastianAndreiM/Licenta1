import React, { useState } from 'react';
import type { SentinelScene } from '../../types/sentinel.types';
import type { Era5DataPoint } from '../../types/era5.types';
import type { TranslationKeys } from '../../ i18n';

interface DatasetTableProps {
    scenes: SentinelScene[];
    era5Data: Era5DataPoint[];
    t: TranslationKeys;
}

type SortKey = 'date' | 'ndvi' | 'temp' | 'precip';
type SortDir = 'asc' | 'desc';

interface TableRow {
    sceneId: string;
    date: string;
    ndvi: number;
    cloud: number;
    valid: number;
    isGood: boolean;
    temp: number | null;
    precip: number | null;
    aridity: number | null;
}

function buildRows(
    scenes: SentinelScene[],
    era5Data: Era5DataPoint[],
): TableRow[] {
    return scenes.map(scene => {
        const era5 = era5Data.find(e => e.acquisitionDate === scene.acquisitionDate);
        return {
            sceneId: scene.sceneId,
            date: scene.acquisitionDate,
            ndvi: scene.meanNdvi,
            cloud: scene.cloudRatioValid,
            valid: scene.validRatio,
            isGood: scene.isGood,
            temp: era5?.t2mMeanC ?? null,
            precip: era5?.precipTotalMm ?? null,
            aridity: era5?.aridityIndex ?? null,
        };
    });
}

function sortRows(rows: TableRow[], key: SortKey, dir: SortDir): TableRow[] {
    const sorted = [...rows].sort((a, b) => {
        let cmp = 0;
        if (key === 'date') cmp = a.date.localeCompare(b.date);
        if (key === 'ndvi') cmp = a.ndvi - b.ndvi;
        if (key === 'temp') cmp = (a.temp ?? 0) - (b.temp ?? 0);
        if (key === 'precip') cmp = (a.precip ?? 0) - (b.precip ?? 0);
        return dir === 'asc' ? cmp : -cmp;
    });
    return sorted;
}

export const DatasetTable: React.FC<DatasetTableProps> = ({ scenes, era5Data, t }) => {
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const rows = sortRows(buildRows(scenes, era5Data), sortKey, sortDir);

    const handleSort = (key: SortKey) => {
        if (key === sortKey) {
            setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const sortIcon = (key: SortKey) => {
        if (key !== sortKey) return '';
        return sortDir === 'asc' ? ' ▲' : ' ▼';
    };

    const fmt = (n: number | null, decimals = 2) =>
        n === null ? '—' : n.toFixed(decimals);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                    <th
                        className="py-2 px-3 cursor-pointer hover:text-green-600 font-medium"
                        onClick={() => handleSort('date')}
                    >
                        {t.table.date}{sortIcon('date')}
                    </th>
                    <th
                        className="py-2 px-3 cursor-pointer hover:text-green-600 font-medium"
                        onClick={() => handleSort('ndvi')}
                    >
                        NDVI{sortIcon('ndvi')}
                    </th>
                    <th className="py-2 px-3 font-medium">{t.table.cloud}</th>
                    <th className="py-2 px-3 font-medium">{t.table.valid}</th>
                    <th
                        className="py-2 px-3 cursor-pointer hover:text-green-600 font-medium"
                        onClick={() => handleSort('temp')}
                    >
                        {t.table.temp}{sortIcon('temp')}
                    </th>
                    <th
                        className="py-2 px-3 cursor-pointer hover:text-green-600 font-medium"
                        onClick={() => handleSort('precip')}
                    >
                        {t.table.precip}{sortIcon('precip')}
                    </th>
                    <th className="py-2 px-3 font-medium">{t.table.aridity}</th>
                    <th className="py-2 px-3 font-medium">{t.table.status}</th>
                </tr>
                </thead>
                <tbody>
                {rows.map(row => (
                    <tr
                        key={row.sceneId}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                        <td className="py-2 px-3">{row.date}</td>
                        <td className="py-2 px-3 font-medium">{fmt(row.ndvi, 3)}</td>
                        <td className="py-2 px-3">{fmt(row.cloud * 100, 1)}%</td>
                        <td className="py-2 px-3">{fmt(row.valid * 100, 1)}%</td>
                        <td className="py-2 px-3">{fmt(row.temp, 1)}°C</td>
                        <td className="py-2 px-3">{fmt(row.precip, 0)} mm</td>
                        <td className="py-2 px-3">{fmt(row.aridity, 3)}</td>
                        <td className="py-2 px-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    row.isGood
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                    {row.isGood ? t.common.good : t.common.bad}
                                </span>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
};