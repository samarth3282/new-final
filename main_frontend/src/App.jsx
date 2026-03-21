import { useState, useRef, useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { User, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from './auth/AuthContext';
import { authApi } from './auth/authApi';
import { authConfig } from './auth/authConfig';
import LoginPage from './auth/LoginPage';
import RegisterPage from './auth/RegisterPage';
import ForgotPasswordPage from './auth/ForgotPasswordPage';
import ResetPasswordPage from './auth/ResetPasswordPage';
import VerifyEmailPage from './auth/VerifyEmailPage';
import LanguageSwitcher from './components/LanguageSwitcher';
import ThemeToggle from './components/ThemeToggle';
import AccentColorPicker from './components/AccentColorPicker';
import OnboardingFlow from './pages/patient/OnboardingFlow';
import HealthProfile from './pages/patient/HealthProfile';
import PatientProfile from './pages/patient/PatientProfile';
import ChatBot from './pages/patient/ChatBot';
import DiagnosisResult from './pages/patient/DiagnosisResult';
import AshaForm from './pages/asha/AshaForm';
import AshaConfirmation from './pages/asha/AshaConfirmation';
import AshaProfile from './pages/asha/AshaProfile';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProfile from './pages/admin/AdminProfile';

// Redirects unauthenticated users to /login
function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to={authConfig.routes.login} replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={authConfig.roleHome[user.role] || '/'} replace />;
  }
  return children;
}

// Redirects already-authenticated users to their role home
function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={authConfig.roleHome[user.role] || '/'} replace />;
  return children;
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (!user) return null;

  const profileRoutes = { patient: '/patient/profile', asha: '/asha/profile', admin: '/admin/profile' };
  const displayName = user.firstName
    ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
    : user.username || user.email || '?';
  const initial = displayName[0].toUpperCase();

  return (
    <div ref={ref} className="fixed top-4 left-4 z-[9998]">
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full bg-surface-2 border border-border shadow-card hover:shadow-elevated transition-shadow min-h-[44px]"
        aria-label="User menu"
      >
        <span className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0 select-none">
          {initial}
        </span>
        <span className="text-sm font-medium text-text-primary max-w-[110px] truncate hidden sm:block">
          {displayName}
        </span>
        <ChevronDown
          size={14}
          className={`text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-[52px] left-0 w-52 bg-surface-2 border border-border rounded-2xl shadow-elevated overflow-hidden">
          {/* Identity header */}
          <div className="px-4 pt-3 pb-2.5 border-b border-border">
            <p className="text-sm font-semibold text-text-primary truncate">{displayName}</p>
            <p className="text-xs text-text-secondary truncate mb-1.5">{user.email}</p>
            <span className="inline-block text-[11px] font-semibold bg-primary/15 text-primary rounded-full px-2.5 py-0.5 capitalize">
              {user.role}
            </span>
          </div>

          {/* Profile link */}
          <button
            onClick={() => { navigate(profileRoutes[user.role] || '/'); setOpen(false); }}
            className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-3 transition-colors min-h-[44px]"
          >
            <User size={15} className="text-text-secondary shrink-0" />
            My Profile
          </button>

          {/* Logout */}
          <button
            onClick={() => { logout(); setOpen(false); }}
            className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium hover:bg-surface-3 transition-colors min-h-[44px]"
            style={{ color: 'var(--color-danger)' }}
          >
            <LogOut size={15} className="shrink-0" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

function ShareConsentModal() {
  const { user, accessToken, refreshProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  // Only show for patients who haven't answered yet
  if (!user || user.role !== 'patient' || user.shareWithHospital !== null) return null;

  const respond = async (value) => {
    setSubmitting(true);
    try {
      await authApi.updateSharePreference(value, accessToken);
      await refreshProfile();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '1.25rem',
          padding: '2rem',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏥</div>
        <h2 style={{ color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.5rem' }}>
          Share your health details with hospitals?
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
          Allowing hospitals to access your health profile helps doctors provide faster, more accurate care.
          You can change this preference at any time from your profile.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => respond(false)}
            disabled={submitting}
            style={{
              flex: 1, padding: '0.65rem 1rem', borderRadius: '0.75rem',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)', color: 'var(--color-text-primary)',
              fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            No, keep private
          </button>
          <button
            onClick={() => respond(true)}
            disabled={submitting}
            style={{
              flex: 1, padding: '0.65rem 1rem', borderRadius: '0.75rem',
              border: 'none',
              background: 'var(--color-primary)', color: '#fff',
              fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            Yes, share
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <>
      <LanguageSwitcher />
      <ThemeToggle />
      <AccentColorPicker />
      <ShareConsentModal />
      <UserMenu />
      <Routes>
        {/* ── Public auth routes ─────────────────────────────────────────── */}
        <Route path="/login"          element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/register"       element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
        <Route path="/forgot-password"element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email"   element={<VerifyEmailPage />} />

        {/* ── Root: redirect based on role (or to login) ─────────────────── */}
        <Route path="/" element={<RoleRedirect />} />

        {/* ── Patient routes ─────────────────────────────────────────────── */}
        <Route path="/patient/onboarding" element={<ProtectedRoute allowedRoles={['patient']}><OnboardingFlow /></ProtectedRoute>} />
        <Route path="/patient/profile"    element={<ProtectedRoute allowedRoles={['patient']}><PatientProfile /></ProtectedRoute>} />
        <Route path="/patient/health"     element={<ProtectedRoute allowedRoles={['patient']}><HealthProfile /></ProtectedRoute>} />
        <Route path="/patient/chat"       element={<ProtectedRoute allowedRoles={['patient']}><ChatBot /></ProtectedRoute>} />
        <Route path="/patient/result"     element={<ProtectedRoute allowedRoles={['patient']}><DiagnosisResult /></ProtectedRoute>} />

        {/* ── ASHA routes ────────────────────────────────────────────────── */}
        <Route path="/asha/form"    element={<ProtectedRoute allowedRoles={['asha']}><AshaForm /></ProtectedRoute>} />
        <Route path="/asha/confirm" element={<ProtectedRoute allowedRoles={['asha']}><AshaConfirmation /></ProtectedRoute>} />
        <Route path="/asha/profile" element={<ProtectedRoute allowedRoles={['asha']}><AshaProfile /></ProtectedRoute>} />

        {/* ── Admin routes ───────────────────────────────────────────────── */}
        <Route path="/admin"         element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/profile" element={<ProtectedRoute allowedRoles={['admin']}><AdminProfile /></ProtectedRoute>} />

        {/* ── Fallback ───────────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function RoleRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to={authConfig.routes.login} replace />;
  return <Navigate to={authConfig.roleHome[user.role] || authConfig.routes.login} replace />;
}

export default App;
