import React from 'react';
import type {ExtractionStatus as ExtractionStatusType} from '../../types/dashboard.types';
import { Spinner } from '../ui/Spinner';
import type {TranslationKeys} from '../../ i18n';

interface ExtractionStatusProps {
    extraction: ExtractionStatusType;
    t: TranslationKeys;
}

export const ExtractionStatus: React.FC<ExtractionStatusProps> = ({ extraction, t }) => {
    const statusColors = {
        pending: 'text-yellow-600 dark:text-yellow-400',
        running: 'text-blue-600 dark:text-blue-400',
        completed: 'text-green-600 dark:text-green-400',
        failed: 'text-red-600 dark:text-red-400',
    };

    return (
        <div className="bg-gray-900 dark:bg-gray-950 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-3 mb-3">
                {extraction.status === 'running' && <Spinner size="sm" />}
                <div>
                    <p className={`text-sm font-medium ${statusColors[extraction.status]}`}>
                        {extraction.status === 'running' && t.dashboard.extracting}
                        {extraction.status === 'completed' && t.dashboard.extractionComplete}
                        {extraction.status === 'failed' && t.dashboard.extractionFailed}
                        {extraction.status === 'pending' && 'Pending...'}
                    </p>
                    <p className="text-xs text-gray-500">{extraction.message}</p>
                </div>
                {extraction.status === 'running' && (
                    <div className="ml-auto text-sm font-mono text-gray-400">
                        {extraction.progress}%
                    </div>
                )}
            </div>

            {extraction.status === 'running' && (
                <div className="w-full bg-gray-700 rounded-full h-1.5 mb-3">
                    <div
                        className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${extraction.progress}%` }}
                    />
                </div>
            )}

            <div className="max-h-40 overflow-y-auto font-mono text-xs text-gray-400 space-y-1">
                {extraction.logs.map((log, i) => (
                    <p key={i} className="leading-relaxed">{log}</p>
                ))}
            </div>
        </div>
    );
};