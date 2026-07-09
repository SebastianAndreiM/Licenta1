import React from 'react';
import type {Language} from '../../ i18n';

interface LanguageToggleProps {
    language: Language;
    onToggle: () => void;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ language, onToggle }) => {
    return (
        <button
            onClick={onToggle}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600"
        >
            {language === 'ro' ? 'EN' : 'RO'}
        </button>
    );
};