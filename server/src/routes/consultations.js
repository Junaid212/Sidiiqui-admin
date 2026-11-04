const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { ALLOWED_STATUSES, isActiveStatus, normalizeDate, normalizeTime } = require('../utils/consultationRules');

router.get('/', async (req, res) => {
    console.log(`[Admin API] GET /api/consultations requested by user: ${req.user.email}`);
    try {
        const { data, error } = await supabaseAdmin
            .from('consultations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Admin API] Database error in consultations:', error.message);
            return res.status(500).json({ error: error.message });
        }

        console.log(`[Admin API] Returning ${data ? data.length : 0} consultations to client`);
        return res.status(200).json({ consultations: data || [] });
    } catch (err) {
        console.error('Fetch consultations error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

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

router.patch('/:id', async (req, res) => {
    try {
        const status = String(req.body.status || '').toLowerCase();
        if (!ALLOWED_STATUSES.includes(status)) {
            return res.status(400).json({ error: 'Invalid booking status' });
        }

        const { data: current, error: currentError } = await supabaseAdmin
            .from('consultations')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (currentError || !current) {
            return res.status(404).json({ error: 'Consultation not found' });
        }

        if (isActiveStatus(status)) {
            const date = normalizeDate(current.date || current.selected_date);
            const time = normalizeTime(current.time || current.selected_time);
            const { data: others } = await supabaseAdmin
                .from('consultations')
                .select('id, date, time, selected_date, selected_time, status')
                .neq('id', req.params.id);

            const conflict = (others || []).some((row) => {
                if (!isActiveStatus(row.status)) return false;
                return normalizeDate(row.date || row.selected_date) === date
                    && normalizeTime(row.time || row.selected_time) === time;
            });

            if (conflict) {
                return res.status(409).json({ error: 'Another active booking already uses this date and time' });
            }
        }

        const { data, error } = await supabaseAdmin
            .from('consultations')
            .update({ status })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ consultation: data });
    } catch (err) {
        console.error('Update consultation error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

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
