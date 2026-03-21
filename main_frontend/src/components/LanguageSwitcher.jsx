import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../contexts/I18nContext';
import { Globe } from 'lucide-react';

const langLabels = {
  en: { short: 'EN', full: 'English' },
  hi: { short: 'हि', full: 'हिन्दी' },
  gu: { short: 'ગુ', full: 'ગુજરાતી' },
  mr: { short: 'म', full: 'मराठी' },
  ta: { short: 'த', full: 'தமிழ்' },
};

export default function LanguageSwitcher() {
  const { lang, setLang, supportedLangs } = useTranslation();
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
    <div ref={ref} className="fixed top-4 right-4 z-[9999]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-2 border border-border text-text-primary shadow-card hover:shadow-elevated transition-shadow min-h-[48px]"
        aria-label="Change language"
      >
        <Globe size={18} />
        <span className="font-semibold text-base">{langLabels[lang]?.short}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-14 bg-surface-2 border border-border rounded-lg shadow-elevated py-2 min-w-[160px]">
          {supportedLangs.map((l) => (
            <button
              key={l}
              onClick={() => { setLang(l); setOpen(false); }}
              className={`w-full text-left px-4 py-3 text-base hover:bg-surface-3 transition-colors min-h-[48px] ${l === lang ? 'text-primary font-semibold' : 'text-text-primary'}`}
            >
              {langLabels[l]?.full}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
