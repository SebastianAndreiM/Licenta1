import React, { useState } from 'react';
import type {SentinelScene} from '../../types/sentinel.types';
import type {TranslationKeys} from '../../ i18n';

interface SatelliteImageViewerProps {
    scenes: SentinelScene[];
    t: TranslationKeys;
}

export const SatelliteImageViewer: React.FC<SatelliteImageViewerProps> = ({ scenes, t }) => {
    const [selected, setSelected] = useState<SentinelScene | null>(null);
    const [filter, setFilter] = useState<'all' | 'good'>('good');

    const filtered = filter === 'good' ? scenes.filter(s => s.isGood) : scenes;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {filtered.length} {t.common.scenes}
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('good')}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                            filter === 'good'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}
                    >
                        {t.common.good}
                    </button>
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                            filter === 'all'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}
                    >
                        All
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filtered.map(scene => (
                    <div
                        key={scene.sceneId}
                        onClick={() => setSelected(scene)}
                        className={`
              cursor-pointer rounded-xl overflow-hidden border-2 transition-all
              ${selected?.sceneId === scene.sceneId
                            ? 'border-green-500 shadow-lg shadow-green-500/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-green-400'
                        }
            `}
                    >
                        <div className="aspect-square bg-gray-100 dark:bg-gray-800">
                            {scene.filePreview ? (
                                <img
                                    src={scene.filePreview}
                                    alt={scene.acquisitionDate}
                                    className="w-full h-full object-cover"
                                    onError={e => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            )}
                        </div>
                        <div className="p-2">
                            <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                {scene.acquisitionDate}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  NDVI: {scene.meanNdvi?.toFixed(2) ?? 'N/A'}
                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                    scene.isGood
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                  {scene.isGood ? t.common.good : t.common.bad}
                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {selected && (
                <div
                    className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelected(null)}
                >
                    <div
                        className="bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full p-6"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                    {selected.acquisitionDate}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {selected.county} — {selected.sceneId}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelected(null)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                            {selected.filePreview ? (
                                <img
                                    src={selected.filePreview}
                                    alt={selected.acquisitionDate}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <p className="text-sm text-gray-400">No image</p>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-sm">
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                                <p className="text-xs text-gray-500 dark:text-gray-400">NDVI</p>
                                <p className="font-semibold">{selected.meanNdvi?.toFixed(3)}</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Cloud</p>
                                <p className="font-semibold">{(selected.cloudRatioValid * 100).toFixed(1)}%</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Valid</p>
                                <p className="font-semibold">{(selected.validRatio * 100).toFixed(1)}%</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};