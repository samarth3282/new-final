import { useTranslation } from '../contexts/I18nContext';
import { AlertTriangle, Phone } from 'lucide-react';

export default function EmergencyBanner({ onCallAmbulance }) {
  const { t } = useTranslation();

  return (
    <div className="animate-slide-in-top animate-shake rounded-lg p-4 mb-4" style={{ background: 'var(--color-danger)', color: 'white' }}>
      <div className="flex items-center gap-3 mb-3">
        <AlertTriangle size={24} />
        <span className="font-semibold text-lg">{t('emergency.title')}</span>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onCallAmbulance}
          className="flex items-center gap-2 px-4 py-3 rounded-full bg-white text-[var(--color-danger)] font-semibold text-base min-h-[48px] hover:opacity-90 transition-opacity"
        >
          <Phone size={18} />
          {t('emergency.call_108')}
        </button>
      </div>
    </div>
  );
}
