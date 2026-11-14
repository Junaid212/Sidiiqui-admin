import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../config/supabase';

const AuthContext = createContext(null);

// Determine the correct reset-password URL for both dev and production
const getResetRedirectUrl = () => {
    const origin = window.location.origin;
    return `${origin}/reset-password`;
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    // 'unknown' until the server has confirmed whether this session belongs to an ADMINISTRATOR.
    // A customer can hold a perfectly valid session on this shared Supabase project, so being
    // signed in is not enough to see the dashboard.
    const [adminStatus, setAdminStatus] = useState('unknown'); // 'unknown' | 'admin' | 'denied' | 'error'
    // The access token the server has already been asked about. Supabase announces one login several times
    // (initial session, sign-in), and refreshes the token about hourly; each NEW token is verified once.
    const verifiedTokenRef = useRef(null);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setUser(session.user);
                fetchProfile(session.user.id);
                verifyAdmin(session.access_token);
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                setUser(session.user);
                fetchProfile(session.user.id);
                verifyAdmin(session.access_token);
            } else {
                setUser(null);
                setProfile(null);
                verifiedTokenRef.current = null;
                setAdminStatus('unknown');
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function fetchProfile(userId) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (!error && data) {
                setProfile(data);
            }
            // Profile not found is OK — not all users will have one yet
        } catch (err) {
            console.error('Failed to fetch profile:', err);
        } finally {
            setLoading(false);
        }
    }

    async function signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        return data;
    }

    // Asks the server (the only place the role can be trusted) whether this session is an administrator.
    async function verifyAdmin(accessToken, { force = false } = {}) {
        if (!force && verifiedTokenRef.current === accessToken) return; // already asked about this token
        verifiedTokenRef.current = accessToken;
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
        // A temporary failure (network, server restart) must not throw a signed-in administrator out in the middle of
        // their work: keep 'admin' if that is what we already knew. Only an explicit refusal removes access.
        const transientFailure = () => setAdminStatus((previous) => (previous === 'admin' ? 'admin' : 'error'));
        try {
            const response = await fetch(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.status === 401 || response.status === 403) { setAdminStatus('denied'); return; }
            if (!response.ok) { transientFailure(); return; }
            const result = await response.json();
            setAdminStatus(result && result.isAdmin === true ? 'admin' : 'denied');
        } catch {
            transientFailure();
        }
    }

    async function retryAdminCheck() {
        setAdminStatus('unknown');
        const { data: { session } } = await supabase.auth.getSession();
        if (session) verifyAdmin(session.access_token, { force: true }); else setAdminStatus('unknown');
    }

    async function signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }

    async function resetPassword(email) {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
        const response = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, redirectTo: getResetRedirectUrl() }),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Password reset failed');
        }
    }

    async function updatePassword(newPassword) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
    }

    async function resendConfirmation(email) {
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/login`,
            },
        });
        if (error) throw error;
    }

    const value = {
        user,
        profile,
        loading,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        resendConfirmation,
        isAuthenticated: !!user,
        isAdmin: adminStatus === 'admin',
        adminStatus,
        retryAdminCheck,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
