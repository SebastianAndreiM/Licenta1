import React, { useState } from 'react';
import type { AnomalyCell } from './RegionMap';

const MONTH_NAMES = [
    'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
    'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];
const YEARS = Array.from({ length: 11 }, (_, i) => 2015 + i); // 2015-2025

function anomalyColorInline(anomaly: number): string {
    const a = Math.max(-0.2, Math.min(0.2, anomaly));
    if (a < -0.05) {
        const intensity = Math.min(1, Math.abs(a) / 0.2);
        const g = Math.round(180 * (1 - intensity));
        return `rgb(200, ${g}, 40)`;
    } else if (a > 0.05) {
        const intensity = Math.min(1, a / 0.2);
        const r = Math.round(120 * (1 - intensity));
        return `rgb(${r}, 160, 60)`;
    }
    return 'rgb(220, 200, 80)';
}

interface AnomalyPanelProps {
    // an/luna alese local pentru anomalii
    year: number;
    month: number;
    onYearChange: (y: number) => void;
    onMonthChange: (m: number) => void;
    onCalculate: () => void;
    loading: boolean;
    cells: AnomalyCell[];
    selectedCell: { cell_lat: number; cell_lon: number } | null;
    onSelectCell: (cell: { cell_lat: number; cell_lon: number } | null) => void;
    hasBbox: boolean;
}

export const AnomalyPanel: React.FC<AnomalyPanelProps> = ({
                                                              year, month, onYearChange, onMonthChange,
                                                              onCalculate, loading, cells, selectedCell, onSelectCell, hasBbox,
                                                          }) => {
    const [sortBy, setSortBy] = useState<'anomaly' | 'position'>('anomaly');

    const sortedCells = [...cells].sort((a, b) => {
        if (sortBy === 'anomaly') return a.anomaly - b.anomaly; // cele mai negative primele
        return a.cell_lat - b.cell_lat || a.cell_lon - b.cell_lon;
    });

    const isSelected = (c: AnomalyCell) =>
        selectedCell != null &&
        Math.abs(c.cell_lat - selectedCell.cell_lat) < 0.001 &&
        Math.abs(c.cell_lon - selectedCell.cell_lon) < 0.001;

    return (
        <div className="flex flex-col gap-4">
            {/* Explicatie */}
            <p className="text-sm text-gray-700 dark:text-gray-300">
                Modelul AI prezice ce NDVI ar trebui sa aiba fiecare celula (~9km) pe baza climei.
                Diferenta fata de NDVI-ul real masurat evidentiaza zone anormale.
            </p>

            {/* Legenda */}
            <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                    <span style={{ width: 14, height: 14, background: 'rgb(200,60,40)', display: 'inline-block' }} />
                    Sub asteptari (posibila degradare)
                </span>
                <span className="flex items-center gap-1">
                    <span style={{ width: 14, height: 14, background: 'rgb(220,200,80)', display: 'inline-block' }} />
                    Aproape de asteptari
                </span>
                <span className="flex items-center gap-1">
                    <span style={{ width: 14, height: 14, background: 'rgb(60,160,60)', display: 'inline-block' }} />
                    Peste asteptari
                </span>
            </div>

            {/* Selector an + luna (local pentru anomalii) */}
            <div className="flex flex-wrap items-end gap-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">An</label>
                    <select
                        value={year}
                        onChange={(e) => onYearChange(Number(e.target.value))}
                        className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    >
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Luna</label>
                    <select
                        value={month}
                        onChange={(e) => onMonthChange(Number(e.target.value))}
                        className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    >
                        {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                </div>
                <button
                    onClick={onCalculate}
                    disabled={!hasBbox || loading}
                    className="px-4 py-2 bg-[var(--copernicus-green)] text-white text-sm disabled:opacity-50"
                >
                    {loading ? 'Se calculeaza...' : 'Calculeaza pe harta'}
                </button>
            </div>

            {/* Lista de celule */}
            {cells.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            {cells.length} celule · perioada: {MONTH_NAMES[month - 1]} {year}
                        </span>
                        <button
                            onClick={() => setSortBy(sortBy === 'anomaly' ? 'position' : 'anomaly')}
                            className="text-xs underline text-gray-500 hover:text-gray-700"
                        >
                            Sortare: {sortBy === 'anomaly' ? 'dupa anomalie' : 'dupa pozitie'}
                        </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                            <tr>
                                <th className="text-left px-2 py-1">Celula</th>
                                <th className="text-right px-2 py-1">NDVI real</th>
                                <th className="text-right px-2 py-1">Prezis</th>
                                <th className="text-right px-2 py-1">Anomalie</th>
                            </tr>
                            </thead>
                            <tbody>
                            {sortedCells.map((c) => {
                                const sel = isSelected(c);
                                return (
                                    <tr
                                        key={`${c.cell_lat}_${c.cell_lon}`}
                                        onClick={() => onSelectCell(
                                            sel ? null : { cell_lat: c.cell_lat, cell_lon: c.cell_lon }
                                        )}
                                        className={`cursor-pointer border-t border-gray-100 dark:border-gray-800 ${
                                            sel ? 'bg-blue-100 dark:bg-blue-900/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                        }`}
                                    >
                                        <td className="px-2 py-1 flex items-center gap-1">
                                                <span style={{
                                                    width: 10, height: 10, display: 'inline-block',
                                                    background: anomalyColorInline(c.anomaly),
                                                }} />
                                            {c.cell_lat.toFixed(2)}, {c.cell_lon.toFixed(2)}
                                        </td>
                                        <td className="text-right px-2 py-1">{c.real_ndvi.toFixed(3)}</td>
                                        <td className="text-right px-2 py-1">{c.predicted_ndvi.toFixed(3)}</td>
                                        <td className={`text-right px-2 py-1 font-medium ${
                                            c.anomaly < 0 ? 'text-red-600' : 'text-green-700'
                                        }`}>
                                            {c.anomaly >= 0 ? '+' : ''}{c.anomaly.toFixed(3)}
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                        Click pe o celula din lista pentru a o evidentia pe harta de sus.
                    </p>
                </div>
            )}
        </div>
    );
};