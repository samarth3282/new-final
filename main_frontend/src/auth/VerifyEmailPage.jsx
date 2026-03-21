import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { authConfig } from './authConfig';
import AuthCard from './AuthCard';

export default function VerifyEmailPage() {
    const { verifyEmail } = useAuth();
    const [searchParams] = useSearchParams();
    const [message, setMessage] = useState('Verifying your email…');
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        const run = async () => {
            const token = searchParams.get('token');
            const id    = searchParams.get('id');
            if (!token || !id) {
                setIsError(true);
                setMessage('Verification link is missing required parameters.');
                return;
            }
            try {
                const data = await verifyEmail(token, id);
                setIsError(false);
                setMessage(data.message || 'Email verified successfully!');
            } catch (err) {
                setIsError(true);
                setMessage(err.message || 'Email verification failed.');
            }
        };
        run();
    }, [searchParams, verifyEmail]);

    return (
        <AuthCard title="Verify Email" subtitle="Validating your verification link." statusMessage={message} error={isError}>
            <p className="mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Continue to{' '}
                <Link to={authConfig.routes.login} className="underline" style={{ color: 'var(--color-primary)' }}>
                    Sign in
                </Link>
            </p>
        </AuthCard>
    );
}
