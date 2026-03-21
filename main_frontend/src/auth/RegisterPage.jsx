import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { authConfig } from './authConfig';
import AuthCard from './AuthCard';

const ROLES = [
    {
        value: 'patient',
        label: 'Patient',
        desc:  'I want to check my symptoms and find care',
    },
    {
        value: 'asha',
        label: 'ASHA Worker',
        desc:  'Community health worker supporting patients',
    },
    {
        value: 'admin',
        label: 'Admin',
        desc:  'System administrator — requires pre-authorization',
    },
];

const inputStyle = {
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    color: 'var(--color-text-primary)'
};

export default function RegisterPage() {
    const { register } = useAuth();
    const [form, setForm] = useState({
        username: '', email: '', password: '', role: 'patient',
        workerCode: '', lastName: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage]       = useState('');
    const [isError, setIsError]       = useState(false);

    const isRestricted = form.role === 'asha' || form.role === 'admin';

    const onChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const selectRole = (role) => {
        setForm(prev => ({ ...prev, role, workerCode: '', lastName: '' }));
        setMessage('');
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setSubmitting(true);
        try {
            // Only send workerCode/lastName for restricted roles
            const payload = isRestricted
                ? form
                : { username: form.username, email: form.email, password: form.password, role: form.role };
            const data = await register(payload);
            setIsError(false);
            setMessage(data.message || 'Registration complete! Check your email to verify your account.');
            setForm({ username: '', email: '', password: '', role: 'patient', workerCode: '', lastName: '' });
        } catch (err) {
            setIsError(true);
            setMessage(err.message || 'Registration failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthCard
            title="Create Account"
            subtitle="Join HealthBridge — choose your role to get started."
            statusMessage={message}
            error={isError}
        >
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
                {/* Role selector */}
                <div className="flex gap-2">
                    {ROLES.map(r => (
                        <button
                            key={r.value}
                            type="button"
                            onClick={() => selectRole(r.value)}
                            className="flex-1 rounded-xl p-3 text-left transition-all"
                            style={{
                                border: `2px solid ${form.role === r.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                background: form.role === r.value ? 'var(--color-primary-light)' : 'var(--color-surface-2)',
                            }}
                        >
                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{r.label}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{r.desc}</p>
                        </button>
                    ))}
                </div>

                {/* Standard fields */}
                {[
                    { name: 'username', label: 'Username',  type: 'text',     placeholder: 'jane_doe',   autoComplete: 'username',     hint: 'Letters, numbers and underscores only — no spaces', pattern: '[a-zA-Z0-9_]+' },
                    { name: 'email',    label: 'Email',     type: 'email',    placeholder: 'jane@example.com', autoComplete: 'email' },
                    { name: 'password', label: 'Password',  type: 'password', placeholder: 'Min 8 chars with A-Z, 0-9 & symbol', autoComplete: 'new-password', hint: 'Must include uppercase, lowercase, a number and a special character' },
                ].map(f => (
                    <label key={f.name} className="flex flex-col gap-1">
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{f.label}</span>
                        <input
                            name={f.name}
                            type={f.type}
                            placeholder={f.placeholder}
                            value={form[f.name]}
                            onChange={onChange}
                            required
                            autoComplete={f.autoComplete}
                            {...(f.pattern ? { pattern: f.pattern, title: f.hint } : {})}
                            className="rounded-lg px-3 py-2 text-sm outline-none"
                            style={inputStyle}
                        />
                        {f.hint && (
                            <span className="text-xs" style={{ color: 'var(--color-text-hint)' }}>{f.hint}</span>
                        )}
                    </label>
                ))}

                {/* Pre-authorization fields — only for ASHA worker / Admin */}
                {isRestricted && (
                    <div
                        className="flex flex-col gap-3 rounded-xl p-4"
                        style={{ background: 'var(--color-warning-light)', border: '1px solid var(--color-warning)' }}
                    >
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-warning)' }}>
                            🔒 Pre-authorization required — enter the details issued to you by your administrator
                        </p>

                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                {form.role === 'admin' ? 'Admin Code' : 'ASHA Worker Code'}
                            </span>
                            <input
                                name="workerCode"
                                type="text"
                                placeholder={form.role === 'admin' ? 'e.g. ADM001' : 'e.g. ASHA001'}
                                value={form.workerCode}
                                onChange={onChange}
                                required
                                autoComplete="off"
                                className="rounded-lg px-3 py-2 text-sm outline-none"
                                style={inputStyle}
                            />
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                Last Name (as registered)
                            </span>
                            <input
                                name="lastName"
                                type="text"
                                placeholder="e.g. Sharma"
                                value={form.lastName}
                                onChange={onChange}
                                required
                                autoComplete="family-name"
                                className="rounded-lg px-3 py-2 text-sm outline-none"
                                style={inputStyle}
                            />
                        </label>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className="mt-2 rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
                    style={{ background: 'var(--color-primary)', color: '#fff' }}
                >
                    {submitting ? 'Creating account…' : 'Register'}
                </button>
            </form>

            <p className="mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Already registered?{' '}
                <Link to={authConfig.routes.login} className="underline" style={{ color: 'var(--color-primary)' }}>
                    Sign in
                </Link>
            </p>
        </AuthCard>
    );
}
