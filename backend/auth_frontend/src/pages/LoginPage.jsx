import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authConfig } from '../config/authConfig';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';

// Role → path inside main_frontend
const ROLE_HOME = {
    patient: '/patient/onboarding',
    asha:    '/asha/form',
    admin:   '/admin',
};

export const LoginPage = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [form, setForm] = useState({ identifier: '', password: '' });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const onSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const loggedInUser = await login(form);
            // After login the AuthContext fetches /home and sets user (with role).
            // Redirect to the main frontend so users land on the correct role page.
            const rolePath = ROLE_HOME[loggedInUser?.role] || '';
            window.location.href = authConfig.mainFrontendUrl + rolePath;
        } catch (err) {
            setError(err.message || 'Unable to sign in');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout
            title="Welcome Back"
            subtitle="Use your username or email to access your account."
            statusMessage={error}
        >
            <form className="auth-form" onSubmit={onSubmit}>
                <FormField
                    id="identifier"
                    label="Username or Email"
                    placeholder="jane_doe or jane@example.com"
                    value={form.identifier}
                    onChange={(event) => setForm((prev) => ({ ...prev, identifier: event.target.value }))}
                    autoComplete="username"
                />
                <FormField
                    id="password"
                    type="password"
                    label="Password"
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                    autoComplete="current-password"
                />
                <button className="primary-button" type="submit" disabled={submitting}>
                    {submitting ? 'Signing in...' : 'Sign In'}
                </button>
            </form>
            <p className="inline-link">
                Forgot password? <Link to={authConfig.routes.forgotPassword}>Reset it</Link>
            </p>
            <p className="inline-link">
                No account yet? <Link to={authConfig.routes.register}>Create one</Link>
            </p>
        </AuthLayout>
    );
};
