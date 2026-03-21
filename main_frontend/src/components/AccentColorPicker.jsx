import { useState, useRef, useEffect } from 'react';
import { useTheme, accentPresets } from '../contexts/ThemeContext';
import { Palette, Check } from 'lucide-react';

export default function AccentColorPicker() {
  const { accent, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="fixed bottom-[132px] right-4 z-[9998]">
      <button
        onClick={() => setOpen(!open)}
        className="p-3 rounded-full bg-surface-2 border border-border shadow-card hover:shadow-elevated transition-all min-h-[48px] min-w-[48px] flex items-center justify-center"
        aria-label="Change accent color"
      >
        <Palette size={20} className="text-text-secondary" />
      </button>
      {open && (
        <div className="absolute bottom-14 right-0 bg-surface-2 border border-border rounded-lg shadow-elevated p-3 min-w-[180px]">
          <p className="text-xs font-semibold text-text-secondary mb-2 px-1">Accent Color</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(accentPresets).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => { setAccent(key); setOpen(false); }}
                className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-surface-3 transition-colors"
                aria-label={`Set accent to ${preset.label}`}
              >
                <span
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform"
                  style={{
                    backgroundColor: preset.swatch,
                    borderColor: accent === key ? 'var(--color-text-primary)' : 'transparent',
                    transform: accent === key ? 'scale(1.1)' : 'scale(1)',
                  }}
                >
                  {accent === key && <Check size={14} className="text-white" />}
                </span>
                <span className="text-[11px] text-text-secondary leading-tight">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
