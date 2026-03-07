const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// GET /api/consultations — Fetch all consultations ordered by date desc
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('consultations')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ consultations: data || [] });
    } catch (err) {
        console.error('Fetch consultations error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/consultations/:id — Get single consultation
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('consultations')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) {
            return res.status(404).json({ error: 'Consultation not found' });
        }

        return res.status(200).json({ consultation: data });
    } catch (err) {
        console.error('Fetch consultation error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/consultations/:id — Delete a consultation
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('consultations')
            .delete()
            .eq('id', req.params.id);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ message: 'Consultation deleted' });
    } catch (err) {
        console.error('Delete consultation error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
