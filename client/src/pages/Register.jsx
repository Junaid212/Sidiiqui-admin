import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { HiCheckCircle } from 'react-icons/hi';


export default function Register() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [confirmSent, setConfirmSent] = useState(false);
    const [resending, setResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const { signUp, resendConfirmation } = useAuth();
    const navigate = useNavigate();

    // Basic email format validation
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!email || !password) return;

        if (!isValidEmail(email)) {
            toast.error('Please enter a valid email address');
            return;
        }

        if (password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            const data = await signUp(email, password, fullName);

            if (data?.session) {
                // Server auto-confirmed the user and returned a session — signed in immediately
                toast.success('Account created successfully! Welcome aboard.');
                navigate('/');
            } else if (data?.user) {
                // User created but no session returned — redirect to login
                toast.success('Account created! Please sign in to continue.');
                navigate('/login');
            }
        } catch (err) {
            const msg = (err.message || '').toLowerCase();
            if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('already exists') || msg.includes('user already')) {
                toast.error('This email is already registered. Try signing in instead.');
            } else if (msg.includes('rate limit') || msg.includes('too many')) {
                toast.error('Too many attempts. Please wait a moment and try again.');
            } else if (msg.includes('invalid email') || msg.includes('email is invalid')) {
                toast.error('Please enter a valid email address.');
            } else if (msg.includes('password') && msg.includes('weak')) {
                toast.error('Password is too weak. Use at least 6 characters.');
            } else {
                toast.error(err.message || 'Sign up failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }

    async function handleResendEmail() {
        if (resendCooldown > 0 || resending) return;

        setResending(true);
        try {
            await resendConfirmation(email);
            toast.success('Verification email resent! Check your inbox.');
            // Start 60-second cooldown
            setResendCooldown(60);
            const interval = setInterval(() => {
                setResendCooldown(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (err) {
            const msg = err.message || '';
            if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many')) {
                toast.error('Please wait before requesting another email.');
            } else {
                toast.error('Failed to resend email. Please try again.');
            }
            console.error('Resend confirmation error:', err);
        } finally {
            setResending(false);
        }
    }

    // Email confirmation sent screen
    if (confirmSent) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <div className="auth-card__header">
                        <div className="auth-card__logo">
                            <HiCheckCircle style={{ fontSize: '1.8rem', color: '#fff' }} />
                        </div>
                        <h1>Check Your Email</h1>
                        <p>We've sent a confirmation link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong></p>
                    </div>

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
                        Click the confirmation link in your email to activate your account. 
                        Check your spam folder if you don't see it within a few minutes.
                    </div>

                    <button
                        onClick={handleResendEmail}
                        className="btn btn--outline btn--full"
                        disabled={resending || resendCooldown > 0}
                        style={{ marginBottom: '12px' }}
                    >
                        {resending
                            ? 'Sending...'
                            : resendCooldown > 0
                                ? `Resend available in ${resendCooldown}s`
                                : 'Resend Verification Email'
                        }
                    </button>

                    <button
                        onClick={() => { setConfirmSent(false); setEmail(''); setPassword(''); setFullName(''); }}
                        className="btn btn--ghost btn--full"
                    >
                        Use a different email
                    </button>

                    <div className="auth-card__footer">
                        <p>
                            Already confirmed?{' '}
                            <Link to="/login" className="auth-link">Sign In</Link>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-card__header">
                    <div className="auth-card__logo">
                        <span>S</span>
                    </div>
                    <h1>Create Account</h1>
                    <p>Set up your admin access</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="register-name">Full Name</label>
                        <input
                            id="register-name"
                            type="text"
                            className="form-input"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="John Doe"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="register-email">Email</label>
                        <input
                            id="register-email"
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@example.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="register-password">Password</label>
                        <input
                            id="register-password"
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min 6 characters"
                            required
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn--primary btn--full"
                        disabled={loading}
                    >
                        {loading ? 'Creating Account...' : 'Sign Up'}
                    </button>
                </form>

                <div className="auth-card__footer">
                    <p>
                        Already have an account?{' '}
                        <Link to="/login" className="auth-link">Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
