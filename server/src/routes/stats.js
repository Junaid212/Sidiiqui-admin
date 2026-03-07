const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// GET /api/stats/ebooks — Sum of successful order amounts
router.get('/ebooks', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('orders')
            .select('amount')
            .eq('status', 'successful');

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        const total = (data || []).reduce((sum, order) => sum + Number(order.amount), 0);
        return res.status(200).json({ total, count: (data || []).length });
    } catch (err) {
        console.error('Ebooks stats error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/stats/course-clicks — Count of course click records
router.get('/course-clicks', async (req, res) => {
    try {
        const { count, error } = await supabaseAdmin
            .from('course_clicks')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ count: count || 0 });
    } catch (err) {
        console.error('Course clicks stats error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/stats/course-clicks — Record a course card click (public endpoint)
router.post('/course-clicks', async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('course_clicks')
            .insert({ clicked_at: new Date().toISOString() });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(201).json({ message: 'Click recorded' });
    } catch (err) {
        console.error('Record click error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/stats/sign-ins — Count unique sign-in timestamps
router.get('/sign-ins', async (req, res) => {
    try {
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Get user IDs from the orders table to identify genuine website users
        const { data: orders } = await supabaseAdmin.from('orders').select('user_id');
        const orderUserIds = new Set((orders || []).filter(o => o.user_id).map(o => o.user_id));

        // Count users who have signed in AND have placed an order (excluding admins)
        const signedInUsers = (users || []).filter(u => u.last_sign_in_at && orderUserIds.has(u.id));

        return res.status(200).json({ count: signedInUsers.length });
    } catch (err) {
        console.error('Sign-ins stats error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/stats/consultations-count — Quick count of consultations
router.get('/consultations-count', async (req, res) => {
    try {
        const { count, error } = await supabaseAdmin
            .from('consultations')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ count: count || 0 });
    } catch (err) {
        console.error('Consultations count error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/stats/blogs-count — Quick count of total blogs
router.get('/blogs-count', async (req, res) => {
    try {
        const { count, error } = await supabaseAdmin
            .from('blogs')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ count: count || 0 });
    } catch (err) {
        console.error('Blogs count error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
