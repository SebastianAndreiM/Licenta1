import React from 'react';
import { ThemeToggle } from '../ui/ThemeToggle.tsx';
import { LanguageToggle } from '../ui/LanguageToggle.tsx';
import type { User } from '../../types/auth.types.ts';

interface PublicPortalHeaderProps {
    user?: User | null;
    theme: 'light' | 'dark';
    language: 'ro' | 'en';
    onToggleTheme: () => void;
    onToggleLanguage: () => void;
    onLogout?: () => void;
}

export const PublicPortalHeader: React.FC<PublicPortalHeaderProps> = ({
                                                                          user,
                                                                          theme,
                                                                          language,
                                                                          onToggleTheme,
                                                                          onToggleLanguage,
                                                                          onLogout,
                                                                      }) => {
    return (
        <header className="portal-header">
            <div className="portal-logos">
                <div className="eu-logo">EU</div>

                <div className="logo-text">
                    <strong>Copernicus</strong>
                    <span>Europe's eyes on Earth</span>
                </div>

                <div className="implemented">implemented by</div>

                <div className="ecmwf-logo">ECMWF</div>
            </div>

            <div className="portal-actions">
                <ThemeToggle theme={theme} onToggle={onToggleTheme} />
                <LanguageToggle language={language} onToggle={onToggleLanguage} />

                {user && (
                    <div className="portal-user">
                        <div className="portal-avatar">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <strong>{user.name}</strong>
                            <span>{user.institution}</span>
                        </div>
                    </div>
                )}

                {onLogout && (
                    <button className="portal-logout" onClick={onLogout}>
                        Log out
                    </button>
                )}
            </div>
        </header>
    );
};