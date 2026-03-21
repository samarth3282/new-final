import { createContext, useContext, useState, useEffect, useCallback } from 'react';

import en from '../i18n/en.json';
import hi from '../i18n/hi.json';
import gu from '../i18n/gu.json';
import mr from '../i18n/mr.json';
import ta from '../i18n/ta.json';

const locales = { en, hi, gu, mr, ta };
const SUPPORTED = ['en', 'hi', 'gu', 'mr', 'ta'];

function detectLang() {
  const stored = localStorage.getItem('hl_lang');
  if (stored && SUPPORTED.includes(stored)) return stored;
  const browserLang = navigator.language?.split('-')[0];
  if (SUPPORTED.includes(browserLang)) return browserLang;
  return 'en';
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

const I18nContext = createContext();

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLang);

  const setLang = useCallback((newLang) => {
    if (SUPPORTED.includes(newLang)) {
      setLangState(newLang);
      localStorage.setItem('hl_lang', newLang);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((key) => {
    const val = getNestedValue(locales[lang], key);
    if (val !== undefined) return val;
    const fallback = getNestedValue(locales.en, key);
    return fallback !== undefined ? fallback : key;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ t, lang, setLang, supportedLangs: SUPPORTED }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
