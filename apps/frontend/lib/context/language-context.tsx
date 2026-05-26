'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  fetchLanguageConfig,
  updateLanguageConfig,
  type SupportedLanguage,
} from '@/lib/api/config';
import { locales, defaultLocale, localeNames, type Locale } from '@/i18n/config';
import { normalizeStoredLocale } from '@/lib/i18n/route-title';
import { syncLocaleCookie } from '@/lib/i18n/locale-cookie';
import { logError } from '@/lib/utils/logger';
import { useAuth } from '@/lib/context/auth-context';

const CONTENT_STORAGE_KEY = 'resume_matcher_content_language';
const UI_STORAGE_KEY = 'resume_matcher_ui_language';

function normalizeContentLocale(value: string | null | undefined, fallback: SupportedLanguage): SupportedLanguage {
  if (value === 'en' || value === 'vi' || value === 'auto') return value as SupportedLanguage;
  return fallback;
}

interface LanguageContextValue {
  contentLanguage: SupportedLanguage;
  uiLanguage: Locale;
  isLoading: boolean;
  setContentLanguage: (lang: SupportedLanguage) => Promise<void>;
  setUiLanguage: (lang: Locale) => void;
  languageNames: typeof localeNames;
  supportedLanguages: readonly Locale[];
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [contentLanguage, setContentLanguageState] = useState<SupportedLanguage>(defaultLocale);
  const [uiLanguage, setUiLanguageState] = useState<Locale>(defaultLocale);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const storedUi = localStorage.getItem(UI_STORAGE_KEY);
        const storedContent = localStorage.getItem(CONTENT_STORAGE_KEY);
        
        const cachedUiLang = normalizeStoredLocale(storedUi, defaultLocale);
        const cachedContentLang = normalizeContentLocale(storedContent, defaultLocale);
        
        setUiLanguageState(cachedUiLang);
        setContentLanguageState(cachedContentLang);
        syncLocaleCookie(cachedUiLang);

        const config = await fetchLanguageConfig();
        
        // If the user has a stored preference in localStorage, prioritize it.
        // Otherwise, fall back to the system-wide configuration.
        const configUi = storedUi !== null ? cachedUiLang : normalizeStoredLocale(config.ui_language, cachedUiLang);
        const configContent = storedContent !== null ? cachedContentLang : normalizeContentLocale(config.content_language, cachedContentLang);
        
        setUiLanguageState(configUi);
        setContentLanguageState(configContent);
        localStorage.setItem(UI_STORAGE_KEY, configUi);
        localStorage.setItem(CONTENT_STORAGE_KEY, configContent);
        syncLocaleCookie(configUi);
      } catch (error) {
        logError('language-context', 'Failed to load language config', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguages();
  }, []);

  const setContentLanguage = useCallback(
    async (lang: SupportedLanguage) => {
      const normalized = normalizeContentLocale(lang, defaultLocale);
      const previousLang = contentLanguage;
      try {
        setContentLanguageState(normalized);
        localStorage.setItem(CONTENT_STORAGE_KEY, normalized);
        
        // Only update database system config if the user is an admin
        if (user?.role === 'admin') {
          await updateLanguageConfig({ content_language: normalized, ui_language: uiLanguage });
        }
      } catch (error) {
        logError('language-context', 'Failed to update content language', error);
        setContentLanguageState(previousLang);
        localStorage.setItem(CONTENT_STORAGE_KEY, previousLang);
      }
    },
    [contentLanguage, uiLanguage, user]
  );

  const setUiLanguage = useCallback((lang: Locale) => {
    const normalized = normalizeStoredLocale(lang, defaultLocale);
    setUiLanguageState(normalized);
    setContentLanguageState(normalized);
    localStorage.setItem(UI_STORAGE_KEY, normalized);
    localStorage.setItem(CONTENT_STORAGE_KEY, normalized);
    syncLocaleCookie(normalized);
    
    // Only update database system config if the user is an admin
    if (user?.role === 'admin') {
      updateLanguageConfig({ ui_language: normalized, content_language: normalized }).catch((error) => {
        logError('language-context', 'Failed to sync language config', error);
      });
    }
  }, [user]);

  return (
    <LanguageContext.Provider
      value={{
        contentLanguage,
        uiLanguage,
        isLoading,
        setContentLanguage,
        setUiLanguage,
        languageNames: localeNames,
        supportedLanguages: locales,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
