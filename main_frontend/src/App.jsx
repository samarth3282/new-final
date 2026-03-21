import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
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
import ChatBot from './pages/patient/ChatBot';
import DiagnosisResult from './pages/patient/DiagnosisResult';
import AshaForm from './pages/asha/AshaForm';
import AshaConfirmation from './pages/asha/AshaConfirmation';
import AdminDashboard from './pages/admin/AdminDashboard';

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
  if (!user) return null;
  return (
    <div
      style={{
        position: 'fixed', bottom: '1rem', left: '1rem', zIndex: 1000,
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: '0.75rem',
        padding: '0.4rem 0.75rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {user.username || user.email}
      </span>
      <span style={{ fontSize: '0.65rem', background: 'var(--color-primary)', color: '#fff', borderRadius: '999px', padding: '1px 6px' }}>
        {user.role}
      </span>
      <button
        onClick={logout}
        style={{
          fontSize: '0.75rem', fontWeight: 600,
          color: 'var(--color-error, #ef4444)',
          background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
        }}
        title="Log out"
      >
        Logout
      </button>
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
        <Route path="/patient/profile"    element={<ProtectedRoute allowedRoles={['patient']}><HealthProfile /></ProtectedRoute>} />
        <Route path="/patient/chat"       element={<ProtectedRoute allowedRoles={['patient']}><ChatBot /></ProtectedRoute>} />
        <Route path="/patient/result"     element={<ProtectedRoute allowedRoles={['patient']}><DiagnosisResult /></ProtectedRoute>} />

        {/* ── ASHA routes ────────────────────────────────────────────────── */}
        <Route path="/asha/form"    element={<ProtectedRoute allowedRoles={['asha']}><AshaForm /></ProtectedRoute>} />
        <Route path="/asha/confirm" element={<ProtectedRoute allowedRoles={['asha']}><AshaConfirmation /></ProtectedRoute>} />

        {/* ── Admin routes ───────────────────────────────────────────────── */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />

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
