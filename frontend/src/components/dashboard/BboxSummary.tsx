import React from 'react';
import type { Bbox } from './RegionMap';

interface BboxSummaryProps {
    bbox: Bbox | null;
    sceneCount: number | null;
    isChecking: boolean;
}

export const BboxSummary: React.FC<BboxSummaryProps> = ({ bbox, sceneCount, isChecking }) => {
    if (!bbox) {
        return (
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Nicio regiune selectata.
            </p>
        );
    }

    const fmt = (n: number) => n.toFixed(3);

    return (
        <div className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Longitudine min</p>
                    <p className="font-semibold">{fmt(bbox.minLon)}&deg;</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Longitudine max</p>
                    <p className="font-semibold">{fmt(bbox.maxLon)}&deg;</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Latitudine min</p>
                    <p className="font-semibold">{fmt(bbox.minLat)}&deg;</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Latitudine max</p>
                    <p className="font-semibold">{fmt(bbox.maxLat)}&deg;</p>
                </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">Scene disponibile in zona</p>
                <p className="font-semibold text-[var(--copernicus-green)]">
                    {isChecking ? 'Se verifica...' : sceneCount === null ? '\u2014' : sceneCount}
                </p>
            </div>
        </div>
    );
};