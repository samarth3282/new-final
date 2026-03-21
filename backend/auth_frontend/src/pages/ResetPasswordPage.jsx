import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { authConfig } from '../config/authConfig';

export const ResetPasswordPage = () => {
    const { resetPassword } = useAuth();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const id = searchParams.get('id') || '';

    const hasValidLink = useMemo(() => token && id, [token, id]);
    const [newPassword, setNewPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    const onSubmit = async (event) => {
        event.preventDefault();
        setMessage('');
        setSubmitting(true);

        try {
            const data = await resetPassword({ token, id, newPassword });
            setMessage(data.message || 'Password reset complete. You can sign in now.');
            setNewPassword('');
        } catch (error) {
            setMessage(error.message || 'Unable to reset password');
        } finally {
            setSubmitting(false);
        }
    };

    if (!hasValidLink) {
        return (
            <AuthLayout
                title="Reset Password"
                subtitle="The password reset URL is missing required parameters."
                statusMessage="Open the reset link from your email again."
            >
                <p className="inline-link">
                    Go to <Link to={authConfig.routes.forgotPassword}>Forgot Password</Link>
                </p>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Set New Password"
            subtitle="Choose a strong password to protect your account."
            statusMessage={message}
        >
            <form className="auth-form" onSubmit={onSubmit}>
                <FormField
                    id="newPassword"
                    type="password"
                    label="New Password"
                    placeholder="Min 8 chars with upper/lower/number/symbol"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                />
                <button className="primary-button" type="submit" disabled={submitting}>
                    {submitting ? 'Updating password...' : 'Reset Password'}
                </button>
            </form>
            <p className="inline-link">
                Back to <Link to={authConfig.routes.login}>Sign in</Link>
            </p>
        </AuthLayout>
    );
};
