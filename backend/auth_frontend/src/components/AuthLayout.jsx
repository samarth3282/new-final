import { Link } from 'react-router-dom';
import { authConfig } from '../config/authConfig';

const links = [
    { to: authConfig.routes.login, label: 'Sign In' },
    { to: authConfig.routes.register, label: 'Create Account' },
    { to: authConfig.routes.forgotPassword, label: 'Reset Password' }
];

export const AuthLayout = ({ title, subtitle, children, statusMessage }) => {
    return (
        <div className="auth-shell">
            <section className="brand-panel">
                <div className="brand-mark">A</div>
                <h1>Atlas Auth Kit</h1>
                <p>
                    Reusable, API-driven authentication screens for modern React apps.
                </p>
                <nav className="quick-links" aria-label="Auth links">
                    {links.map((item) => (
                        <Link key={item.to} to={item.to}>
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </section>

            <section className="auth-panel">
                <div className="auth-card">
                    <header>
                        <h2>{title}</h2>
                        <p>{subtitle}</p>
                    </header>
                    {statusMessage ? <div className="status-banner">{statusMessage}</div> : null}
                    {children}
                </div>
            </section>
        </div>
    );
};
