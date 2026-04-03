import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HiOutlineMail, HiArrowLeft, HiCheckCircle } from 'react-icons/hi';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const { resetPassword } = useAuth();

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (!email) return;

        setLoading(true);
        try {
            await resetPassword(email);
            // Always show success — don't reveal if email exists in the system
            setSent(true);
        } catch (err) {
            // Show generic error without leaking system info
            setError('Something went wrong. Please try again later.');
            console.error('Password reset error:', err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-card__header">
                    <div className="auth-card__logo">
                        {sent
                            ? <HiCheckCircle style={{ fontSize: '1.8rem', color: '#fff' }} />
                            : <HiOutlineMail style={{ fontSize: '1.8rem', color: '#fff' }} />
                        }
                    </div>
                    <h1>{sent ? 'Check Your Email' : 'Forgot Password?'}</h1>
                    <p>
                        {sent
                            ? `We've sent a password reset link to ${email}. Please check your inbox.`
                            : "Enter your admin email address and we'll send you a secure reset link."
                        }
                    </p>
                </div>

                {!sent ? (
                    <>
                        {error && (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                borderRadius: 'var(--radius-md)',
                                padding: '12px 16px',
                                marginBottom: '20px',
                                color: 'var(--danger)',
                                fontSize: '0.85rem',
                            }}>
                                {error}
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="auth-form">
                            <div className="form-group">
                                <label htmlFor="forgot-email">Email Address</label>
                                <input
                                    id="forgot-email"
                                    type="email"
                                    className="form-input"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@example.com"
                                    required
                                    autoFocus
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn btn--primary btn--full"
                                disabled={loading}
                            >
                                {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
                            </button>
                        </form>
                    </>
                ) : (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            background: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            borderRadius: 'var(--radius-md)',
                            padding: '16px',
                            marginBottom: '24px',
                            color: 'var(--success)',
                            fontSize: '0.85rem',
                            lineHeight: '1.6',
                        }}>
                            The link expires in 1 hour. If you don't see the email, check your spam folder.
                        </div>
                        <button
                            onClick={() => { setSent(false); setEmail(''); }}
                            className="btn btn--ghost btn--full"
                        >
                            Send to a different email
                        </button>
                    </div>
                )}

                <div className="auth-card__footer">
                    <p>
                        <Link to="/login" className="auth-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                            <HiArrowLeft /> Back to Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
