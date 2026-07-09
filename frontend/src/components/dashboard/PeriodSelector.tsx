import React from 'react';
import type { TranslationKeys } from '../../i18n';

interface PeriodSelectorProps {
    startYear: number;
    endYear: number;
    startMonth: number;
    endMonth: number;
    onChange: (field: string, value: number) => void;
    t: TranslationKeys;
}

const YEARS = Array.from({ length: 11 }, (_, i) => 2015 + i); // 2015-2025
const MONTHS = [
    'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
    'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
                                                                  startYear, endYear, startMonth, endMonth, onChange,
                                                              }) => {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">An inceput</label>
                <select
                    value={startYear}
                    onChange={(e) => onChange('startYear', Number(e.target.value))}
                    className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">An sfarsit</label>
                <select
                    value={endYear}
                    onChange={(e) => onChange('endYear', Number(e.target.value))}
                    className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Luna inceput</label>
                <select
                    value={startMonth}
                    onChange={(e) => onChange('startMonth', Number(e.target.value))}
                    className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                >
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Luna sfarsit</label>
                <select
                    value={endMonth}
                    onChange={(e) => onChange('endMonth', Number(e.target.value))}
                    className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                >
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
            </div>
        </div>
    );
};