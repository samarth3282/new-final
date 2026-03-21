import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { authConfig } from '../config/authConfig';

export const VerifyEmailPage = () => {
    const { verifyEmail } = useAuth();
    const [searchParams] = useSearchParams();
    const [message, setMessage] = useState('Verifying your email...');

    useEffect(() => {
        const runVerification = async () => {
            const token = searchParams.get('token');
            const id = searchParams.get('id');

            if (!token || !id) {
                setMessage('Verification link is missing required parameters.');
                return;
            }

            try {
                const data = await verifyEmail(token, id);
                setMessage(data.message || 'Email verified successfully.');
            } catch (error) {
                setMessage(error.message || 'Email verification failed.');
            }
        };

        runVerification();
    }, [searchParams, verifyEmail]);

    return (
        <AuthLayout
            title="Verify Email"
            subtitle="This page validates your verification link."
            statusMessage={message}
        >
            <p className="inline-link">
                Continue to <Link to={authConfig.routes.login}>Sign in</Link>
            </p>
        </AuthLayout>
    );
};
