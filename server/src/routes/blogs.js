
const blogSocialsStore = require('../utils/blogSocialsStore');
const blogSubsectionsStore = require('../utils/blogSubsectionsStore');
const { parseZipArticles, uploadBufferToStorage } = require('../utils/zipArticleParser');
const {
    validateSocialJpeg,
    validateSocialDataUrl,
    storagePathFromPublicUrl,
    deleteStorageFileIfUnreferenced,
    socialColumnExists,
    SOCIAL_COLUMN_MISSING_MESSAGE,
} = require('../utils/socialImage');
const crypto = require('crypto');
const blogPrerender = require('../utils/blogPrerender');

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
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'social_image') {
            const ext = path.extname(file.originalname || '').toLowerCase();

            if (
                file.mimetype === 'image/jpeg' &&
                ['.jpg', '.jpeg'].includes(ext)
            ) {
                return cb(null, true);
            }

            return cb(new Error('Invalid file type. Social sharing images must be JPG/JPEG.'));
        }

        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            return cb(null, true);
        }

        cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
    },
});

// Configure multer for ZIP archive uploads (up to 60MB limit)
const zipUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 60 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const isZip = file.mimetype === 'application/zip' ||
            file.mimetype === 'application/x-zip-compressed' ||
            file.mimetype === 'application/octet-stream' ||
            (file.originalname && file.originalname.toLowerCase().endsWith('.zip'));
        if (isZip) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file format. Please upload a valid .zip archive.'));
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

    const suffix = Math.random().toString(36).substring(2, 7);
    const fileName = `${Date.now()}-${suffix}-${base}${ext}`;
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

// Social images are stored per ARTICLE ID: blog-images/social/<articleId>/<random>.jpg
// The file name the admin picked is never used for storage or lookup, so changing an article's title or slug
// can never orphan or break its social image. The public URL is saved on the article row (social_image_url).
async function uploadSocialImage(file, articleId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(articleId || ''))) {
        throw new Error('A valid article id is required to store a social image');
    }
    const key = `blog-images/social/${articleId}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.jpg`;
    const { error } = await supabaseAdmin.storage.from('blogs').upload(key, file.buffer, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    const { data: urlData } = supabaseAdmin.storage.from('blogs').getPublicUrl(key);
    return { path: key, url: urlData.publicUrl };
}

// After a SUCCESSFUL database save: refresh that article's prerendered public page.
// Never throws and never changes the save result; failures are returned, logged, and retried by the periodic sweep.
const PRERENDER_FAILED_WARNING = 'The public share preview page could not be refreshed yet. It will be retried automatically.';
async function refreshPublicPage(article, opts = {}) {
    const result = await blogPrerender.syncArticle(article, { db: supabaseAdmin, ...opts });
    return { result, warnings: result.status === 'failed' ? [PRERENDER_FAILED_WARNING] : [] };
}
const prerenderSummary = (r) => ({ status: r.status, ...(r.actions && r.actions.length ? { actions: r.actions } : {}), ...(r.reason ? { reason: r.reason } : {}), ...(r.message ? { message: r.message } : {}) });

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
    const droppedColumns = []; // columns the database does not have; reported to callers, never silent
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
                return Object.assign(res, { droppedColumns });
            }

            // Check if error is due to missing column (Postgres 42703 or PostgREST PGRST204 / schema cache)
            const err = res.error;
            if (
                err.code === '42703' ||
                err.code === 'PGRST204' ||
                (err.message && (err.message.includes('column') || err.message.includes('schema cache')))
            ) {
                // Try to identify the column name in error message (including PostgREST "Could not find the 'xyz' column of 'blogs' in the schema cache")
                const match =
                    err.message.match(/Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i) ||
                    err.message.match(/column ['"]?([a-zA-Z0-9_]+)['"]? of relation/i) ||
                    err.message.match(/column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i) ||
                    err.message.match(/could not find column ['"]?([a-zA-Z0-9_]+)['"]?/i) ||
                    err.message.match(/['"]([a-zA-Z0-9_]+)['"] does not exist/i) ||
                    err.message.match(/['"]([a-zA-Z0-9_]+)['"] column/i);

                let failedCol = match && match[1] ? match[1] : null;

                // Fallback: check which key in currentPayload is mentioned in the error message
                if (!failedCol) {
                    failedCol = Object.keys(currentPayload).find(k =>
                        err.message.includes(`'${k}'`) ||
                        err.message.includes(`"${k}"`) ||
                        err.message.includes(` ${k} `)
                    );
                }

                if (failedCol && currentPayload[failedCol] !== undefined) {
                    console.warn(`[Schema Fallback] Column '${failedCol}' not in database schema. Omitting from DB payload and retrying...`);
                    if (failedCol === 'social_image_url' && currentPayload[failedCol] !== null) {
                        console.error('[Schema Fallback] WARNING: blogs.social_image_url does not exist — the social image value was NOT saved. Apply supabase/migrations/add_social_image_to_blogs.sql.');
                    }
                    droppedColumns.push(failedCol);
                    delete currentPayload[failedCol];
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
router.post(
    '/',
    upload.fields([
        { name: 'image', maxCount: 1 },
        { name: 'social_image', maxCount: 1 }
    ]),
    async (req, res) => {
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

        // The article id is chosen up-front so the social image can be stored under it (and so the row keeps that id)
        const articleId = crypto.randomUUID();
        let image_url = null;
        let image_path = null;
        let social_image_url = null;
        let social_image_path = null;

        const coverFile = req.files?.image?.[0];
        const socialFile = req.files?.social_image?.[0];

        // Validate the social image BEFORE any upload so a rejected request leaves no orphan files
        if (socialFile) {
            const check = validateSocialJpeg(socialFile);
            if (!check.ok) {
                return res.status(400).json({ error: check.error, code: 'INVALID_SOCIAL_IMAGE' });
            }
            if (!(await socialColumnExists(supabaseAdmin))) {
                return res.status(409).json({ error: SOCIAL_COLUMN_MISSING_MESSAGE, code: 'SOCIAL_COLUMN_MISSING' });
            }
        }

        if (coverFile) {
            const result = await uploadImage(coverFile);
            image_url = result.url;
            image_path = result.path;
        }

        if (socialFile) {
            const result = await uploadSocialImage(socialFile, articleId);
            social_image_url = result.url;
            social_image_path = result.path;
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
            id: articleId,
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
            social_image_url,
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

        const insertRes = await safeDbOperation('insert', insertPayload);
        const { data, error } = insertRes;

        if (error) {
            if (image_path) await deleteImage(image_path);
            if (social_image_path) await deleteImage(social_image_path);
            return res.status(500).json({ error: error.message || 'Failed to create blog' });
        }

        if (data && data.id) {
            blogSocialsStore.setSocials(data.id, { linkedin_url, instagram_url, facebook_url });
            blogSubsectionsStore.setSubsections(data.id, {
                sub_sections: parsedSubSections,
                pull_quote_position: resolvedPullQuotePos,
            });
        }
        const createWarnings = (insertRes.droppedColumns || []).includes('social_image_url') && social_image_url
            ? ['The social image was not saved because the social_image_url column is missing in the database.']
            : [];
        // Database save succeeded -> refresh this article's public share-preview page
        const createRefresh = await refreshPublicPage(data);
        const createAllWarnings = [...createWarnings, ...createRefresh.warnings];
        return res.status(201).json({ blog: enrichBlogRecord(data), prerender: prerenderSummary(createRefresh.result), ...(createAllWarnings.length ? { warnings: createAllWarnings } : {}) });
    } catch (err) {
        console.error('Create blog error:', err);
        return res.status(500).json({ error: err?.message || 'Failed to create blog' });
    }
});

// PUT /api/blogs/:id — Update a blog
router.put(
    '/:id',
    upload.fields([
        { name: 'image', maxCount: 1 },
        { name: 'social_image', maxCount: 1 }
    ]),
    async (req, res) => {
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
            remove_social_image,
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

        const coverFile = req.files?.image?.[0];
        const socialFile = req.files?.social_image?.[0];
        // A newly uploaded social image always wins over a remove request
        const removeSocial = (remove_social_image === true || remove_social_image === 'true') && !socialFile;

        // Validate BEFORE any upload so a rejected request leaves no orphan files
        if (socialFile) {
            const check = validateSocialJpeg(socialFile);
            if (!check.ok) {
                return res.status(400).json({ error: check.error, code: 'INVALID_SOCIAL_IMAGE' });
            }
        }
        if (socialFile || removeSocial) {
            if (!(await socialColumnExists(supabaseAdmin))) {
                return res.status(409).json({ error: SOCIAL_COLUMN_MISSING_MESSAGE, code: 'SOCIAL_COLUMN_MISSING' });
            }
        }
        if (removeSocial) updateData.social_image_url = null;

        // Upload replacements first; nothing existing is deleted until the DB update succeeds.
        const newUploadedPaths = [];
        let data, error, droppedCols = [];
        try {
            if (coverFile) {
                const result = await uploadImage(coverFile);
                newUploadedPaths.push(result.path);
                updateData.image_url = result.url;
                updateData.image_path = result.path;
            }

            // Social image is independent; left untouched when no new file is sent
            if (socialFile) {
                const result = await uploadSocialImage(socialFile, blogId);
                newUploadedPaths.push(result.path);
                updateData.social_image_url = result.url;
            }

            const updateRes = await safeDbOperation('update', updateData, blogId);
            ({ data, error } = updateRes);
            droppedCols = updateRes.droppedColumns || [];
        } catch (uploadOrDbErr) {
            await Promise.all(newUploadedPaths.map(deleteImage));
            throw uploadOrDbErr;
        }

        if (error) {
            // Remove only the files uploaded by this request
            await Promise.all(newUploadedPaths.map(deleteImage));
            return res.status(500).json({ error: error.message || 'Failed to update blog' });
        }

        // DB saved: now it is safe to remove the replaced cover — unless the saved social image
        // still points at that same file (e.g. ZIP-imported articles reuse the cover as social image).
        const savedSocialUrl = (data && data.social_image_url) || updateData.social_image_url || existing.social_image_url || null;
        const oldCoverStillUsedAsSocial = !!savedSocialUrl && (
            savedSocialUrl === existing.image_url ||
            (!!existing.image_path && savedSocialUrl.includes(existing.image_path))
        );
        if (coverFile && existing.image_path && existing.image_path !== updateData.image_path && !oldCoverStillUsedAsSocial) {
            // Second line of defence: also skip if ANY other blog still references this file
            await deleteStorageFileIfUnreferenced(supabaseAdmin, existing.image_path);
        }

        // Replaced or removed social image: delete the OLD file only if nothing references it any more.
        // Cleanup never fails the request (the blog is already saved).
        const newSocialUrl = (data && data.social_image_url !== undefined)
            ? data.social_image_url
            : (updateData.social_image_url !== undefined ? updateData.social_image_url : existing.social_image_url);
        if (existing.social_image_url && existing.social_image_url !== newSocialUrl) {
            const oldSocialPath = storagePathFromPublicUrl(existing.social_image_url, process.env.SUPABASE_URL);
            if (oldSocialPath) {
                await deleteStorageFileIfUnreferenced(supabaseAdmin, oldSocialPath);
            }
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
        const updateWarnings = droppedCols.includes('social_image_url') && (socialFile || removeSocial)
            ? ['The social image change was not saved because the social_image_url column is missing in the database.']
            : [];
        // Database save succeeded -> refresh the public page (handles title/slug/image/SEO/status changes)
        const updateRefresh = await refreshPublicPage(data, { previousSlug: existing.slug });
        const updateAllWarnings = [...updateWarnings, ...updateRefresh.warnings];
        return res.status(200).json({ blog: enrichBlogRecord(data), prerender: prerenderSummary(updateRefresh.result), ...(updateAllWarnings.length ? { warnings: updateAllWarnings } : {}) });
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
        // Published/unpublished/scheduled: create or remove the public page accordingly
        const statusRefresh = await refreshPublicPage(data);
        return res.status(200).json({ blog: data, prerender: prerenderSummary(statusRefresh.result), ...(statusRefresh.warnings.length ? { warnings: statusRefresh.warnings } : {}) });
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
            .select('*')
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

        // Clean up images from storage — only files that no remaining blog still references
        if (existing.image_path) {
            await deleteStorageFileIfUnreferenced(supabaseAdmin, existing.image_path);
        }
        const deletedSocialPath = storagePathFromPublicUrl(existing.social_image_url, process.env.SUPABASE_URL);
        if (deletedSocialPath && deletedSocialPath !== existing.image_path) {
            await deleteStorageFileIfUnreferenced(supabaseAdmin, deletedSocialPath);
        }

        // Deleted: remove its public page (never touches pages it did not generate)
        const deleteRefresh = await refreshPublicPage(existing, { deleted: true });
        return res.status(200).json({ message: 'Blog deleted successfully', prerender: prerenderSummary(deleteRefresh.result), ...(deleteRefresh.warnings.length ? { warnings: deleteRefresh.warnings } : {}) });
    } catch (err) {
        console.error('Delete blog error:', err);
        return res.status(500).json({ error: err?.message || 'Failed to delete article' });
    }
});

// POST /api/blogs/upload-image — Upload inline editor image or docx embedded image
router.post('/upload-image', (req, res, next) => {
    // If request is json (e.g. Base64 from docx importer), bypass multer
    if (req.is('application/json')) {
        return next();
    }
    upload.single('image')(req, res, next);
}, async (req, res) => {
    try {
        // Case 1: Base64 payload (from docx parser or client base64 upload)
        if (req.body && req.body.imageBase64) {
            const { imageBase64, filename = 'inline-image', contentType = 'image/png' } = req.body;
            const pureBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(pureBase64, 'base64');

            if (buffer.length > 10 * 1024 * 1024) {
                return res.status(400).json({ error: 'Image exceeds maximum size of 10MB' });
            }

            const extMatch = contentType.split('/')[1] || 'png';
            const safeExt = `.${extMatch.replace(/[^a-zA-Z0-9]/g, '')}`;
            const safeBase = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40) || 'image';
            const fileName = `${Date.now()}-${safeBase}${safeExt}`;
            const filePath = `blog-images/${fileName}`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from('blogs')
                .upload(filePath, buffer, {
                    contentType,
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabaseAdmin.storage
                .from('blogs')
                .getPublicUrl(filePath);

            return res.status(200).json({
                success: true,
                url: urlData.publicUrl,
                path: filePath
            });
        }

        // Case 2: Multipart file upload (from TipTap editor image button)
        if (req.file) {
            const { url, path: filePath } = await uploadImage(req.file);
            return res.status(200).json({
                success: true,
                url,
                path: filePath
            });
        }

        return res.status(400).json({ error: 'No image file or imageBase64 data provided' });
    } catch (err) {
        console.error('Image upload error:', err);
        return res.status(500).json({ error: err?.message || 'Failed to upload image' });
    }
});

// POST /api/blogs/import-zip/inspect — Extract, validate, inspect ZIP archive and match articles & images
router.post('/import-zip/inspect', zipUpload.single('zipFile'), async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ error: 'No ZIP archive file provided' });
        }

        // Fetch existing blogs for collision and duplicate checking
        const { data: existingBlogs, error: dbErr } = await supabaseAdmin
            .from('blogs')
            .select('id, title, slug, status, created_at');

        if (dbErr) {
            console.error('Failed to fetch existing blogs for zip comparison:', dbErr);
        }

        const result = await parseZipArticles(req.file.buffer, existingBlogs || []);
        return res.status(200).json({
            success: true,
            summary: result.summary,
            articles: result.articles,
        });
    } catch (err) {
        console.error('ZIP inspection error:', err);
        return res.status(400).json({ error: err.message || 'Failed to inspect ZIP archive' });
    }
});

const MAX_ZIP_COVER_BYTES = 5 * 1024 * 1024; // cover images only; social images use the stricter shared rules

async function cleanupUploads(paths) {
    if (!paths || !paths.length) return;
    const { error } = await supabaseAdmin.storage.from('blogs').remove(paths);
    if (error) console.error('Failed to clean up uploaded ZIP images:', error.message);
}

// Convert Base64 previews from ZIP inspection into permanent Supabase Storage URLs.
// Each image is uploaded at most once; uploaded paths are returned so callers can clean up on DB failure.
async function resolveZipImages(art, slug, articleId) {
    const uploaded = [];
    const out = {
        coverUrl: art.image_url || null,
        coverPath: art.image_url ? (art.image_path || null) : null,
        socialUrl: null,
        uploaded,
    };

    // ── Phase 1: validate EVERYTHING before any storage upload ──────────────
    // An invalid image rejects the article here, so nothing is uploaded and nothing is written.
    let cover = null;
    if (typeof art.image_url === 'string' && art.image_url.startsWith('data:image/')) {
        const m = art.image_url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        const ext = m && { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[m[1]];
        if (!ext) throw new Error('Unsupported cover image data');
        const buf = Buffer.from(m[2], 'base64');
        if (buf.length > MAX_ZIP_COVER_BYTES) throw new Error('Cover image exceeds 5 MB');
        cover = { buf, ext, mime: m[1] };
    }

    let socialBuf = null;
    if (typeof art.social_image_url === 'string' && art.social_image_url.startsWith('data:')) {
        const check = validateSocialDataUrl(art.social_image_url);
        if (!check.ok) throw new Error(`Social image rejected: ${check.error}`);
        socialBuf = check.buffer;
    } else if (/^https?:\/\//i.test(art.social_image_url || '')) {
        out.socialUrl = art.social_image_url;
    }

    // ── Phase 2: upload (clean up anything uploaded if a later step fails) ──
    try {
        if (cover) {
            const r = await uploadBufferToStorage(cover.buf, `${slug}-cover${cover.ext}`, 'blog-images', cover.mime);
            uploaded.push(r.path);
            out.coverUrl = r.url;
            out.coverPath = r.path;
        }
        if (socialBuf) {
            // stored under the article id; the file name is generic and never used to find the image
            if (!/^[0-9a-f-]{36}$/i.test(String(articleId || ''))) throw new Error('A valid article id is required to store a social image');
            const r = await uploadBufferToStorage(socialBuf, 'social.jpg', `blog-images/social/${articleId}`, 'image/jpeg');
            uploaded.push(r.path);
            out.socialUrl = r.url;
        }
    } catch (e) {
        await cleanupUploads(uploaded);
        throw e;
    }
    return out;
}

// POST /api/blogs/import-zip/commit-batch — Save a batch of confirmed articles safely & idempotently
router.post('/import-zip/commit-batch', express.json({ limit: '50mb' }), async (req, res) => {
    try {
        const adminId = req.user?.id || '3417e953-65a4-4f74-aefb-85847c4644ab';
        const { articles } = req.body;

        if (!Array.isArray(articles) || articles.length === 0) {
            return res.status(400).json({ error: 'Articles array is required' });
        }

        const saved = [];
        const skipped = [];
        const failed = [];
        const warnings = [];

        for (const art of articles) {
            try {
                const targetStatus = art.status || 'draft';
                const trimmedTitle = (art.title || '').trim();

                if (!trimmedTitle || !art.content) {
                    failed.push({
                        title: trimmedTitle || 'Untitled',
                        error: 'Missing required title or editorial content'
                    });
                    continue;
                }

                // If collision and user chose skip
                if (art.hasConflict && art.conflictAction === 'skip') {
                    skipped.push({
                        title: trimmedTitle,
                        slug: art.slug,
                        reason: 'Skipped by admin preference to preserve existing article'
                    });
                    continue;
                }

                // If collision and update confirmed
                if (art.hasConflict && art.conflictAction === 'overwrite') {
                    if (!art.overwriteConfirmed) {
                        skipped.push({
                            title: trimmedTitle,
                            slug: art.slug,
                            reason: 'Overwrite was requested but not explicitly confirmed'
                        });
                        continue;
                    }

                    const targetId = art.existingMatch?.id;
                    if (!targetId) {
                        failed.push({
                            title: trimmedTitle,
                            error: 'Target article ID for overwrite was not found'
                        });
                        continue;
                    }

                    const updatePayload = {
                        title: trimmedTitle,
                        content: art.content,
                        topic: art.topic ? String(art.topic).trim() : null,
                        topic2: sanitizeTopic(art.topic2),
                        published_date: sanitizeDate(art.published_date),
                        slug: generateSlug(art.slug || trimmedTitle),
                        summary: art.summary || null,
                        standfirst: art.standfirst || null,
                        reading_time: art.reading_time || null,
                        author_byline: art.author_byline || 'By M. Q. Siddiqui, Founder, Siddiqui.digital',
                        image_caption: art.image_caption || null,
                        image_alt: art.image_alt || null,
                        pull_quote: art.pull_quote || null,
                        pull_quote_author: art.pull_quote_author || null,
                        concluding_insight: art.concluding_insight || null,
                        status: targetStatus,
                        scheduled_for: sanitizeDate(art.scheduled_for),
                        related_to_book: !!art.related_to_book,
                        book_concept: art.book_concept || null,
                        seo_title: art.seo_title || null,
                        seo_description: art.seo_description || null,
                        linkedin_url: art.linkedin_url ? String(art.linkedin_url).trim() : null,
                        instagram_url: art.instagram_url ? String(art.instagram_url).trim() : null,
                        facebook_url: art.facebook_url ? String(art.facebook_url).trim() : null,
                        updated_at: new Date().toISOString()
                    };

                    const imgs = await resolveZipImages(art, generateSlug(art.slug || trimmedTitle), targetId);

                    // Cover/social columns are only touched when the ZIP supplies a replacement.
                    // No cover fallback is written to social_image_url on overwrite, so a
                    // manually chosen social image is never clobbered.
                    if (imgs.coverUrl) {
                        updatePayload.image_url = imgs.coverUrl;
                        updatePayload.image_path = imgs.coverPath;
                    }
                    if (imgs.socialUrl) {
                        updatePayload.social_image_url = imgs.socialUrl;
                    }

                    const zipUpdateRes = await safeDbOperation('update', updatePayload, targetId);
                    const { data: updated, error: updateErr } = zipUpdateRes;
                    if ((zipUpdateRes.droppedColumns || []).includes('social_image_url') && updatePayload.social_image_url) {
                        warnings.push(`"${trimmedTitle}": social image not saved — blogs.social_image_url column is missing.`);
                    }
                    if (updateErr) {
                        await cleanupUploads(imgs.uploaded);
                        failed.push({ title: trimmedTitle, error: updateErr.message });
                    } else {
                        saved.push(enrichBlogRecord(updated));
                        const zipUpdRefresh = await refreshPublicPage(updated, { previousSlug: art.existingMatch && art.existingMatch.slug });
                        if (zipUpdRefresh.warnings.length) warnings.push(`"${trimmedTitle}": ${PRERENDER_FAILED_WARNING}`);
                    }
                    continue;
                }

                // Determine final slug for new article
                let finalSlug = generateSlug(art.slug || trimmedTitle);

                // If collision and user chose rename_slug, or if slug is already taken
                if (art.hasConflict && art.conflictAction === 'rename_slug') {
                    finalSlug = `${finalSlug}-${Date.now().toString(36)}`;
                } else {
                    // Idempotent safety check: does this slug already exist?
                    const { data: existingWithSlug } = await supabaseAdmin
                        .from('blogs')
                        .select('id, title, slug')
                        .eq('slug', finalSlug)
                        .maybeSingle();

                    if (existingWithSlug) {
                        // Avoid accidental duplicates or collisions
                        finalSlug = `${finalSlug}-${Date.now().toString(36)}`;
                    }
                }

                const newArticleId = crypto.randomUUID();
                const imgs = await resolveZipImages(art, finalSlug, newArticleId);

                const insertPayload = {
                    id: newArticleId,
                    admin_id: adminId,
                    title: trimmedTitle,
                    content: art.content,
                    topic: art.topic ? String(art.topic).trim() : null,
                    topic2: sanitizeTopic(art.topic2),
                    published_date: sanitizeDate(art.published_date) || new Date().toISOString().split('T')[0],
                    slug: finalSlug,
                    summary: art.summary || null,
                    standfirst: art.standfirst || null,
                    reading_time: art.reading_time || null,
                    author_byline: art.author_byline || 'By M. Q. Siddiqui, Founder, Siddiqui.digital',
                    image_url: imgs.coverUrl,
                    image_path: imgs.coverPath,
                    // Custom social image, else the cover's permanent URL (same upload, no duplicate)
                    social_image_url: imgs.socialUrl || imgs.coverUrl || null,
                    image_caption: art.image_caption || null,
                    image_alt: art.image_alt || null,
                    pull_quote: art.pull_quote || null,
                    pull_quote_author: art.pull_quote_author || null,
                    pull_quote_position: art.pull_quote_position !== undefined ? Number(art.pull_quote_position) : 1,
                    concluding_insight: art.concluding_insight || null,
                    is_featured: !!art.is_featured,
                    status: targetStatus,
                    scheduled_for: sanitizeDate(art.scheduled_for),
                    related_to_book: !!art.related_to_book,
                    book_concept: art.book_concept || null,
                    related_blog_ids: Array.isArray(art.related_blog_ids) ? art.related_blog_ids : [],
                    seo_title: art.seo_title || null,
                    seo_description: art.seo_description || null,
                    linkedin_url: art.linkedin_url ? String(art.linkedin_url).trim() : null,
                    instagram_url: art.instagram_url ? String(art.instagram_url).trim() : null,
                    facebook_url: art.facebook_url ? String(art.facebook_url).trim() : null,
                };

                const zipInsertRes = await safeDbOperation('insert', insertPayload);
                const { data: inserted, error: insertErr } = zipInsertRes;
                if ((zipInsertRes.droppedColumns || []).includes('social_image_url') && imgs.socialUrl) {
                    warnings.push(`"${trimmedTitle}": social image not saved — blogs.social_image_url column is missing.`);
                }

                if (insertErr) {
                    await cleanupUploads(imgs.uploaded);
                    failed.push({ title: trimmedTitle, error: insertErr.message });
                } else if (inserted && inserted.id) {
                    if (art.linkedin_url || art.instagram_url || art.facebook_url) {
                        blogSocialsStore.setSocials(inserted.id, {
                            linkedin_url: art.linkedin_url,
                            instagram_url: art.instagram_url,
                            facebook_url: art.facebook_url
                        });
                    }
                    if (Array.isArray(art.sub_sections) && art.sub_sections.length > 0) {
                        blogSubsectionsStore.setSubsections(inserted.id, {
                            sub_sections: art.sub_sections,
                            pull_quote_position: art.pull_quote_position !== undefined ? Number(art.pull_quote_position) : 1
                        });
                    }
                    saved.push(enrichBlogRecord(inserted));
                    const zipInsRefresh = await refreshPublicPage(inserted);
                    if (zipInsRefresh.warnings.length) warnings.push(`"${trimmedTitle}": ${PRERENDER_FAILED_WARNING}`);
                }
            } catch (singleErr) {
                failed.push({
                    title: art.title || 'Unknown',
                    error: singleErr.message || 'Error processing article'
                });
            }
        }

        return res.status(200).json({
            success: true,
            batchResults: {
                saved,
                skipped,
                failed,
                warnings,
                totalProcessed: articles.length,
                successCount: saved.length,
                skippedCount: skipped.length,
                failedCount: failed.length
            }
        });
    } catch (err) {
        console.error('Commit batch error:', err);
        return res.status(500).json({ error: err.message || 'Batch commit failed' });
    }
});

// ── Public page refresh: status + reliable manual retry ─────────────────────────────────────────────
// GET  /api/blogs/prerender/status        configuration check, last sweep, pages that are still pending
router.get('/prerender/status', async (req, res) => {
    try {
        return res.status(200).json(await blogPrerender.getStatus());
    } catch (err) {
        return res.status(500).json({ error: blogPrerender.friendlyError(err) });
    }
});

// POST /api/blogs/prerender/sync          bring EVERY public page in line with the database (add ?dryRun=true to preview)
router.post('/prerender/sync', async (req, res) => {
    try {
        const dryRun = req.query.dryRun === 'true' || (req.body && req.body.dryRun === true);
        const result = await blogPrerender.reconcileAll({ db: supabaseAdmin, dryRun });
        if (result.status === 'skipped') {
            return res.status(409).json({ error: 'Public page refresh is not configured on the server (PUBLIC_SITE_ROOT is not set).', code: 'PRERENDER_NOT_CONFIGURED' });
        }
        return res.status(200).json(result);
    } catch (err) {
        console.error('Prerender sync error:', err);
        return res.status(500).json({ error: blogPrerender.friendlyError(err) });
    }
});

// POST /api/blogs/:id/prerender           retry the public page of ONE article
router.post('/:id/prerender', async (req, res) => {
    try {
        const { data: row, error } = await supabaseAdmin.from('blogs').select('*').eq('id', req.params.id).single();
        if (error || !row) return res.status(404).json({ error: 'Blog not found' });
        const result = await blogPrerender.syncArticle(row, { db: supabaseAdmin });
        if (result.status === 'skipped' && result.reason === 'not-configured') {
            return res.status(409).json({ error: 'Public page refresh is not configured on the server (PUBLIC_SITE_ROOT is not set).', code: 'PRERENDER_NOT_CONFIGURED' });
        }
        return res.status(result.status === 'failed' ? 502 : 200).json({ prerender: prerenderSummary(result) });
    } catch (err) {
        console.error('Prerender retry error:', err);
        return res.status(500).json({ error: blogPrerender.friendlyError(err) });
    }
});

module.exports = router;

