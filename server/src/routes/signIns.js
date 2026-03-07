const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// GET /api/sign-ins-details — Get all users who have signed in
router.get('/', async (req, res) => {
    try {
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Get user IDs from the orders table to identify genuine website users
        const { data: orders } = await supabaseAdmin.from('orders').select('user_id');
        const orderUserIds = new Set((orders || []).filter(o => o.user_id).map(o => o.user_id));

        // Filter non-admin users who have signed in (must have placed an order)
        const signedInUsers = (users || [])
            .filter(u => u.last_sign_in_at && orderUserIds.has(u.id))
            .map(u => ({
                id: u.id,
                email: u.email,
                last_sign_in_at: u.last_sign_in_at
            }))
            .sort((a, b) => new Date(b.last_sign_in_at) - new Date(a.last_sign_in_at));

        return res.status(200).json({ signIns: signedInUsers });
    } catch (err) {
        console.error('Fetch sign-ins error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
