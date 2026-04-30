const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// GET /api/comments/:blogId — Fetch all comments for a specific blog post
router.get('/:blogId', async (req, res) => {
    try {
        const { blogId } = req.params;
        const { data, error } = await supabaseAdmin
            .from('blog_comments')
            .select('*')
            .eq('blog_id', blogId)
            .order('created_at', { ascending: true });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ comments: data || [] });
    } catch (err) {
        console.error('Fetch comments error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/comments — Post a new comment or reply
router.post('/', async (req, res) => {
    try {
        const { blog_id, parent_id, user_name, content, is_admin } = req.body;

        const { data, error } = await supabaseAdmin
            .from('blog_comments')
            .insert([{
                blog_id,
                parent_id: parent_id || null,
                user_name,
                content,
                is_admin: is_admin || false
            }])
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(201).json({ comment: data });
    } catch (err) {
        console.error('Create comment error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/comments/:id — Delete a comment
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('blog_comments')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (err) {
        console.error('Delete comment error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
