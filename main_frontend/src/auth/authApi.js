import { authConfig } from './authConfig';

const jsonHeaders = { 'Content-Type': 'application/json' };

const buildUrl = (path, query) => {
    const rawUrl = `${authConfig.apiBaseUrl}${path}`;
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(rawUrl, baseOrigin);
    if (query) {
        Object.entries(query).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
        });
    }
    return url.toString();
};

const parseResponse = async (response) => {
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) {
        console.error(`[authApi] ❌ ${response.status} ${response.url}`, data);
        const message = data?.message || 'Request failed';
        const error = new Error(message);
        error.status = response.status;
        error.payload = data;
        throw error;
    }
    return data || { success: true };
};

const request = async (path, { method = 'GET', body, token, query } = {}) => {
    if (body) {
        console.log(`[authApi] ${method} ${path} — payload:`, JSON.stringify(body, null, 2));
    }
    const response = await fetch(buildUrl(path, query), {
        method,
        credentials: 'include',
        headers: {
            ...jsonHeaders,
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    return parseResponse(response);
};

export const authApi = {
    register: (payload)      => request('/register',        { method: 'POST', body: payload }),
    login:    (payload)      => request('/login',           { method: 'POST', body: payload }),
    refreshToken: ()         => request('/refresh-token',   { method: 'POST' }),
    logout:   (token)        => request('/logout',          { method: 'POST', token }),
    verifyEmail: (token, id) => request('/verify-email',    { query: { token, id } }),
    forgotPassword: (payload)=> request('/forgot-password', { method: 'POST', body: payload }),
    resetPassword: (payload) => request('/reset-password',  {
        method: 'POST',
        body:  { newPassword: payload.newPassword },
        query: { token: payload.token, id: payload.id }
    }),
    getProfile: (token) => request('/home', { token }),
    updateProfile: (data, token) =>
        request('/home/profile', { method: 'PATCH', body: data, token }),
    updateSharePreference: (shareWithHospital, token) =>
        request('/home/share-preference', { method: 'PATCH', body: { shareWithHospital }, token }),
};
