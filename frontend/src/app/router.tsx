import React from 'react';
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
} from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { DashboardPage } from '../pages/DashboardPage';
import type {User} from '../types/auth.types';

interface RouterProps {
    isAuthenticated: boolean;
    user: User | null;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
    onLogin: (token: string, user: User) => void;
    onLogout: () => void;
}

export const AppRouter: React.FC<RouterProps> = ({
                                                     isAuthenticated,
                                                     user,
                                                     theme,
                                                     onToggleTheme,
                                                     onLogin,
                                                     onLogout,
                                                 }) => {
    return (
        <BrowserRouter>
            <Routes>
                <Route
                    path="/login"
                    element={
                        isAuthenticated
                            ? <Navigate to="/dashboard" replace />
                            : <LoginPage onLogin={onLogin} theme={theme} onToggleTheme={onToggleTheme} />
                    }
                />
                <Route
                    path="/register"
                    element={
                        isAuthenticated
                            ? <Navigate to="/dashboard" replace />
                            : <RegisterPage onLogin={onLogin} theme={theme} onToggleTheme={onToggleTheme} />
                    }
                />
                <Route
                    path="/dashboard"
                    element={
                        isAuthenticated
                            ? <DashboardPage user={user} onLogout={onLogout} />
                            : <Navigate to="/login" replace />
                    }
                />

                <Route
                    path="*"
                    element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
                />
            </Routes>
        </BrowserRouter>
    );
};