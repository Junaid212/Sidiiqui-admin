const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// GET /api/comments/:blogId — Fetch all comments for a specific blog post
// Only returns comments for blogs owned by this admin
router.get('/:blogId', async (req, res) => {
    try {
        const { blogId } = req.params;
        const adminId = req.user.id;

        // Verify the blog belongs to this admin before returning its comments
        const { data: blog, error: blogError } = await supabaseAdmin
            .from('blogs')
            .select('id')
            .eq('id', blogId)
            .eq('admin_id', adminId)
            .single();

        if (blogError || !blog) {
            return res.status(404).json({ error: 'Blog not found or access denied' });
        }

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
                user_name,
                content,
                is_admin: is_admin || false,
                // Tag admin replies with the admin's user ID
                admin_id: is_admin ? adminId : null,
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

// DELETE /api/comments/:id — Delete a comment (only from admin-owned blogs)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;

        // Fetch the comment to find its blog_id
        const { data: comment, error: fetchError } = await supabaseAdmin
            .from('blog_comments')
            .select('id, blog_id')
            .eq('id', id)
            .single();

        if (fetchError || !comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Verify the parent blog belongs to this admin
        const { data: blog, error: blogError } = await supabaseAdmin
            .from('blogs')
            .select('id')
            .eq('id', comment.blog_id)
            .eq('admin_id', adminId)
            .single();

        if (blogError || !blog) {
            return res.status(403).json({ error: 'Access denied: comment is on a blog you do not own' });
        }

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
