const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// GET /api/orders — Get all orders with user details
router.get('/', async (req, res) => {
    try {
        // Fetch all successful orders
        const { data: orders, error: ordersError } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('status', 'successful')
            .order('created_at', { ascending: false });

        if (ordersError) {
            return res.status(500).json({ error: ordersError.message });
        }

        // Fetch all profiles to map email and ID
        const { data: profiles, error: profilesError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, full_name');

        if (profilesError) {
            return res.status(500).json({ error: profilesError.message });
        }

        // Map profiles for quick lookup
        const profileMap = {};
        if (profiles) {
            profiles.forEach(p => {
                profileMap[p.id] = p;
            });
        }

        // Combine orders with user details
        const enrichedOrders = (orders || []).map(order => {
            const profile = profileMap[order.user_id] || {};
            return {
                ...order,
                email: profile.email || 'Unknown User',
                book_name: order.book_name || 'Dummy Book', // Uses the db column if present
            };
        });

        return res.status(200).json({ orders: enrichedOrders });
    } catch (err) {
        console.error('Fetch orders error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
