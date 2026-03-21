import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const accentPresets = {
  terracotta: {
    label: 'Terracotta',
    swatch: '#D4622A',
    light: {
      primary: '#D4622A', primaryLight: '#F5DED3', primaryDark: '#A8421A',
      surface: '#FDFAF6', surface2: '#F4EFE8', surface3: '#EBE3D8',
      textPrimary: '#1C1410', textSecondary: '#6B5C4E', textHint: '#A89080',
      border: '#DDD3C8',
    },
    dark: {
      primary: '#E8845A', primaryLight: '#3A2318', primaryDark: '#F5A882',
      surface: '#17120E', surface2: '#1F1812', surface3: '#2C221A',
      textPrimary: '#F5EDE5', textSecondary: '#B8A898', textHint: '#756054',
      border: '#3A2D22',
    },
  },
  teal: {
    label: 'Teal',
    swatch: '#0D9488',
    light: {
      primary: '#0D9488', primaryLight: '#CCFBF1', primaryDark: '#0F766E',
      surface: '#F7FDFB', surface2: '#EDF7F4', surface3: '#DFEDE8',
      textPrimary: '#111B18', textSecondary: '#4D635C', textHint: '#7F9690',
      border: '#CDDDD7',
    },
    dark: {
      primary: '#2DD4BF', primaryLight: '#132D2A', primaryDark: '#5EEAD4',
      surface: '#0F1413', surface2: '#161F1D', surface3: '#202C29',
      textPrimary: '#E8F3F0', textSecondary: '#9AB5AE', textHint: '#5C706A',
      border: '#263835',
    },
  },
  blue: {
    label: 'Blue',
    swatch: '#2563EB',
    light: {
      primary: '#2563EB', primaryLight: '#DBEAFE', primaryDark: '#1D4ED8',
      surface: '#F7F9FD', surface2: '#EDF1F7', surface3: '#DFE5ED',
      textPrimary: '#111418', textSecondary: '#4D5663', textHint: '#7F8A96',
      border: '#CDD5DD',
    },
    dark: {
      primary: '#60A5FA', primaryLight: '#1E2A4A', primaryDark: '#93BBFD',
      surface: '#0F1117', surface2: '#161A22', surface3: '#20262F',
      textPrimary: '#E8ECF3', textSecondary: '#9AA5B5', textHint: '#5C6670',
      border: '#263038',
    },
  },
  purple: {
    label: 'Purple',
    swatch: '#7C3AED',
    light: {
      primary: '#7C3AED', primaryLight: '#EDE9FE', primaryDark: '#6D28D9',
      surface: '#F9F7FD', surface2: '#F1EDF7', surface3: '#E5DFED',
      textPrimary: '#14111B', textSecondary: '#554D68', textHint: '#8A7F9A',
      border: '#D5CDE0',
    },
    dark: {
      primary: '#A78BFA', primaryLight: '#2E1850', primaryDark: '#C4B5FD',
      surface: '#12101A', surface2: '#1A1622', surface3: '#25202F',
      textPrimary: '#EDE8F5', textSecondary: '#AA9ABB', textHint: '#665C76',
      border: '#302640',
    },
  },
  rose: {
    label: 'Rose',
    swatch: '#E11D48',
    light: {
      primary: '#E11D48', primaryLight: '#FFE4E6', primaryDark: '#BE123C',
      surface: '#FDF7F8', surface2: '#F7EDF0', surface3: '#EDDFE3',
      textPrimary: '#1B1113', textSecondary: '#684D55', textHint: '#A07F88',
      border: '#DDCDD3',
    },
    dark: {
      primary: '#FB7185', primaryLight: '#3D0D18', primaryDark: '#FDA4AF',
      surface: '#170F11', surface2: '#211618', surface3: '#2F2024',
      textPrimary: '#F5E8EC', textSecondary: '#BB9AA5', textHint: '#765C66',
      border: '#3E262E',
    },
  },
  emerald: {
    label: 'Emerald',
    swatch: '#059669',
    light: {
      primary: '#059669', primaryLight: '#D1FAE5', primaryDark: '#047857',
      surface: '#F7FDF8', surface2: '#EDF7EF', surface3: '#DFEDE1',
      textPrimary: '#111B12', textSecondary: '#4D634F', textHint: '#7F9681',
      border: '#CDDDD0',
    },
    dark: {
      primary: '#34D399', primaryLight: '#0D2E22', primaryDark: '#6EE7B7',
      surface: '#0F1410', surface2: '#161F17', surface3: '#202C21',
      textPrimary: '#E8F3E9', textSecondary: '#9AB59C', textHint: '#5C705E',
      border: '#263828',
    },
  },
};

function applyAccentColors(accentName, currentTheme) {
  const preset = accentPresets[accentName] || accentPresets.terracotta;
  const colors = currentTheme === 'dark' ? preset.dark : preset.light;
  const root = document.documentElement;
  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-primary-light', colors.primaryLight);
  root.style.setProperty('--color-primary-dark', colors.primaryDark);
  root.style.setProperty('--color-surface', colors.surface);
  root.style.setProperty('--color-surface-2', colors.surface2);
  root.style.setProperty('--color-surface-3', colors.surface3);
  root.style.setProperty('--color-text-primary', colors.textPrimary);
  root.style.setProperty('--color-text-secondary', colors.textSecondary);
  root.style.setProperty('--color-text-hint', colors.textHint);
  root.style.setProperty('--color-border', colors.border);
}

export { accentPresets };

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('hl_theme');
    return stored || 'light';
  });

  const [accent, setAccent] = useState(() => {
    const stored = localStorage.getItem('hl_accent');
    return stored && accentPresets[stored] ? stored : 'terracotta';
  });

  useEffect(() => {
    localStorage.setItem('hl_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    applyAccentColors(accent, theme);
  }, [theme, accent]);

  useEffect(() => {
    localStorage.setItem('hl_accent', accent);
  }, [accent]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
