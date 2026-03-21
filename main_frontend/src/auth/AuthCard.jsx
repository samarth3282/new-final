/**
 * Shared card wrapper for all auth pages.
 * Styled with Tailwind + the existing CSS custom properties from index.css.
 */
export default function AuthCard({ title, subtitle, statusMessage, error, children }) {
    return (
        <div
            className="min-h-screen flex items-center justify-center px-4 py-12"
            style={{ background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-primary-light) 100%)' }}
        >
            <div className="w-full max-w-md">
                {/* Logo / brand */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
                        <rect x="16" y="8"  width="8" height="24" rx="2" fill="var(--color-danger)" />
                        <rect x="8"  y="16" width="24" height="8" rx="2" fill="var(--color-danger)" />
                    </svg>
                    <span className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        HealthBridge
                    </span>
                </div>

                <div
                    className="rounded-2xl shadow-lg p-8"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                    <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
                            {subtitle}
                        </p>
                    )}

                    {statusMessage && (
                        <div
                            className="rounded-lg px-4 py-3 mb-4 text-sm"
                            style={{
                                background: error ? 'var(--color-danger-light)' : 'var(--color-accent-light)',
                                color:      error ? 'var(--color-danger)'       : 'var(--color-accent)',
                                border:     `1px solid ${error ? 'var(--color-danger)' : 'var(--color-accent)'}20`
                            }}
                        >
                            {statusMessage}
                        </div>
                    )}

                    {children}
                </div>
            </div>
        </div>
    );
}
