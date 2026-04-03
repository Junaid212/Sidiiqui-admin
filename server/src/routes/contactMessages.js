const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// GET /api/contact-messages — fetch all messages (admin, protected)
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('contact_messages')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ messages: data || [] });
    } catch (err) {
        console.error('Fetch contact messages error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/contact-messages/:id — delete a message (admin, protected)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('contact_messages')
            .delete()
            .eq('id', id);

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ message: 'Deleted successfully' });
    } catch (err) {
        console.error('Delete contact message error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
