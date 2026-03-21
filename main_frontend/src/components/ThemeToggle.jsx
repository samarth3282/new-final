import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="fixed bottom-[72px] right-4 z-[9998] p-3 rounded-full bg-surface-2 border border-border shadow-card hover:shadow-elevated transition-all min-h-[48px] min-w-[48px] flex items-center justify-center"
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'light' ? <Moon size={20} className="text-text-secondary" /> : <Sun size={20} className="text-text-secondary" />}
    </button>
  );
}
