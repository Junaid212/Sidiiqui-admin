import { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../config/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check for existing session on mount
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (token) {
            fetchUser();
        } else {
            setLoading(false);
        }
    }, []);

    async function fetchUser() {
        try {
            const data = await apiRequest('/auth/me');
            setUser(data.user);
            setProfile(data.profile);
        } catch (err) {
            console.error('Failed to fetch user:', err);
            localStorage.removeItem('access_token');
            setUser(null);
            setProfile(null);
        } finally {
            setLoading(false);
        }
    }

    async function signIn(email, password) {
        const data = await apiRequest('/auth/sign-in', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        localStorage.setItem('access_token', data.session.access_token);
        setUser(data.user);
        await fetchUser(); // get profile data
        return data;
    }

    async function signUp(email, password, full_name) {
        const data = await apiRequest('/auth/sign-up', {
            method: 'POST',
            body: JSON.stringify({ email, password, full_name }),
        });

        localStorage.setItem('access_token', data.session.access_token);
        setUser(data.user);
        await fetchUser();
        return data;
    }

    function signOut() {
        localStorage.removeItem('access_token');
        setUser(null);
        setProfile(null);
    }

    const value = {
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        isAuthenticated: !!user,
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
