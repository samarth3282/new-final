import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from './authApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [accessToken, setAccessToken] = useState('');
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // On mount, try to restore session using the httpOnly refresh-token cookie
    const hydrateSession = useCallback(async () => {
        try {
            const refreshData = await authApi.refreshToken();
            const freshToken = refreshData.accessToken;
            setAccessToken(freshToken);
            const profile = await authApi.getProfile(freshToken);
            setUser(profile.user);
        } catch {
            setAccessToken('');
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { hydrateSession(); }, [hydrateSession]);

    const login = useCallback(async ({ identifier, password }) => {
        const data = await authApi.login({ identifier, password });
        setAccessToken(data.accessToken);
        const profile = await authApi.getProfile(data.accessToken);
        setUser(profile.user);
        return profile.user;   // returns full user so caller can route by role
    }, []);

    const register = useCallback(async (payload) => authApi.register(payload), []);

    const logout = useCallback(async () => {
        try { await authApi.logout(accessToken || undefined); } finally {
            setAccessToken('');
            setUser(null);
        }
    }, [accessToken]);

    // Refresh the in-memory user profile from the server
    const refreshProfile = useCallback(async () => {
        let token = accessToken;
        if (!token) {
            const refreshed = await authApi.refreshToken();
            token = refreshed.accessToken;
            setAccessToken(token);
        }
        const profile = await authApi.getProfile(token);
        setUser(profile.user);
        return profile.user;
    }, [accessToken]);

    const value = useMemo(() => ({
        accessToken,
        user,
        loading,
        login,
        register,
        logout,
        refreshProfile,
        forgotPassword: authApi.forgotPassword,
        resetPassword:  authApi.resetPassword,
        verifyEmail:    authApi.verifyEmail,
    }), [accessToken, user, loading, login, register, logout, refreshProfile]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
};
