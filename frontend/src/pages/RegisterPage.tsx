import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../hooks/useLanguage';
import type { User } from '../types/auth.types';
import { AuthShell } from '../components/layout/AuthShell';
import { authApi } from '../services/authApi';

interface RegisterPageProps {
    onLogin: (token: string, user: User) => void;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
                                                              onLogin,
                                                              theme,
                                                              onToggleTheme,
                                                          }) => {
    const { t, language, toggleLanguage } = useLanguage();

    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        institution: '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!form.name.trim()) {
            newErrors.name = 'Numele este obligatoriu';
        }

        if (!form.email.trim()) {
            newErrors.email = 'Email-ul este obligatoriu';
        }

        if (form.password.length < 8) {
            newErrors.password = 'Parola trebuie sa aiba minim 8 caractere';
        }

        if (!form.institution.trim()) {
            newErrors.institution = 'Institutia este obligatorie';
        }

        return newErrors;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));

        setErrors((prev) => ({
            ...prev,
            [e.target.name]: '',
            general: '',
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const validationErrors = validate();

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        setIsLoading(true);

        try {
            const response = await authApi.register({
                name: form.name,
                email: form.email,
                password: form.password,
                institution: form.institution,
            });

            onLogin(response.access_token, response.user);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : t.auth.registerError;

            setErrors({
                general: message,
            });
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
                <h2>{t.auth.register} / Create an account</h2>

                <p className="text-sm mb-6">
                    Creeaza-ti cont pentru a accesa analiza datelor Sentinel-2 si ERA5-Land.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Input
                        label={`${t.auth.name} / Full name`}
                        name="name"
                        type="text"
                        placeholder="Ion Popescu"
                        value={form.name}
                        onChange={handleChange}
                        error={errors.name}
                        required
                    />

                    <Input
                        label={t.auth.email}
                        name="email"
                        type="email"
                        placeholder="email@institutie.ro"
                        value={form.email}
                        onChange={handleChange}
                        error={errors.email}
                        required
                    />

                    <Input
                        label={`${t.auth.password} / Password`}
                        name="password"
                        type="password"
                        placeholder="Creeaza o parola"
                        value={form.password}
                        onChange={handleChange}
                        error={errors.password}
                        required
                    />

                    <Input
                        label={`${t.auth.institution} / Institution`}
                        name="institution"
                        type="text"
                        placeholder="Universitatea Tehnica din Cluj-Napoca"
                        value={form.institution}
                        onChange={handleChange}
                        error={errors.institution}
                        required
                    />

                    {errors.general && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                            <p className="text-sm text-red-600 dark:text-red-400">
                                {errors.general}
                            </p>
                        </div>
                    )}

                    <Button
                        type="submit"
                        isLoading={isLoading}
                        className="w-full mt-2"
                        size="lg"
                    >
                        {t.auth.registerButton} / Create account
                    </Button>
                </form>

                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-6">
                    {t.auth.hasAccount}{' '}
                    <Link
                        to="/login"
                        className="text-green-600 hover:text-green-700 font-semibold"
                    >
                        {t.auth.loginLink}
                    </Link>
                </p>
            </div>
        </AuthShell>
    );
};