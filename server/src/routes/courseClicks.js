const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// GET /api/course-clicks-details — Get all course clicks with user details
router.get('/', async (req, res) => {
    try {
        // Fetch all course clicks
        const { data: clicks, error: clicksError } = await supabaseAdmin
            .from('course_clicks')
            .select('*')
            .order('clicked_at', { ascending: false });

        if (clicksError) {
            return res.status(500).json({ error: clicksError.message });
        }

        // Fetch all profiles to map user_id to email if it exists (assuming we add user_id later)
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

        // Combine clicks with user details (and fallback dummy data if schema hasn't been updated yet)
        const enrichedClicks = (clicks || []).map(click => {
            const profile = click.user_id ? profileMap[click.user_id] : null;
            return {
                ...click,
                email: profile ? profile.email : 'Anonymous / Not Tracked',
                user_id: click.user_id || 'N/A',
                course_title: click.course_title || 'Default Course', // Dummy course name fallback
            };
        });

        return res.status(200).json({ clicks: enrichedClicks });
    } catch (err) {
        console.error('Fetch course clicks error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
