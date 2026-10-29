const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// GET /api/admin/metrics/signins
router.get('/signins', async (req, res) => {
    try {
        // Fetch all user activity records
        const { data, error } = await supabaseAdmin
            .from('user_activity')
            .select('user_id, email, activity_type');

        if (error && error.code !== '42P01') {
            return res.status(500).json({ error: error.message });
        }

        const ebookUsers = new Set();
        const consultationUsers = new Set();
        const totalUsers = new Set();

        (data || []).forEach(row => {
            const identifier = row.user_id || row.email;
            if (!identifier) return;

            const normalizedId = String(identifier).toLowerCase().trim();
            totalUsers.add(normalizedId);

            if (row.activity_type === 'ebook') {
                ebookUsers.add(normalizedId);
            } else if (row.activity_type === 'consultation') {
                consultationUsers.add(normalizedId);
            }
        });

        // If user_activity has no recorded ebook events, check orders table for paid purchasers
        if (ebookUsers.size === 0) {
            const { data: orderUsers } = await supabaseAdmin
                .from('orders')
                .select('user_id, email')
                .in('status', ['paid', 'successful']);

            (orderUsers || []).forEach(o => {
                const identifier = o.user_id || o.email;
                if (!identifier) return;
                const normalizedId = String(identifier).toLowerCase().trim();
                ebookUsers.add(normalizedId);
                totalUsers.add(normalizedId);
            });
        }

        return res.status(200).json({
            total_users: totalUsers.size,
            consultation_users: consultationUsers.size,
            ebook_users: ebookUsers.size
        });

    } catch (err) {
        console.error('Metrics API Error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
