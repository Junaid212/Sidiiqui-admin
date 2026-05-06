import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { HiLockClosed, HiEye, HiEyeOff, HiCheckCircle } from 'react-icons/hi';

/**
 * Password strength checker — returns 0-4
 */
function getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'];

export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');
    const [sessionReady, setSessionReady] = useState(false);

    const { updatePassword } = useAuth();
    const navigate = useNavigate();

    const strength = getPasswordStrength(password);

    // Supabase sends the recovery token in the URL hash — wait for the session
    useEffect(() => {
        let settled = false;

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            // PASSWORD_RECOVERY = user clicked the reset link from email
            // SIGNED_IN = Supabase exchanged the token and signed in the user
            if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
                settled = true;
                setSessionReady(true);
            }
        });

        // Check if we already have a valid session (e.g. user refreshed this page)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                settled = true;
                setSessionReady(true);
            }
        });

        // Timeout fallback — if no auth event fires within 6s, stop spinning
        const timer = setTimeout(() => {
            if (!settled) {
                setSessionReady(false);
                setError('Reset link is invalid or has expired. Please request a new one.');
            }
        }, 6000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(timer);
        };
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            return setError('Password must be at least 8 characters.');
        }
        if (password !== confirm) {
            return setError('Passwords do not match.');
        }
        if (strength < 2) {
            return setError('Please choose a stronger password.');
        }

        setLoading(true);
        try {
            await updatePassword(password);
            setDone(true);
            // Redirect to login after 3 seconds
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setError(err.message || 'Failed to update password. The link may have expired.');
        } finally {
            setLoading(false);
        }
    }

    if (!sessionReady) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <div className="auth-card__header">
                        <div className="auth-card__logo">
                            <HiLockClosed style={{ fontSize: '1.8rem', color: '#fff' }} />
                        </div>
                        <h1>{error ? 'Link Expired' : 'Verifying Link'}</h1>
                        <p>
                            {error
                                ? error
                                : 'Please wait while we verify your reset link...'
                            }
                        </p>
                    </div>
                    {!error && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                            <div className="spinner" />
                        </div>
                    )}
                    <div className="auth-card__footer">
                        <p>
                            <Link to="/forgot-password" className="auth-link">Request a new reset link</Link>
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
                        {done
                            ? <HiCheckCircle style={{ fontSize: '1.8rem', color: '#fff' }} />
                            : <HiLockClosed style={{ fontSize: '1.8rem', color: '#fff' }} />
                        }
                    </div>
                    <h1>{done ? 'Password Updated!' : 'Reset Password'}</h1>
                    <p>
                        {done
                            ? 'Your password has been updated successfully. Redirecting you to sign in...'
                            : 'Choose a new secure password for your admin account.'
                        }
                    </p>
                </div>

                {done ? (
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: 'var(--radius-md)',
                        padding: '16px',
                        textAlign: 'center',
                        color: 'var(--success)',
                        fontSize: '0.9rem',
                    }}>
                        ✅ Redirecting to login page...
                    </div>
                ) : (
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
                            {/* New Password */}
                            <div className="form-group">
                                <label htmlFor="reset-password">New Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        id="reset-password"
                                        type={showPassword ? 'text' : 'password'}
                                        className="form-input"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Min. 8 characters"
                                        required
                                        autoFocus
                                        style={{ paddingRight: '44px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        style={{
                                            position: 'absolute', right: '12px', top: '50%',
                                            transform: 'translateY(-50%)', background: 'none',
                                            border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                                            padding: '4px', fontSize: '1.1rem',
                                        }}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <HiEyeOff /> : <HiEye />}
                                    </button>
                                </div>

                                {/* Strength meter */}
                                {password && (
                                    <div style={{ marginTop: '8px' }}>
                                        <div style={{
                                            display: 'flex', gap: '4px', marginBottom: '4px',
                                        }}>
                                            {[1, 2, 3, 4].map(i => (
                                                <div key={i} style={{
                                                    flex: 1, height: '4px',
                                                    borderRadius: '2px',
                                                    background: i <= strength
                                                        ? STRENGTH_COLORS[strength]
                                                        : 'var(--border-color)',
                                                    transition: 'background 0.3s ease',
                                                }} />
                                            ))}
                                        </div>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            color: STRENGTH_COLORS[strength] || 'var(--text-muted)',
                                            fontWeight: '600',
                                        }}>
                                            {STRENGTH_LABELS[strength]}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div className="form-group">
                                <label htmlFor="reset-confirm">Confirm Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        id="reset-confirm"
                                        type={showConfirm ? 'text' : 'password'}
                                        className="form-input"
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        placeholder="Re-enter your password"
                                        required
                                        style={{
                                            paddingRight: '44px',
                                            borderColor: confirm && password !== confirm
                                                ? 'rgba(239, 68, 68, 0.5)'
                                                : confirm && password === confirm
                                                    ? 'rgba(16, 185, 129, 0.5)'
                                                    : undefined,
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(v => !v)}
                                        style={{
                                            position: 'absolute', right: '12px', top: '50%',
                                            transform: 'translateY(-50%)', background: 'none',
                                            border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                                            padding: '4px', fontSize: '1.1rem',
                                        }}
                                        tabIndex={-1}
                                    >
                                        {showConfirm ? <HiEyeOff /> : <HiEye />}
                                    </button>
                                </div>
                                {confirm && password !== confirm && (
                                    <span style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>
                                        Passwords do not match
                                    </span>
                                )}
                                {confirm && password === confirm && password.length >= 8 && (
                                    <span style={{ fontSize: '0.78rem', color: 'var(--success)' }}>
                                        ✓ Passwords match
                                    </span>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="btn btn--primary btn--full"
                                disabled={loading || !password || !confirm}
                            >
                                {loading ? 'Updating Password...' : 'Update Password'}
                            </button>
                        </form>
                    </>
                )}

                <div className="auth-card__footer">
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        Remember your password?{' '}
                        <Link to="/login" className="auth-link">Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
