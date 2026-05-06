import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        if (!email || !password) return;

        setLoading(true);
        try {
            await signIn(email, password);
            toast.success('Welcome back!');
            navigate('/');
        } catch (err) {
            // Provide a more helpful message for the most common errors
            const msg = err.message || '';
            if (msg.toLowerCase().includes('email not confirmed')) {
                toast.error('Please confirm your email address first. Check your inbox.');
            } else if (msg.toLowerCase().includes('invalid login credentials') || msg.toLowerCase().includes('invalid credentials')) {
                toast.error('Incorrect email or password. Please try again.');
            } else if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many')) {
                toast.error('Too many login attempts. Please wait a moment and try again.');
            } else if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || !navigator.onLine) {
                toast.error('Network error. Please check your connection and try again.');
            } else {
                toast.error(msg || 'Sign in failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-card__header">
                    <div className="auth-card__logo">
                        <span>S</span>
                    </div>
                    <h1>Welcome Back</h1>
                    <p>Sign in to your admin dashboard</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="login-email">Email</label>
                        <input
                            id="login-email"
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@example.com"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label htmlFor="login-password">Password</label>
                            <Link
                                to="/forgot-password"
                                className="auth-link"
                                style={{ fontSize: '0.78rem', fontWeight: '500' }}
                            >
                                Forgot Password?
                            </Link>
                        </div>
                        <input
                            id="login-password"
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn--primary btn--full"
                        disabled={loading}
                    >
                        {loading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>

                <div className="auth-card__footer">
                    <p>
                        Don't have an account?{' '}
                        <Link to="/register" className="auth-link">Sign Up</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
