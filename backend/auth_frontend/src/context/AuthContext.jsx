import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../services/authApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [accessToken, setAccessToken] = useState('');
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const hydrateSession = useCallback(async () => {
        try {
            const refreshData = await authApi.refreshToken();
            const freshToken = refreshData.accessToken;
            setAccessToken(freshToken);
            const profile = await authApi.getHome(freshToken);
            setUser(profile.user);
        } catch (error) {
            setAccessToken('');
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        hydrateSession();
    }, [hydrateSession]);

    const login = useCallback(async ({ identifier, password }) => {
        const data = await authApi.login({ identifier, password });
        setAccessToken(data.accessToken);
        const profile = await authApi.getHome(data.accessToken);
        setUser(profile.user);
        return profile.user;  // return full user so callers can read role
    }, []);

    const register = useCallback(async (payload) => {
        return authApi.register(payload);
    }, []);

    const logout = useCallback(async () => {
        try {
            await authApi.logout(accessToken || undefined);
        } finally {
            setAccessToken('');
            setUser(null);
        }
    }, [accessToken]);

    const authFetchHome = useCallback(async () => {
        if (!accessToken) {
            const refreshed = await authApi.refreshToken();
            setAccessToken(refreshed.accessToken);
            const profile = await authApi.getHome(refreshed.accessToken);
            setUser(profile.user);
            return profile;
        }

        try {
            const profile = await authApi.getHome(accessToken);
            setUser(profile.user);
            return profile;
        } catch (error) {
            if (error.status !== 401) {
                throw error;
            }

            const refreshed = await authApi.refreshToken();
            setAccessToken(refreshed.accessToken);
            const profile = await authApi.getHome(refreshed.accessToken);
            setUser(profile.user);
            return profile;
        }
    }, [accessToken]);

    const value = useMemo(() => ({
        accessToken,
        user,
        loading,
        login,
        register,
        logout,
        authFetchHome,
        forgotPassword: authApi.forgotPassword,
        resetPassword: authApi.resetPassword,
        verifyEmail: authApi.verifyEmail
    }), [accessToken, user, loading, login, register, logout, authFetchHome]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used inside AuthProvider');
    }
    return context;
};
