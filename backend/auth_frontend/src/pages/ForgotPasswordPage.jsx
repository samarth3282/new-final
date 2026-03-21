import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { authConfig } from '../config/authConfig';

export const ForgotPasswordPage = () => {
    const { forgotPassword } = useAuth();
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    const onSubmit = async (event) => {
        event.preventDefault();
        setMessage('');
        setSubmitting(true);

        try {
            const data = await forgotPassword({ email });
            setMessage(data.message || 'If this email exists, a reset link has been sent.');
        } catch (error) {
            setMessage(error.message || 'Unable to process request right now');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout
            title="Forgot Password"
            subtitle="Request a secure reset link sent to your inbox."
            statusMessage={message}
        >
            <form className="auth-form" onSubmit={onSubmit}>
                <FormField
                    id="email"
                    type="email"
                    label="Email"
                    placeholder="jane@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                />
                <button className="primary-button" type="submit" disabled={submitting}>
                    {submitting ? 'Sending reset link...' : 'Send Reset Link'}
                </button>
            </form>
            <p className="inline-link">
                Back to <Link to={authConfig.routes.login}>Sign in</Link>
            </p>
        </AuthLayout>
    );
};
