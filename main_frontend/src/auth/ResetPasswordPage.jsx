import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { authConfig } from './authConfig';
import AuthCard from './AuthCard';

export default function ResetPasswordPage() {
    const { resetPassword } = useAuth();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const id    = searchParams.get('id')    || '';

    const hasValidLink = useMemo(() => token && id, [token, id]);
    const [newPassword, setNewPassword] = useState('');
    const [submitting, setSubmitting]   = useState(false);
    const [message, setMessage]         = useState('');
    const [isError, setIsError]         = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setSubmitting(true);
        try {
            const data = await resetPassword({ token, id, newPassword });
            setIsError(false);
            setMessage(data.message || 'Password reset! You can now sign in.');
            setNewPassword('');
        } catch (err) {
            setIsError(true);
            setMessage(err.message || 'Unable to reset password');
        } finally {
            setSubmitting(false);
        }
    };

    if (!hasValidLink) {
        return (
            <AuthCard
                title="Reset Password"
                subtitle="Open the reset link from your email."
                statusMessage="The reset URL is missing required parameters."
                error
            >
                <p className="mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Go to{' '}
                    <Link to={authConfig.routes.forgotPassword} className="underline" style={{ color: 'var(--color-primary)' }}>
                        Forgot Password
                    </Link>
                </p>
            </AuthCard>
        );
    }

    return (
        <AuthCard
            title="Set New Password"
            subtitle="Choose a strong password to protect your account."
            statusMessage={message}
            error={isError}
        >
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>New Password</span>
                    <input
                        type="password"
                        placeholder="Min 8 chars with A-Z, 0-9 & symbol"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        required
                        autoComplete="new-password"
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
                    {submitting ? 'Updating password…' : 'Reset Password'}
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
