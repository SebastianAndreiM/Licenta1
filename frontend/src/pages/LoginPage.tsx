import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../hooks/useLanguage';
import type { User } from '../types/auth.types';
import { AuthShell } from '../components/layout/AuthShell';
import { authApi } from '../services/authApi';

interface LoginPageProps {
    onLogin: (token: string, user: User) => void;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
                                                        onLogin,
                                                        theme,
                                                        onToggleTheme,
                                                    }) => {
    const { t, language, toggleLanguage } = useLanguage();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setError('');
        setIsLoading(true);

        try {
            const response = await authApi.login({
                email,
                password,
            });

            onLogin(response.access_token, response.user);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : t.auth.loginError;

            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthShell
            title={t.dashboard.title}
            subtitle={t.dashboard.subtitle}
            theme={theme}
            language={language}
            onToggleTheme={onToggleTheme}
            onToggleLanguage={toggleLanguage}
        >
            <div className="auth-card">
                <h2>{t.auth.login} / Sign in</h2>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-6">
                    <Input
                        label={t.auth.email}
                        type="email"
                        placeholder="email@institutie.ro"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                    />

                    <Input
                        label={`${t.auth.password} / Password`}
                        type="password"
                        placeholder="Introduceti parola / Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                    />

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                            <p className="text-sm text-red-600 dark:text-red-400">
                                {error}
                            </p>
                        </div>
                    )}

                    <Button
                        type="submit"
                        isLoading={isLoading}
                        className="w-full mt-2"
                        size="lg"
                    >
                        {t.auth.loginButton} / Sign in
                    </Button>
                </form>

                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-6">
                    {t.auth.noAccount}{' '}
                    <Link
                        to="/register"
                        className="text-green-600 hover:text-green-700 font-semibold"
                    >
                        {t.auth.registerLink}
                    </Link>
                </p>
            </div>
        </AuthShell>
    );
};