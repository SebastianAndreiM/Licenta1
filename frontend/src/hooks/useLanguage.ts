import { useState } from "react";
import { type Language, translations, type TranslationKeys } from "../ i18n";
const STORAGE_KEY = "app_language";

export const useLanguage = () => {
    const [language, setLanguage] = useState<Language>(
        (localStorage.getItem(STORAGE_KEY) as Language) || 'ro'
    );
    const t: TranslationKeys = translations[language];
    const toggleLanguage = () =>{
        const next= language === 'ro' ? 'en':'ro';
        setLanguage(next);
        localStorage.setItem(STORAGE_KEY, next);
    };
    return {language, t, toggleLanguage};
};