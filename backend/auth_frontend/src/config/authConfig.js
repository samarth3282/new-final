const hostName = typeof window !== 'undefined' ? window.location.hostname : '';
const isLocalHost = hostName === 'localhost' || hostName === '127.0.0.1';

const defaultApiBaseUrl = isLocalHost
    ? 'http://localhost:3000/api'
    : 'https://auth-jr11.onrender.com/api';

// Main frontend URL — auth_frontend redirects here after a successful login
const mainFrontendUrl = isLocalHost
    ? (import.meta.env.VITE_MAIN_FRONTEND_URL || 'http://localhost:5173')
    : (import.meta.env.VITE_MAIN_FRONTEND_URL || 'https://your-main-frontend.netlify.app');

export const authConfig = {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl,
    mainFrontendUrl,
    routes: {
        login: '/login',
        register: '/register',
        forgotPassword: '/forgot-password',
        resetPassword: '/reset-password',
        verifyEmail: '/verify-email',
        dashboard: '/dashboard'   // local dashboard within auth_frontend
    }
};
