import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { authConfig } from './authConfig';
import AuthCard from './AuthCard';

export default function LoginPage() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [form, setForm]           = useState({ identifier: '', password: '' });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError]         = useState('');

    const onChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const onSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const user = await login(form);
            // Redirect based on role
            const dest = authConfig.roleHome[user?.role] || '/';
            navigate(dest, { replace: true });
        } catch (err) {
            setError(err.message || 'Unable to sign in');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthCard title="Welcome Back" subtitle="Sign in to your HealthBridge account." statusMessage={error} error>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        Username or Email
                    </span>
                    <input
                        name="identifier"
                        type="text"
                        placeholder="jane_doe or jane@example.com"
                        value={form.identifier}
                        onChange={onChange}
                        required
                        autoComplete="username"
                        className="rounded-lg px-3 py-2 text-sm outline-none"
                        style={{
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface-2)',
                            color: 'var(--color-text-primary)'
                        }}
                    />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        Password
                    </span>
                    <input
                        name="password"
                        type="password"
                        placeholder="Enter your password"
                        value={form.password}
                        onChange={onChange}
                        required
                        autoComplete="current-password"
                        className="rounded-lg px-3 py-2 text-sm outline-none"
                        style={{
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface-2)',
                            color: 'var(--color-text-primary)'
                        }}
                    />
                </label>

                <button
                    type="submit"
                    disabled={submitting}
                    className="mt-2 rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
                    style={{ background: 'var(--color-primary)', color: '#fff' }}
                >
                    {submitting ? 'Signing in…' : 'Sign In'}
                </button>
            </form>

            <div className="mt-4 flex flex-col gap-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <p>
                    Forgot password?{' '}
                    <Link to={authConfig.routes.forgotPassword} className="underline" style={{ color: 'var(--color-primary)' }}>
                        Reset it
                    </Link>
                </p>
                <p>
                    No account yet?{' '}
                    <Link to={authConfig.routes.register} className="underline" style={{ color: 'var(--color-primary)' }}>
                        Create one
                    </Link>
                </p>
            </div>
        </AuthCard>
    );
}
