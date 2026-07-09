import React from 'react';
import { PublicPortalHeader } from './PublicPortalHeader.tsx';
import type { User } from '../../types/auth.types.ts';

interface AuthShellProps {
    children: React.ReactNode;
    title: string;
    subtitle: string;
    theme: 'light' | 'dark';
    language: 'ro' | 'en';
    onToggleTheme: () => void;
    onToggleLanguage: () => void;
}

export const AuthShell: React.FC<AuthShellProps> = ({
                                                        children,
                                                        title,
                                                        subtitle,
                                                        theme,
                                                        language,
                                                        onToggleTheme,
                                                        onToggleLanguage,
                                                    }) => {
    const guest: User = {
        id: 0,
        name: 'Guest',
        email: '',
        institution: 'Autentificare / Sign in',
        createdAt: '',
    };

    return (
        <div className="auth-shell">
            <PublicPortalHeader
                user={guest}
                theme={theme}
                language={language}
                onToggleTheme={onToggleTheme}
                onToggleLanguage={onToggleLanguage}
            />

            <main className="auth-main">
                <section className="auth-hero">
                    <div className="brand-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path
                                d="M12 21s7-5.1 7-12a7 7 0 1 0-14 0c0 6.9 7 12 7 12Z"
                                stroke="currentColor"
                                strokeWidth="2"
                            />
                            <circle cx="12" cy="9" r="2.5" fill="currentColor" />
                        </svg>
                    </div>

                    <h1>{title}</h1>
                    <p>{subtitle}</p>
                </section>

                {children}
            </main>
        </div>
    );
};