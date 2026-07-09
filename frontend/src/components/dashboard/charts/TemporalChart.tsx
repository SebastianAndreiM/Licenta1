import React, { useState } from 'react';
import {
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import type { SentinelScene } from '../../../types/sentinel.types';
import type { Era5DataPoint } from '../../../types/era5.types';
import type { TranslationKeys } from '../../../ i18n';

interface TemporalChartProps {
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
    { key: 't2mMeanC', label: 'Temperatura', unit: '°C', color: '#d97706' },
    { key: 'soilMoistureL1Mean', label: 'Umiditate sol', unit: 'm³/m³', color: '#0891b2' },
    { key: 'aridityIndex', label: 'Ariditate', unit: '', color: '#941333' },
];

interface TimePoint {
    date: string;
ndvi: number;
climate: number | null;
}

function buildTimeSeries(
    scenes: SentinelScene[],
era5Data: Era5DataPoint[],
variable: Variable,
): TimePoint[] {
    const points: TimePoint[] = [];
for (const scene of scenes) {
if (!scene.isGood) continue;
const era5 = era5Data.find(e => e.acquisitionDate === scene.acquisitionDate);
const climateVal = era5 ? era5[variable] : null;
points.push({
    date: scene.acquisitionDate,
    ndvi: scene.meanNdvi,
    climate: climateVal ?? null,
});
}
// sortam cronologic
points.sort((a, b) => a.date.localeCompare(b.date));
return points;
}

export const TemporalChart: React.FC<TemporalChartProps> = ({ scenes, era5Data, t }) => {
const [variable, setVariable] = useState<Variable>('precipTotalMm');
const currentConfig = VARIABLES.find(v => v.key === variable)!;
const data = buildTimeSeries(scenes, era5Data, variable);

if (data.length < 3) {
return (
    <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
    {t.charts.correlationNeedsMore}
    </p>
);
}

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

  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
               Evolutia in timp a vegetatiei (NDVI, verde, axa stanga) si a variabilei climatice
({currentConfig.label}, axa dreapta). Vezi cum cele doua progreseaza impreuna.
                                                                     </p>

                                                                       {/* Grafic temporal cu doua axe Y */}
<div className="w-full" style={{ height: 360 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                                                       <ComposedChart data={data} margin={{ top: 10, right: 30, bottom: 40, left: 10 }}>
                                                                                                         <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                                                                                                                                     <XAxis
dataKey="date"
stroke="#9ca3af"
style={{ fontSize: 11 }}
angle={-45}
textAnchor="end"
height={60}
tickFormatter={(value) => String(value).slice(0, 7)}
/>
{/* Axa Y stanga - NDVI */}
<YAxis
yAxisId="ndvi"
domain={[0, 1]}
stroke="#16a34a"
style={{ fontSize: 12 }}
label={{
    value: 'NDVI',
    angle: -90,
    position: 'insideLeft',
    style: { fontSize: 12, fill: '#16a34a' },
}}
      />
      {/* Axa Y dreapta - clima */}
<YAxis
yAxisId="climate"
orientation="right"
stroke={currentConfig.color}
style={{ fontSize: 12 }}
label={{
    value: `${currentConfig.label}${currentConfig.unit ? ' (' + currentConfig.unit + ')' : ''}`,
angle: 90,
position: 'insideRight',
style: { fontSize: 12, fill: currentConfig.color },
}}
/>
<Tooltip
contentStyle={{
    backgroundColor: '#1f2937',
    border: 'none',
    fontSize: 12,
    color: '#f9fafb',
}}
formatter={(value, name) => {
if (value === null || value === undefined) return ['—', name];
const label = name === 'ndvi' ? 'NDVI' : currentConfig.label;
return [Number(value).toFixed(3), label];
}}
/>
<Legend />
 <Line
yAxisId="ndvi"
type="monotone"
dataKey="ndvi"
name="NDVI"
stroke="#16a34a"
strokeWidth={2}
dot={{ r: 2 }}
connectNulls
/>
<Line
yAxisId="climate"
type="monotone"
dataKey="climate"
name={currentConfig.label}
stroke={currentConfig.color}
strokeWidth={2}
dot={{ r: 2 }}
connectNulls
/>
</ComposedChart>
  </ResponsiveContainer>
    </div>
      </div>
);
};