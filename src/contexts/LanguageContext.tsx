import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from '../locales/en.json';
import hiTranslation from '../locales/hi.json';

type LanguageType = 'en' | 'hi';

// Initialize i18next
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      hi: { translation: hiTranslation }
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

interface LanguageContextType {
  language: LanguageType;
  changeLanguage: (lang: LanguageType) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguage] = useState<LanguageType>('en');
  const { userProfile, setUserLanguage } = useAuth();

  // Initialize language from user profile or local storage
  useEffect(() => {
    if (userProfile?.language) {
      setLanguage(userProfile.language);
      i18n.changeLanguage(userProfile.language);
    } else {
      const savedLanguage = localStorage.getItem('language') as LanguageType | null;
      if (savedLanguage) {
        setLanguage(savedLanguage);
        i18n.changeLanguage(savedLanguage);
      }
    }
  }, [userProfile]);

  const changeLanguage = (lang: LanguageType) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    
    // Update user profile if logged in
    if (userProfile) {
      setUserLanguage(lang);
    }
  };

  const value = {
    language,
    changeLanguage
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
} 