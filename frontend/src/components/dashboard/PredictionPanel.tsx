import React, { useState } from 'react';
import { mlApi } from '../../services/mlApi';
import type { Prediction } from '../../services/mlApi';
import { Button } from '../ui/Button';

export const PredictionPanel: React.FC = () => {
    const [prediction, setPrediction] = useState<Prediction | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>('');

    const runPrediction = async () => {
        setIsLoading(true);
        setError('');
        try {
            const sceneId = await mlApi.randomScene();
            const result = await mlApi.predictScene(sceneId);
            setPrediction(result);
        } catch {
            setError('Nu s-a putut obtine predictia. Verifica daca modelul e antrenat.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-5">
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Modelul Random Forest prezice NDVI-ul (sanatatea vegetatiei) folosind doar
                variabilele climatice ERA5. Apasa butonul pentru a lua o scena reala si a compara
                predictia modelului cu valoarea reala masurata din satelit.
            </p>

            <div>
                <Button onClick={runPrediction} isLoading={isLoading} size="lg">
                    Prezice o scena aleatorie
                </Button>
            </div>

            {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            {prediction && (
                <div className="flex flex-col gap-4">
                    {/* Info scena */}
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {prediction.county} · {prediction.acquisitionDate}
                        <br />
                        <span className="font-mono">{prediction.sceneId}</span>
                    </div>

                    {/* Predictie vs realitate */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="border border-gray-200 dark:border-gray-700 p-4 text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">NDVI prezis</p>
                            <p className="text-2xl font-bold text-[var(--copernicus-blue)]">
                                {prediction.predictedNdvi.toFixed(3)}
                            </p>
                        </div>
                        <div className="border border-gray-200 dark:border-gray-700 p-4 text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">NDVI real</p>
                            <p className="text-2xl font-bold text-[var(--copernicus-green)]">
                                {prediction.actualNdvi.toFixed(3)}
                            </p>
                        </div>
                        <div className="border border-gray-200 dark:border-gray-700 p-4 text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Eroare</p>
                            <p className={`text-2xl font-bold ${
                                prediction.error < 0.05 ? 'text-green-600'
                                    : prediction.error < 0.1 ? 'text-orange-500'
                                        : 'text-red-600'
                            }`}>
                                {prediction.error.toFixed(3)}
                            </p>
                        </div>
                    </div>

                    {/* Bara vizuala a erorii */}
                    <div>
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                            <span>Acuratete predictie</span>
                            <span>{((1 - prediction.error) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-2">
                            <div
                                className="h-2 bg-[var(--copernicus-green)] transition-all"
                                style={{ width: `${Math.max(0, (1 - prediction.error) * 100)}%` }}
                            />
                        </div>
                    </div>

                    {/* Variabilele climatice folosite */}
                    <details className="text-sm">
                        <summary className="cursor-pointer text-gray-600 dark:text-gray-400">
                            Variabilele climatice folosite
                        </summary>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                            {Object.entries(prediction.featuresUsed).map(([key, val]) => (
                                <div key={key} className="text-xs">
                                    <span className="text-gray-500 dark:text-gray-400">{key}:</span>{' '}
                                    <span className="font-medium">{val.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </details>
                </div>
            )}
        </div>
    );
};