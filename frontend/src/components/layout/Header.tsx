import React from 'react';
import {ThemeToggle} from '../ui/ThemeToggle';
import {LanguageToggle} from '../ui/LanguageToggle';
import {Button} from '../ui/Button';
import type {Language, TranslationKeys} from "../../ i18n";

interface HeaderProps {
    user:{name:string; institution:string} | null;
    theme: 'light' | 'dark';
    language: Language;
    t: TranslationKeys;
    onToggleTheme: () => void;
    onToggleLanguage: () => void;
    onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
                                                  user,
                                                  theme,
                                                  language,
                                                  t,
                                                  onToggleTheme,
                                                  onToggleLanguage,
                                                  onLogout,
                                              }) => {
    return (
        <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {t.dashboard.title}
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t.dashboard.subtitle}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {user && (
                    <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
              {user.name}
            </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
              {user.institution}
            </span>
                    </div>
                )}
                <ThemeToggle theme={theme} onToggle={onToggleTheme} />
                <LanguageToggle language={language} onToggle={onToggleLanguage} />
                {user && (
                    <Button variant="ghost" size="sm" onClick={onLogout}>
                        {t.nav.logout}
                    </Button>
                )}
            </div>
        </header>
    );
};