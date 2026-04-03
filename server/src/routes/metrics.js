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

        if (error) {
            // If the table doesn't exist yet, return 0s instead of blowing up the UI
            if (error.code === '42P01') { 
                return res.status(200).json({
                    total_users: 0,
                    consultation_users: 0,
                    ebook_users: 0,
                    warning: 'Table user_activity does not exist yet. Please run the SQL migration.'
                });
            }
            return res.status(500).json({ error: error.message });
        }

        const ebookUsers = new Set();
        const consultationUsers = new Set();
        const totalUsers = new Set();

        (data || []).forEach(row => {
            // Use user_id if available, otherwise fallback to email for uniqueness
            const identifier = row.user_id || row.email;
            if (!identifier) return;

            // Normalize identifier
            const normalizedId = String(identifier).toLowerCase().trim();

            totalUsers.add(normalizedId);
            
            if (row.activity_type === 'ebook') {
                ebookUsers.add(normalizedId);
            } else if (row.activity_type === 'consultation') {
                consultationUsers.add(normalizedId);
            }
        });

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
