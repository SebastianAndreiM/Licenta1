import React from 'react';
import {Header} from './Header';
import type {Language, TranslationKeys} from "../../ i18n";
import type {User} from "../../types/auth.types.ts";

interface AppLayoutProps {
    children:React.ReactNode;
    user: User | null;
    theme: 'light' | 'dark';
    language: Language;
    t: TranslationKeys;
    onToggleTheme: () => void;
    onToggleLanguage: () => void;
    onLogout: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
                                                        children,
                                                        user,
                                                        theme,
                                                        language,
                                                        t,
                                                        onToggleTheme,
                                                        onToggleLanguage,
                                                        onLogout,
                                                    }) => {
    return (
        <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
            <Header
                user={user}
                theme={theme}
                language={language}
                t={t}
                onToggleTheme={onToggleTheme}
                onToggleLanguage={onToggleLanguage}
                onLogout={onLogout}
            />
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    );
};