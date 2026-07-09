import { useEffect, useState } from 'react';
import { authApi } from '../services/authApi';
import type { User } from '../types/auth.types';

interface UseAuthResult {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
}

export function useAuth(): UseAuthResult {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(() => {
        return localStorage.getItem('auth_token');
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadCurrentUser = async () => {
            const savedToken = localStorage.getItem('auth_token');

            if (!savedToken) {
                setIsLoading(false);
                return;
            }

            try {
                setToken(savedToken);

                const currentUser = await authApi.me();
                setUser(currentUser);
            } catch {
                localStorage.removeItem('auth_token');
                setToken(null);
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        loadCurrentUser();
    }, []);

    const login = (newToken: string, newUser: User) => {
        localStorage.setItem('auth_token', newToken);
        setToken(newToken);
        setUser(newUser);
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
    };

    return {
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        login,
        logout,
    };
}