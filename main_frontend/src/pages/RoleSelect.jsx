import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../contexts/I18nContext';
import { useUser } from '../contexts/UserContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';

const roles = [
  {
    id: 'patient',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="14" r="8" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <path d="M8 42c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
    ),
    labelKey: 'role_select.patient',
    descKey: 'role_select.patient_desc',
    path: '/patient/onboarding',
  },
  {
    id: 'asha',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="20" cy="14" r="7" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <path d="M6 42c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <circle cx="37" cy="18" r="5" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M37 15v6M34 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    labelKey: 'role_select.asha',
    descKey: 'role_select.asha_desc',
    path: '/asha/form',
  },
  {
    id: 'admin',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="28" width="8" height="12" rx="2" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <rect x="20" y="18" width="8" height="22" rx="2" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <rect x="32" y="8" width="8" height="32" rx="2" stroke="currentColor" strokeWidth="2.5" fill="none" />
      </svg>
    ),
    labelKey: 'role_select.admin',
    descKey: 'role_select.admin_desc',
    path: '/admin',
  },
];

export default function RoleSelect() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { dispatch } = useUser();

  function handleSelect(role) {
    dispatch({ type: 'SET_ROLE', payload: role.id });
    navigate(role.path);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-primary-light) 100%)' }}>
      <LanguageSwitcher />
      <ThemeToggle />

      {/* Decorative background SVG */}
      <svg className="absolute bottom-0 left-0 w-full opacity-[0.06] pointer-events-none" viewBox="0 0 800 200" fill="none">
        <path d="M0 200 Q200 100 400 150 Q600 200 800 120 V200 H0Z" fill="var(--color-primary)" />
        <rect x="340" y="80" width="60" height="50" rx="4" fill="var(--color-primary)" />
        <polygon points="330,80 400,50 470,80" fill="var(--color-primary)" />
        <rect x="355" y="100" width="12" height="16" rx="2" fill="var(--color-surface)" />
        <rect x="375" y="100" width="12" height="16" rx="2" fill="var(--color-surface)" />
        <rect x="365" y="120" width="10" height="14" rx="1" fill="var(--color-surface)" />
      </svg>

      {/* App Logo */}
      <div className="flex items-center gap-3 mb-2">
        <div className="relative">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="16" y="8" width="8" height="24" rx="2" fill="var(--color-danger)" />
            <rect x="8" y="16" width="24" height="8" rx="2" fill="var(--color-danger)" />
            <path d="M32 8c2 4 2 8 0 12" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
            <path d="M35 6c3 5 3 10 0 16" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          </svg>
        </div>
        <h1 className="font-display text-3xl text-text-primary">HealthBridge</h1>
      </div>

      <p className="text-text-secondary text-base mb-10">{t('role_select.subtitle')}</p>

      <div className="w-full max-w-md flex flex-col gap-4">
        {roles.map((role) => (
          <button
            key={role.id}
            onClick={() => handleSelect(role)}
            className="card flex items-center gap-4 p-5 min-h-[120px] text-left w-full transition-all duration-200 hover:-translate-y-1 hover:shadow-elevated hover:border-l-4 focus:-translate-y-1 focus:shadow-elevated focus:outline-none group"
            style={{ borderLeftColor: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.borderLeftColor = 'var(--color-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.borderLeftColor = 'transparent'}
          >
            <div className="w-16 h-16 rounded-xl bg-primary-light flex items-center justify-center text-primary flex-shrink-0">
              {role.icon}
            </div>
            <div className="flex-1">
              <h2 className="font-body font-semibold text-xl text-text-primary mb-1">{t(role.labelKey)}</h2>
              <p className="text-text-secondary text-base">{t(role.descKey)}</p>
            </div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-text-hint group-hover:text-primary transition-colors flex-shrink-0">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
