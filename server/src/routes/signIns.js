const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// GET /api/sign-ins-details — Get all users who have signed in (via ebook purchase or blog commenting)
router.get('/', async (req, res) => {
    try {
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Get user IDs from orders table (ebook purchases)
        const { data: orders } = await supabaseAdmin.from('orders').select('user_id');
        const orderUserIds = new Set((orders || []).filter(o => o.user_id).map(o => o.user_id));

        // Get unique user emails from consultations
        const { data: consultations } = await supabaseAdmin.from('consultations').select('email');
        const consultationEmails = new Set((consultations || []).filter(c => c.email).map(c => c.email.toLowerCase()));

        // Get unique user names from blog_comments (non-admin comments from authenticated users)
        const { data: comments } = await supabaseAdmin
            .from('blog_comments')
            .select('user_name')
            .eq('is_admin', false);

        // Collect unique commenter names/emails for matching
        const commenterNames = new Set((comments || []).map(c => c.user_name?.toLowerCase()));

        // Build sign-in records with source tracking
        const signedInUsers = (users || [])
            .filter(u => u.last_sign_in_at)
            .map(u => {
                const userName = u.user_metadata?.full_name || u.email;
                const userEmail = u.email?.toLowerCase();
                const hasOrder = orderUserIds.has(u.id);
                const hasConsultation = userEmail && consultationEmails.has(userEmail);
                const hasComment = commenterNames.has(userName?.toLowerCase()) || commenterNames.has(userEmail);

                // Only include if they purchased, booked, or commented
                if (!hasOrder && !hasComment && !hasConsultation) return null;

                // Determine source
                const sources = [];
                if (hasConsultation) sources.push('Consultation');
                if (hasOrder) sources.push('Ebook Purchase');
                if (hasComment) sources.push('Blog Comment');

                return {
                    id: u.id,
                    email: u.email,
                    full_name: u.user_metadata?.full_name || null,
                    avatar_url: u.user_metadata?.avatar_url || null,
                    source: sources.join(', '),
                    last_sign_in_at: u.last_sign_in_at
                };
            })
            .filter(Boolean)
            .sort((a, b) => new Date(b.last_sign_in_at) - new Date(a.last_sign_in_at));

        return res.status(200).json({ signIns: signedInUsers });
    } catch (err) {
        console.error('Fetch sign-ins error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
