import React from 'react';
import {Select} from '../ui/Select';
import {COUNTIES,MONTHS} from "../../types/dashboard.types.ts";
import type {TranslationKeys} from "../../ i18n";

interface RegionSelectorProps {
    county: string;
    startYear: number;
    endYear: number;
    startMonth: number;
    endMonth: number;
    onChange: (key: string, value: string | number) => void;
    t: TranslationKeys;
}

const currentYear = new Date().getFullYear();

const years = Array.from({length: currentYear - 2014}, (_, i) => ({
    value: 2015 + i,
        label: String(2015 + i),
}
));
export const RegionSelector: React.FC<RegionSelectorProps> = ({
                                                                  county,
                                                                  startYear,
                                                                  endYear,
                                                                  startMonth,
                                                                  endMonth,
                                                                  onChange,
                                                                  t,
                                                              }) => {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Select
                label={t.dashboard.selectCounty}
                value={county}
                onChange={e => onChange('county', e.target.value)}
                placeholder="---"
                options={COUNTIES.map(c => ({ value: c, label: c }))}
            />
            <Select
                label={t.dashboard.startYear}
                value={startYear}
                onChange={e => onChange('startYear', Number(e.target.value))}
                options={years}
            />
            <Select
                label={t.dashboard.endYear}
                value={endYear}
                onChange={e => onChange('endYear', Number(e.target.value))}
                options={years}
            />
            <Select
                label={t.dashboard.startMonth}
                value={startMonth}
                onChange={e => onChange('startMonth', Number(e.target.value))}
                options={MONTHS.map(m => ({ value: m.value, label: m.label }))}
            />
            <Select
                label={t.dashboard.endMonth}
                value={endMonth}
                onChange={e => onChange('endMonth', Number(e.target.value))}
                options={MONTHS.map(m => ({ value: m.value, label: m.label }))}
            />
        </div>
    );
};