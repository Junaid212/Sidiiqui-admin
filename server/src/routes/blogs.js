const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabaseAdmin } = require('../config/supabase');

// Configure multer for memory storage (files stay in buffer)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
        }
    },
});

// Helper: Upload image to Supabase Storage
async function uploadImage(file) {
    const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
    const filePath = `blog-images/${fileName}`;

    const { data, error } = await supabaseAdmin.storage
        .from('blogs')
        .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
        });

    if (error) throw error;

    const { data: urlData } = supabaseAdmin.storage
        .from('blogs')
        .getPublicUrl(filePath);

    return { path: filePath, url: urlData.publicUrl };
}

// Helper: Delete image from Supabase Storage
async function deleteImage(imagePath) {
    if (!imagePath) return;

    const { error } = await supabaseAdmin.storage
        .from('blogs')
        .remove([imagePath]);

    if (error) {
        console.error('Failed to delete image from storage:', error);
    }
}

// GET /api/blogs — List only THIS admin's blogs
router.get('/', async (req, res) => {
    try {
        const adminId = req.user.id;

        const { data, error } = await supabaseAdmin
            .from('blogs')
            .select('*')
            .eq('admin_id', adminId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ blogs: data || [] });
    } catch (err) {
        console.error('Fetch blogs error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/blogs/:id — Get single blog (must belong to this admin)
router.get('/:id', async (req, res) => {
    try {
        const adminId = req.user.id;

        const { data, error } = await supabaseAdmin
            .from('blogs')
            .select('*')
            .eq('id', req.params.id)
            .eq('admin_id', adminId)
            .single();

        if (error) {
            return res.status(404).json({ error: 'Blog not found' });
        }

        return res.status(200).json({ blog: data });
    } catch (err) {
        console.error('Fetch blog error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/blogs — Create a new blog with optional image
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const adminId = req.user.id;
        const { topic, published_date, title, content, title2, content2 } = req.body;

        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        let image_url = null;
        let image_path = null;

        if (req.file) {
            const result = await uploadImage(req.file);
            image_url = result.url;
            image_path = result.path;
        }

        const { data, error } = await supabaseAdmin
            .from('blogs')
            .insert({
                admin_id: adminId,
                topic,
                published_date: published_date || null,
                title,
                content,
                title2,
                content2,
                image_url,
                image_path,
            })
            .select()
            .single();

        if (error) {
            // Clean up uploaded image if DB insert fails
            if (image_path) await deleteImage(image_path);
            return res.status(500).json({ error: error.message });
        }

        return res.status(201).json({ blog: data });
    } catch (err) {
        console.error('Create blog error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/blogs/:id — Update a blog (must belong to this admin)
router.put('/:id', upload.single('image'), async (req, res) => {
    try {
        const adminId = req.user.id;
        const { topic, published_date, title, content, title2, content2 } = req.body;
        const blogId = req.params.id;

        // Fetch existing blog — verify ownership
        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('blogs')
            .select('*')
            .eq('id', blogId)
            .eq('admin_id', adminId)
            .single();

        if (fetchError || !existing) {
            return res.status(404).json({ error: 'Blog not found or access denied' });
        }

        const updateData = {
            updated_at: new Date().toISOString(),
        };

        if (topic !== undefined) updateData.topic = topic;
        if (published_date !== undefined) updateData.published_date = published_date || null;
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (title2 !== undefined) updateData.title2 = title2;
        if (content2 !== undefined) updateData.content2 = content2;

        // If a new image is uploaded, replace the old one
        if (req.file) {
            // Delete old image
            if (existing.image_path) {
                await deleteImage(existing.image_path);
            }

            const result = await uploadImage(req.file);
            updateData.image_url = result.url;
            updateData.image_path = result.path;
        }

        const { data, error } = await supabaseAdmin
            .from('blogs')
            .update(updateData)
            .eq('id', blogId)
            .eq('admin_id', adminId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ blog: data });
    } catch (err) {
        console.error('Update blog error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/blogs/:id — Delete a blog (must belong to this admin)
router.delete('/:id', async (req, res) => {
    try {
        const adminId = req.user.id;
        const blogId = req.params.id;

        // Fetch blog to verify ownership and get image path
        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('blogs')
            .select('image_path, admin_id')
            .eq('id', blogId)
            .eq('admin_id', adminId)
            .single();

        if (fetchError || !existing) {
            return res.status(404).json({ error: 'Blog not found or access denied' });
        }

        // Delete from database
        const { error } = await supabaseAdmin
            .from('blogs')
            .delete()
            .eq('id', blogId)
            .eq('admin_id', adminId);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Clean up image from storage
        if (existing.image_path) {
            await deleteImage(existing.image_path);
        }

        return res.status(200).json({ message: 'Blog deleted successfully' });
    } catch (err) {
        console.error('Delete blog error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
