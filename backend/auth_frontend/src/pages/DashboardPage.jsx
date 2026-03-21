import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authConfig } from '../config/authConfig';

// Role → path inside main_frontend
const ROLE_HOME = {
    patient: '/patient/onboarding',
    asha:    '/asha/form',
    admin:   '/admin',
};

export const DashboardPage = () => {
    const navigate = useNavigate();
    const { user, authFetchHome, logout } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                const profile = await authFetchHome();
                // If main_frontend URL is configured, redirect there immediately
                if (authConfig.mainFrontendUrl) {
                    const rolePath = ROLE_HOME[profile?.user?.role] || '';
                    window.location.href = authConfig.mainFrontendUrl + rolePath;
                    return;
                }
            } catch (err) {
                setError(err.message || 'Unable to load account details');
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [authFetchHome]);

    const onLogout = async () => {
        await logout();
        navigate(authConfig.routes.login);
    };

    if (loading) {
        return <div className="loading-screen">Syncing your session...</div>;
    }

    return (
        <div className="dashboard-shell">
            <header>
                <p className="eyebrow">Authenticated</p>
                <h1>Welcome, {user?.username || 'User'}</h1>
                <p>Role: {user?.role || 'user'}</p>
            </header>

            {error ? <div className="status-banner">{error}</div> : null}

            <div className="dashboard-grid">
                <article>
                    <h2>Profile</h2>
                    <p>User ID: {user?._id}</p>
                    <p>Username: {user?.username}</p>
                    <p>Role: {user?.role}</p>
                </article>
                <article>
                    <h2>Reusable Integration Tips</h2>
                    <ul>
                        <li>Change VITE_API_BASE_URL for each project environment.</li>
                        <li>Keep endpoint names in authConfig if backend paths differ.</li>
                        <li>Drop these pages into any React Router app as a module.</li>
                    </ul>
                </article>
            </div>

            <button className="ghost-button" onClick={onLogout}>
                Sign Out
            </button>
        </div>
    );
};
