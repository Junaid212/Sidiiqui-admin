
const blogSocialsStore = require('../utils/blogSocialsStore');
const blogSubsectionsStore = require('../utils/blogSubsectionsStore');

function enrichBlogSocials(b) {
    if (!b) return b;
    const socials = blogSocialsStore.getSocials(b.id);
    return {
        ...b,
        linkedin_url: b.linkedin_url || socials.linkedin_url || null,
        instagram_url: b.instagram_url || socials.instagram_url || null,
        facebook_url: b.facebook_url || socials.facebook_url || null,
    };
}

function enrichBlogRecord(b) {
    if (!b) return b;
    return blogSubsectionsStore.enrichBlogSubsections(enrichBlogSocials(b));
}
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
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

// Helper: Upload image to Supabase Storage with ASCII-safe key sanitization
async function uploadImage(file) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const base = path.basename(file.originalname || 'image', ext)
        .normalize('NFKD')
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '') || 'image';

    const fileName = `${Date.now()}-${base}${ext}`;
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

// Helper to normalize and sanitize category strings (supports array or comma-separated string)
function sanitizeTopic(val) {
    if (Array.isArray(val)) {
        const cleaned = val.map(s => String(s).trim()).filter(Boolean);
        return cleaned.length > 0 ? cleaned.join(', ') : null;
    }
    if (typeof val === 'string') {
        const cleaned = val.split(',').map(s => s.trim()).filter(Boolean);
        return cleaned.length > 0 ? cleaned.join(', ') : null;
    }
    return null;
}

// Helper to generate a URL slug
function generateSlug(text) {
    if (!text) return `article-${Date.now()}`;
    return String(text)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

// GET /api/blogs — List all blogs for the admin panel
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('blogs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ blogs: (data || []).map(enrichBlogRecord) });
    } catch (err) {
        console.error('Fetch blogs error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/blogs/:id — Get single blog
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('blogs')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Blog not found' });
        }

        return res.status(200).json({ blog: enrichBlogRecord(data) });
    } catch (err) {
        console.error('Fetch blog error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper to sanitize date/timestamp fields (ensures empty/invalid strings become null)
function sanitizeDate(val) {
    if (!val || typeof val !== 'string') return null;
    const trimmed = val.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
    return trimmed;
}

// Helper to safely insert or update with schema fallback for missing columns
async function safeDbOperation(operation, payload, id = null) {
    let currentPayload = { ...payload };
    const maxRetries = 25;
    let attempts = 0;

    while (attempts < maxRetries) {
        attempts++;
        try {
            let res;
            if (operation === 'insert') {
                res = await supabaseAdmin.from('blogs').insert(currentPayload).select().single();
            } else {
                res = await supabaseAdmin.from('blogs').update(currentPayload).eq('id', id).select().single();
            }

            if (!res.error) {
                return res;
            }

            // Check if error is due to missing column (Postgres 42703)
            const err = res.error;
            if (err.code === '42703' || (err.message && err.message.includes('column'))) {
                // Try to identify the column name in error message
                const match = err.message.match(/column ["']?([a-zA-Z0-9_]+)["']? of relation/i) ||
                              err.message.match(/could not find column ["']?([a-zA-Z0-9_]+)["']?/i) ||
                              err.message.match(/"([a-zA-Z0-9_]+)" does not exist/i);
                
                if (match && match[1] && currentPayload[match[1]] !== undefined) {
                    console.warn(`[Schema Fallback] Column '${match[1]}' not in database. Omitting...`);
                    delete currentPayload[match[1]];
                    continue;
                }
            }

            return res;
        } catch (e) {
            return { error: e };
        }
    }
    return { error: new Error('Max retries reached in database operation') };
}

// POST /api/blogs — Create a new blog with optional image
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const adminId = req.user?.id || '3417e953-65a4-4f74-aefb-85847c4644ab';
        const {
            topic,
            topic2,
            published_date,
            title,
            content,
            title2,
            content2,
            sub_sections,
            pull_quote_position,
            slug,
            summary,
            standfirst,
            reading_time,
            author_byline,
            image_caption,
            image_alt,
            pull_quote,
            pull_quote_author,
            concluding_insight,
            is_featured,
            status,
            scheduled_for,
            related_to_book,
            book_concept,
            related_blog_ids,
            seo_title,
            seo_description,
            linkedin_url,
            instagram_url,
            facebook_url,
        } = req.body;

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

        const formattedTopic = topic ? (typeof topic === 'string' ? topic.trim() : String(topic).trim()) : null;
        const formattedTopic2 = sanitizeTopic(topic2);
        const finalSlug = slug ? generateSlug(slug) : generateSlug(title);
        const boolFeatured = is_featured === true || is_featured === 'true';
        const boolBook = related_to_book === true || related_to_book === 'true';

        // Parse sub_sections & sync with legacy title2/content2
        let parsedSubSections = [];
        if (sub_sections) {
            try {
                parsedSubSections = typeof sub_sections === 'string' ? JSON.parse(sub_sections) : sub_sections;
            } catch (_) {
                parsedSubSections = [];
            }
        }
        if (!Array.isArray(parsedSubSections)) parsedSubSections = [];

        let resolvedTitle2 = title2 ? String(title2).trim() : null;
        let resolvedContent2 = content2 ? String(content2) : null;
        if (parsedSubSections.length > 0) {
            resolvedTitle2 = parsedSubSections[0].heading ? String(parsedSubSections[0].heading).trim() : null;
            resolvedContent2 = parsedSubSections[0].body ? String(parsedSubSections[0].body) : null;
        } else if (title2 || content2) {
            parsedSubSections = [
                {
                    id: 'sub-legacy-1',
                    heading: resolvedTitle2 || '',
                    body: resolvedContent2 || '',
                    highlight_type: 'none',
                    highlight_text: '',
                }
            ];
        }

        const resolvedPullQuotePos = pull_quote_position !== undefined && pull_quote_position !== null
            ? Number(pull_quote_position)
            : 1;

        // Parse related_blog_ids if passed as JSON string or array
        let parsedRelatedIds = [];
        if (related_blog_ids) {
            try {
                parsedRelatedIds = typeof related_blog_ids === 'string' ? JSON.parse(related_blog_ids) : related_blog_ids;
            } catch (_) {
                parsedRelatedIds = [];
            }
        }

        const insertPayload = {
            admin_id: adminId,
            topic: formattedTopic || null,
            topic2: formattedTopic2 || null,
            published_date: sanitizeDate(published_date),
            title,
            content,
            title2: resolvedTitle2,
            content2: resolvedContent2,
            sub_sections: parsedSubSections,
            pull_quote_position: resolvedPullQuotePos,
            image_url,
            image_path,
            slug: finalSlug,
            summary: summary || null,
            standfirst: standfirst || null,
            reading_time: reading_time || null,
            author_byline: author_byline || 'By M. Q. Siddiqui, Founder, Siddiqui.digital',
            image_caption: image_caption || null,
            image_alt: image_alt || null,
            pull_quote: pull_quote || null,
            pull_quote_author: pull_quote_author || null,
            concluding_insight: concluding_insight || null,
            is_featured: boolFeatured,
            status: status || 'published',
            scheduled_for: sanitizeDate(scheduled_for),
            related_to_book: boolBook,
            book_concept: book_concept || null,
            related_blog_ids: parsedRelatedIds,
            seo_title: seo_title || null,
            seo_description: seo_description || null,
            linkedin_url: linkedin_url ? String(linkedin_url).trim() : null,
            instagram_url: instagram_url ? String(instagram_url).trim() : null,
            facebook_url: facebook_url ? String(facebook_url).trim() : null,
        };

        // If newly featured, reset other featured articles
        if (boolFeatured) {
            try {
                await supabaseAdmin.from('blogs').update({ is_featured: false }).neq('id', '00000000-0000-0000-0000-000000000000');
            } catch (_) {}
        }

        const { data, error } = await safeDbOperation('insert', insertPayload);

        if (error) {
            if (image_path) await deleteImage(image_path);
            return res.status(500).json({ error: error.message || 'Failed to create blog' });
        }

        if (data && data.id) {
            blogSocialsStore.setSocials(data.id, { linkedin_url, instagram_url, facebook_url });
            blogSubsectionsStore.setSubsections(data.id, {
                sub_sections: parsedSubSections,
                pull_quote_position: resolvedPullQuotePos,
            });
        }
        return res.status(201).json({ blog: enrichBlogRecord(data) });
    } catch (err) {
        console.error('Create blog error:', err);
        return res.status(500).json({ error: err?.message || 'Failed to create blog' });
    }
});

// PUT /api/blogs/:id — Update a blog
router.put('/:id', upload.single('image'), async (req, res) => {
    try {
        const blogId = req.params.id;
        const {
            topic,
            topic2,
            published_date,
            title,
            content,
            title2,
            content2,
            sub_sections,
            pull_quote_position,
            slug,
            summary,
            standfirst,
            reading_time,
            author_byline,
            image_caption,
            image_alt,
            pull_quote,
            pull_quote_author,
            concluding_insight,
            is_featured,
            status,
            scheduled_for,
            related_to_book,
            book_concept,
            related_blog_ids,
            seo_title,
            seo_description,
            linkedin_url,
            instagram_url,
            facebook_url,
        } = req.body;

        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('blogs')
            .select('*')
            .eq('id', blogId)
            .single();

        if (fetchError || !existing) {
            return res.status(404).json({ error: 'Blog not found' });
        }

        const updateData = {
            updated_at: new Date().toISOString(),
        };

        if (topic !== undefined) updateData.topic = topic ? (typeof topic === 'string' ? topic.trim() : String(topic).trim()) : null;
        if (topic2 !== undefined) updateData.topic2 = sanitizeTopic(topic2);
        if (published_date !== undefined) updateData.published_date = sanitizeDate(published_date);
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;

        // Parse sub_sections if supplied
        let parsedSubSections = null;
        if (sub_sections !== undefined) {
            try {
                parsedSubSections = typeof sub_sections === 'string' ? JSON.parse(sub_sections) : sub_sections;
            } catch (_) {
                parsedSubSections = [];
            }
            if (!Array.isArray(parsedSubSections)) parsedSubSections = [];
            updateData.sub_sections = parsedSubSections;

            // Sync with title2/content2
            if (parsedSubSections.length > 0) {
                updateData.title2 = parsedSubSections[0].heading ? String(parsedSubSections[0].heading).trim() : null;
                updateData.content2 = parsedSubSections[0].body ? String(parsedSubSections[0].body) : null;
            } else {
                updateData.title2 = null;
                updateData.content2 = null;
            }
        } else {
            if (title2 !== undefined) updateData.title2 = title2 || null;
            if (content2 !== undefined) updateData.content2 = content2 || null;
        }

        if (pull_quote_position !== undefined) {
            updateData.pull_quote_position = Number(pull_quote_position);
        }

        if (slug !== undefined) updateData.slug = slug ? generateSlug(slug) : generateSlug(title || existing.title);
        if (summary !== undefined) updateData.summary = summary || null;
        if (standfirst !== undefined) updateData.standfirst = standfirst || null;
        if (reading_time !== undefined) updateData.reading_time = reading_time || null;
        if (author_byline !== undefined) updateData.author_byline = author_byline || 'By M. Q. Siddiqui, Founder, Siddiqui.digital';
        if (image_caption !== undefined) updateData.image_caption = image_caption || null;
        if (image_alt !== undefined) updateData.image_alt = image_alt || null;
        if (pull_quote !== undefined) updateData.pull_quote = pull_quote || null;
        if (pull_quote_author !== undefined) updateData.pull_quote_author = pull_quote_author || null;
        if (concluding_insight !== undefined) updateData.concluding_insight = concluding_insight || null;
        if (status !== undefined) updateData.status = status;
        if (scheduled_for !== undefined) updateData.scheduled_for = sanitizeDate(scheduled_for);
        if (book_concept !== undefined) updateData.book_concept = book_concept || null;
        if (seo_title !== undefined) updateData.seo_title = seo_title || null;
        if (seo_description !== undefined) updateData.seo_description = seo_description || null;
        if (linkedin_url !== undefined) updateData.linkedin_url = linkedin_url ? String(linkedin_url).trim() : null;
        if (instagram_url !== undefined) updateData.instagram_url = instagram_url ? String(instagram_url).trim() : null;
        if (facebook_url !== undefined) updateData.facebook_url = facebook_url ? String(facebook_url).trim() : null;

        if (is_featured !== undefined) {
            const boolFeatured = is_featured === true || is_featured === 'true';
            updateData.is_featured = boolFeatured;
            if (boolFeatured) {
                try {
                    await supabaseAdmin.from('blogs').update({ is_featured: false }).neq('id', blogId);
                } catch (_) {}
            }
        }

        if (related_to_book !== undefined) {
            updateData.related_to_book = related_to_book === true || related_to_book === 'true';
        }

        if (related_blog_ids !== undefined) {
            try {
                updateData.related_blog_ids = typeof related_blog_ids === 'string' ? JSON.parse(related_blog_ids) : related_blog_ids;
            } catch (_) {
                updateData.related_blog_ids = [];
            }
        }

        if (req.file) {
            if (existing.image_path) {
                await deleteImage(existing.image_path);
            }
            const result = await uploadImage(req.file);
            updateData.image_url = result.url;
            updateData.image_path = result.path;
        }

        const { data, error } = await safeDbOperation('update', updateData, blogId);

        if (error) {
            return res.status(500).json({ error: error.message || 'Failed to update blog' });
        }

        if (blogId) {
            blogSocialsStore.setSocials(blogId, { linkedin_url, instagram_url, facebook_url });
            if (parsedSubSections !== null || pull_quote_position !== undefined) {
                const currentStore = blogSubsectionsStore.getSubsections(blogId);
                blogSubsectionsStore.setSubsections(blogId, {
                    sub_sections: parsedSubSections !== null ? parsedSubSections : currentStore.sub_sections,
                    pull_quote_position: pull_quote_position !== undefined ? Number(pull_quote_position) : currentStore.pull_quote_position,
                });
            }
        }
        return res.status(200).json({ blog: enrichBlogRecord(data) });
    } catch (err) {
        console.error('Update blog error:', err);
        return res.status(500).json({ error: err?.message || 'Failed to update article' });
    }
});

// PATCH /api/blogs/:id/status — Fast status toggle
router.patch('/:id/status', async (req, res) => {
    try {
        const blogId = req.params.id;
        const { status, is_featured } = req.body;
        const updateData = { updated_at: new Date().toISOString() };

        if (status !== undefined) updateData.status = status;
        if (is_featured !== undefined) {
            const boolFeatured = is_featured === true || is_featured === 'true';
            updateData.is_featured = boolFeatured;
            if (boolFeatured) {
                try {
                    await supabaseAdmin.from('blogs').update({ is_featured: false }).neq('id', blogId);
                } catch (_) {}
            }
        }

        const { data, error } = await safeDbOperation('update', updateData, blogId);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ blog: data });
    } catch (err) {
        return res.status(500).json({ error: err?.message || 'Failed to update article status' });
    }
});

// DELETE /api/blogs/:id — Delete a blog
router.delete('/:id', async (req, res) => {
    try {
        const blogId = req.params.id;

        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('blogs')
            .select('image_path')
            .eq('id', blogId)
            .single();

        if (fetchError || !existing) {
            return res.status(404).json({ error: 'Blog not found' });
        }

        // Delete associated comments first to avoid foreign key errors
        try {
            await supabaseAdmin
                .from('blog_comments')
                .delete()
                .eq('blog_id', blogId);
        } catch (cErr) {
            console.warn('Comments deletion notice:', cErr?.message);
        }

        // Delete from database
        const { error } = await supabaseAdmin
            .from('blogs')
            .delete()
            .eq('id', blogId);

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
        return res.status(500).json({ error: err?.message || 'Failed to delete article' });
    }
});

module.exports = router;
