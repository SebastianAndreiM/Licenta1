import {useState , useEffect} from "react";

const STORAGE_KEY = "app_theme";

export const useTheme = () => {
    const [theme, setTheme] = useState<'light' | 'dark'>((localStorage.getItem(STORAGE_KEY) as 'light' | 'dark') || 'dark');
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem(STORAGE_KEY, theme);
    }, [theme]);
    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };
    return {theme, toggleTheme};
};