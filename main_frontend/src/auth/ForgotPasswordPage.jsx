import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { authConfig } from './authConfig';
import AuthCard from './AuthCard';

export default function ForgotPasswordPage() {
    const { forgotPassword } = useAuth();
    const [email, setEmail]         = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage]     = useState('');
    const [isError, setIsError]     = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setSubmitting(true);
        try {
            const data = await forgotPassword({ email });
            setIsError(false);
            setMessage(data.message || 'If that email exists, a reset link has been sent.');
        } catch (err) {
            setIsError(true);
            setMessage(err.message || 'Unable to process request right now');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthCard
            title="Forgot Password"
            subtitle="Enter your email and we'll send you a reset link."
            statusMessage={message}
            error={isError}
        >
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Email</span>
                    <input
                        type="email"
                        placeholder="jane@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        autoComplete="email"
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
                    {submitting ? 'Sending reset link…' : 'Send Reset Link'}
                </button>
            </form>
            <p className="mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Back to{' '}
                <Link to={authConfig.routes.login} className="underline" style={{ color: 'var(--color-primary)' }}>
                    Sign in
                </Link>
            </p>
        </AuthCard>
    );
}
