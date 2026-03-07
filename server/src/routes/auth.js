const express = require('express');
const router = express.Router();
const { supabaseAdmin, supabase } = require('../config/supabase');

// POST /api/auth/sign-up
router.post('/sign-up', async (req, res) => {
    try {
        const { email, password, full_name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: full_name || '' },
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        // Sign in the newly created user to get a session
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (signInError) {
            return res.status(400).json({ error: signInError.message });
        }

        return res.status(201).json({
            message: 'User created successfully',
            user: data.user,
            session: signInData.session,
        });
    } catch (err) {
        console.error('Sign-up error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/sign-in
router.post('/sign-in', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        return res.status(200).json({
            message: 'Signed in successfully',
            user: data.user,
            session: data.session,
        });
    } catch (err) {
        console.error('Sign-in error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/auth/me — get current authenticated user
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing authorization header' });
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Also get profile data
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        return res.status(200).json({ user, profile });
    } catch (err) {
        console.error('Get user error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
