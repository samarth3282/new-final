const hostName = typeof window !== 'undefined' ? window.location.hostname : '';
const isLocalHost = hostName === 'localhost' || hostName === '127.0.0.1';

const defaultApiBaseUrl = isLocalHost
    ? 'http://localhost:3000/api'
    : (import.meta.env.VITE_API_BASE_URL || 'https://auth-jr11.onrender.com/api');

export const authConfig = {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl,
    routes: {
        login: '/login',
        register: '/register',
        forgotPassword: '/forgot-password',
        resetPassword: '/reset-password',
        verifyEmail: '/verify-email',
    },
    // Role-based landing paths after login
    roleHome: {
        patient: '/patient/onboarding',
        asha: '/asha/form',
        admin: '/admin',
    }
};
