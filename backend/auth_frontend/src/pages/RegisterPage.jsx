import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { authConfig } from '../config/authConfig';

const ROLES = [
    { value: 'patient', label: 'Patient' },
    { value: 'asha',    label: 'ASHA Worker' },
];

export const RegisterPage = () => {
    const { register } = useAuth();
    const [form, setForm] = useState({ username: '', email: '', password: '', role: 'patient' });
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    const onSubmit = async (event) => {
        event.preventDefault();
        setMessage('');
        setSubmitting(true);

        try {
            const data = await register(form);
            setMessage(data.message || 'Registration complete. Check your email to verify your account.');
            setForm({ username: '', email: '', password: '', role: 'patient' });
        } catch (error) {
            setMessage(error.message || 'Registration failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout
            title="Create Account"
            subtitle="Choose your role and complete registration."
            statusMessage={message}
        >
            <form className="auth-form" onSubmit={onSubmit}>
                {/* Role selector */}
                <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Role</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {ROLES.map(r => (
                            <button
                                key={r.value}
                                type="button"
                                onClick={() => setForm(prev => ({ ...prev, role: r.value }))}
                                className={form.role === r.value ? 'primary-button' : 'secondary-button'}
                                style={{ flex: 1, padding: '8px' }}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                </div>

                <FormField
                    id="username"
                    label="Username"
                    placeholder="jane_doe"
                    value={form.username}
                    onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                    autoComplete="username"
                />
                <FormField
                    id="email"
                    type="email"
                    label="Email"
                    placeholder="jane@example.com"
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    autoComplete="email"
                />
                <FormField
                    id="password"
                    type="password"
                    label="Password"
                    placeholder="Min 8 chars with upper/lower/number/symbol"
                    value={form.password}
                    onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                    autoComplete="new-password"
                />
                <button className="primary-button" type="submit" disabled={submitting}>
                    {submitting ? 'Creating account...' : 'Register'}
                </button>
            </form>
            <p className="inline-link">
                Already registered? <Link to={authConfig.routes.login}>Sign in</Link>
            </p>
        </AuthLayout>
    );
};
                />
                <button className="primary-button" type="submit" disabled={submitting}>
                    {submitting ? 'Creating account...' : 'Register'}
                </button>
            </form>
            <p className="inline-link">
                Already registered? <Link to={authConfig.routes.login}>Sign in</Link>
            </p>
        </AuthLayout>
    );
};
