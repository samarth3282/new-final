import { useEffect, useRef, useState } from 'react';
import './CookieConsentModal.css';

export const CookieConsentModal = ({ onAccept }) => {
    const acceptButtonRef = useRef(null);
    const dialogRef = useRef(null);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        acceptButtonRef.current?.focus();

        const onKeyDown = (event) => {
            if (event.key !== 'Tab') {
                return;
            }

            const focusableNodes = dialogRef.current?.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );

            if (!focusableNodes || focusableNodes.length === 0) {
                return;
            }

            const first = focusableNodes[0];
            const last = focusableNodes[focusableNodes.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    return (
        <div className="consent-overlay" role="presentation">
            <section
                className="consent-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="consent-title"
                aria-describedby="consent-description"
                ref={dialogRef}
            >
                <p className="consent-trust-pill">Secure and Privacy-Focused</p>
                <h2 id="consent-title">We Use Cookies to Improve Your Experience</h2>
                <p id="consent-description">
                    We use third-party cookies only to support authentication and session management.
                    This keeps your login secure and helps you stay signed in without interruptions.
                </p>

                <div className="consent-points">
                    <p>Third-party cookies are used to:</p>
                    <ul>
                        <li>Keep your session active after login.</li>
                        <li>Protect account access and sign-in flow.</li>
                        <li>Support app functionality with no extra tracking.</li>
                    </ul>
                </div>

                <div className="consent-actions">
                    <button className="consent-btn consent-btn-primary" onClick={onAccept} ref={acceptButtonRef}>
                        Accept and Continue
                    </button>
                    <button
                        className="consent-btn consent-btn-secondary"
                        onClick={() => setShowDetails((prev) => !prev)}
                        aria-expanded={showDetails}
                        aria-controls="consent-details"
                    >
                        {showDetails ? 'Hide Details' : 'Learn More'}
                    </button>
                </div>

                {showDetails ? (
                    <div className="consent-details" id="consent-details">
                        <p>
                            These cookies are required for sign-in reliability, token refresh, and session continuity.
                            They are not used for ad personalization.
                        </p>
                        <a href="#" className="consent-policy-link" onClick={(event) => event.preventDefault()}>
                            Privacy Policy
                        </a>
                    </div>
                ) : null}
            </section>
        </div>
    );
};
