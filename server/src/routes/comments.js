const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// GET /api/comments/:blogId — Fetch all comments for a specific blog post (for admin moderation)
router.get('/:blogId', async (req, res) => {
    try {
        const { blogId } = req.params;
        const adminId = req.user.id;

        // Verify the blog exists
        const { data: blog, error: blogError } = await supabaseAdmin
            .from('blogs')
            .select('id')
            .eq('id', blogId)
            .single();

        if (blogError || !blog) {
            return res.status(404).json({ error: 'Blog not found' });
        }

        const { data, error } = await supabaseAdmin
            .from('blog_comments')
            .select('*')
            .eq('blog_id', blogId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ comments: data || [] });
    } catch (err) {
        console.error('Fetch comments error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/comments — Post a new admin reply to a comment
router.post('/', async (req, res) => {
    try {
        const adminId = req.user.id;
        const { blog_id, parent_id, user_name, content, is_admin } = req.body;

        const { data, error } = await supabaseAdmin
            .from('blog_comments')
            .insert([{
                blog_id,
                parent_id: parent_id || null,
                user_name: user_name || 'Admin',
                content,
                is_admin: is_admin !== false,
                admin_id: adminId,
                is_approved: true,
                status: 'approved',
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

// PUT /api/comments/:id/approve — Approve a pending comment
router.put('/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabaseAdmin
            .from('blog_comments')
            .update({ is_approved: true, status: 'approved' })
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ comment: data });
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/comments/:id/reject — Reject a comment
router.put('/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabaseAdmin
            .from('blog_comments')
            .update({ is_approved: false, status: 'rejected' })
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ comment: data });
    } catch (err) {
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
