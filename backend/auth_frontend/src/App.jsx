import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { authConfig } from './config/authConfig';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { CookieConsentModal } from './components/CookieConsentModal';
import './App.css';

const COOKIE_CONSENT_KEY = 'auth_cookie_consent_v1';
const COOKIE_CONSENT_SESSION_KEY = 'auth_cookie_consent_session_v1';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading secure workspace...</div>;
  }

  if (!user) {
    return <Navigate to={authConfig.routes.login} replace />;
  }

  return children;
};

const PublicOnlyRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Preparing authentication screens...</div>;
  }

  if (user) {
    return <Navigate to={authConfig.routes.dashboard} replace />;
  }

  return children;
};

function App() {
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    const sessionConsent = sessionStorage.getItem(COOKIE_CONSENT_SESSION_KEY);
    const storedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
    setHasConsent(sessionConsent === 'accepted' || storedConsent === 'accepted');
  }, []);

  const handleAcceptConsent = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    sessionStorage.setItem(COOKIE_CONSENT_SESSION_KEY, 'accepted');
    setHasConsent(true);
  };

  return (
    <>
      <div className={`app-root ${!hasConsent ? 'consent-gated' : ''}`} aria-hidden={!hasConsent}>
        <Routes>
          <Route path="/" element={<Navigate to={authConfig.routes.login} replace />} />
          <Route
            path={authConfig.routes.login}
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path={authConfig.routes.register}
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path={authConfig.routes.forgotPassword}
            element={
              <PublicOnlyRoute>
                <ForgotPasswordPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path={authConfig.routes.resetPassword}
            element={
              <PublicOnlyRoute>
                <ResetPasswordPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path={authConfig.routes.verifyEmail}
            element={<VerifyEmailPage />}
          />
          <Route
            path={authConfig.routes.dashboard}
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>

      {!hasConsent ? <CookieConsentModal onAccept={handleAcceptConsent} /> : null}
    </>
  );
}

export default App;
