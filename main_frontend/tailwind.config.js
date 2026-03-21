/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-light': 'var(--color-primary-light)',
        'primary-dark': 'var(--color-primary-dark)',
        accent: 'var(--color-accent)',
        'accent-light': 'var(--color-accent-light)',
        surface: 'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        'surface-3': 'var(--color-surface-3)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-hint': 'var(--color-text-hint)',
        danger: 'var(--color-danger)',
        'danger-light': 'var(--color-danger-light)',
        warning: 'var(--color-warning)',
        'warning-light': 'var(--color-warning-light)',
        safe: 'var(--color-safe)',
        'safe-light': 'var(--color-safe-light)',
        border: 'var(--color-border)',
      },
      fontFamily: {
        body: ["'Mukta'", "'Noto Sans Devanagari'", 'sans-serif'],
        display: ["'DM Serif Display'", 'serif'],
      },
      fontSize: {
        xs: '12px',
        sm: '14px',
        base: '16px',
        lg: '18px',
        xl: '22px',
        '2xl': '28px',
        '3xl': '36px',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        full: '9999px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(60, 30, 10, 0.08)',
        elevated: '0 4px 20px rgba(60, 30, 10, 0.12)',
      },
    },
  },
  plugins: [],
}

