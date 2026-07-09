import React from 'react';
import { AppRouter } from './router';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

const App: React.FC = () => {
    const { isAuthenticated, user, login, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();

    return (
        <AppRouter
            isAuthenticated={isAuthenticated}
            user={user}
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogin={login}
            onLogout={logout}
        />
    );
};

export default App;