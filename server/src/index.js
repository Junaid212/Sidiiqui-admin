require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs/promises');

const authRoutes = require('./routes/auth');
const statsRoutes = require('./routes/stats');
const consultationsRoutes = require('./routes/consultations');
const publicConsultationsRoutes = require('./routes/consultationDetails');
const blogsRoutes = require('./routes/blogs');
const commentsRoutes = require('./routes/comments');
const ordersRoutes = require('./routes/orders');
const productsRoutes = require('./routes/products');
const courseClicksRoutes = require('./routes/courseClicks');
const signInsRoutes = require('./routes/signIns');
const metricsRoutes = require('./routes/metrics');
const contactMessagesRoutes = require('./routes/contactMessages');
const questionnaireRoutes = require('./routes/questionnaire');
const couponsRoutes = require('./routes/coupons');
const askSidRoutes = require('./routes/askSid');
const readingRoutes = require('./routes/reading');
const entitlementRoutes = require('./routes/entitlements');
const companionFileRoutes = require('./routes/companionFiles');
const offerBannerRoutes = require('./routes/offerBanner');
const { requireAdmin, need, needByMethod, needBy } = require('./middleware/auth');
const { auditAdminRequests } = require('./utils/adminAudit');
const teamRoutes = require('./routes/team');
const blogPrerender = require('./utils/blogPrerender');

// What each customer-access action needs (Support may look, grant and revoke; the rest of the actions are the Owner's)
function entitlementPermission(req) {
    const p = req.path;
    if (req.method === 'GET' || req.method === 'HEAD') return (p === '/audit' || p === '/webhooks') ? 'audit' : 'customers.view';
    if (p === '/grant' || p === '/reconcile') return 'customers.grant';
    if (/^\/[0-9a-f-]{36}\/action\/?$/i.test(p)) {
        const action = req.body && req.body.action;
        return action === 'revoke' || action === 'restore' ? 'customers.grant' : 'customers.manage'; // extend / add questions
    }
    return 'customers.manage'; // open the launch offer, import Payhip orders, anything added later
}

const app = express();
const PORT = process.env.PORT || 5001;

// Trust the first proxy (Nginx) — required for correct IP, protocol, and host detection
app.set('trust proxy', 1);

// --- CORS Configuration ---
const allowedOrigins = [
    'https://admin.siddiqui.digital',
    'https://siddiqui.digital',
    'https://www.siddiqui.digital',
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        console.warn(`[CORS] Blocked origin: ${origin}`);
        callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// Default JSON limit (100kb) for every route except the ZIP commit-batch route, which carries
// base64 image previews. That route parses its own body (with a larger limit) AFTER requireAdmin,
// so only authenticated admins can send large payloads.
const defaultJsonParser = express.json();
app.use((req, res, next) =>
    req.path === '/api/blogs/import-zip/commit-batch' || req.path.startsWith('/api/reading/') ? next() : defaultJsonParser(req, res, next)
);
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// --- Health Check & Root ---
app.get('/', (req, res) => {
    res.status(200).send('Siddique Admin API is running.');
});

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Routes ---
// /api/auth handles its own authentication (sign-in, password reset, /me) and has no public sign-up.
app.use('/api/auth', authRoutes);

// Every dashboard API below requires a DASHBOARD ROLE (valid session + app_metadata.role of admin / editor / support), and then the
// permission that area needs (utils/permissions.js). A valid customer session is not enough: customers share this Supabase project.
// auditAdminRequests writes every change and every refusal to the audit log.
//   Owner   : everything.   Editor : Online Reading, Blog, Ask SID settings, Companion Files.
//   Support : view orders and customers, grant / revoke reader access, read contact messages.
const staff = [requireAdmin, auditAdminRequests];
app.use('/api/stats', ...staff, need('dashboard'), statsRoutes);
app.use('/api/consultations', ...staff, need('consultations'), consultationsRoutes);
app.use('/api/blogs', ...staff, need('blog'), blogsRoutes);
app.use('/api/comments', ...staff, need('blog'), commentsRoutes);
// orders: Support may VIEW the list; refunds, removing, marking as test and the CSV export are Owner only
app.use('/api/orders', ...staff, needBy((req) => ((req.method === 'GET' && req.path !== '/export-csv') ? 'orders.view' : 'orders.manage')), ordersRoutes);
app.use('/api/products', ...staff, need('products'), productsRoutes);
app.use('/api/course-clicks-details', ...staff, need('analytics'), courseClicksRoutes);
app.use('/api/sign-ins-details', ...staff, need('analytics'), signInsRoutes);
app.use('/api/admin/metrics', ...staff, need('analytics'), metricsRoutes);
app.use('/api/contact-messages', ...staff, needByMethod('messages.view', 'messages.manage'), contactMessagesRoutes);
app.use('/api/questionnaire', ...staff, need('analytics'), questionnaireRoutes);
app.use('/api/coupons', ...staff, need('coupons'), couponsRoutes);
app.use('/api/ask-sid', ...staff, need('asksid'), askSidRoutes);
// Online Reading content, Digital Companion customers / entitlements, Companion PDF files
app.use('/api/reading', ...staff, need('reading'), readingRoutes);
app.use('/api/entitlements', ...staff, needBy(entitlementPermission), entitlementRoutes);
app.use('/api/companion-files', ...staff, need('companion'), companionFileRoutes);
// Offer label (slim banner on the Marketing Reclassified landing page) and the edition offers: payment settings, Owner only
app.use('/api/offer-banner', ...staff, need('settings'), offerBannerRoutes);
// Who can sign in to the dashboard (Owner only)
app.use('/api/team', ...staff, need('team'), teamRoutes);

// Everything the website reads from /api/public (offer, prices, products, Ask SID settings, coupons) must always be fresh:
// no browser or proxy may keep a copy, so a returning visitor never sees an outdated offer or price.
app.use('/api/public', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// Public: the website reads the offer label
app.get('/api/public/offer-banner', (req, res) => {
    res.set('Cache-Control', 'no-store');
    return res.json(require('./utils/offerBannerStore').publicView());
});

// Public route for Ask SID config
app.get('/api/public/ask-sid-config', async (req, res) => {
    try {
        const { getAskSidSettings } = require('./utils/askSidSettingsStore');
        const settings = await getAskSidSettings();
        return res.json({
            askSidEnabled: settings.askSidEnabled !== false,
            publicDemoEnabled: settings.publicDemoEnabled !== false,
            demoQuestionLimit: Number(settings.demoQuestionLimit || 1),
            upgradeCtaText: settings.upgradeCtaText || 'Unlock Full Ask SID with the Digital Companion Edition ($49.99)',
            upgradeUrl: settings.upgradeUrl || '/publications/marketing-reclassified',
            advisoryCtaEnabled: settings.advisoryCtaEnabled !== false,
            advisoryUrl: settings.advisoryUrl || '/consultation'
        });
    } catch (e) {
        return res.status(500).json({ error: 'Failed to load Ask SID configuration' });
    }
});
// Only coupon VALIDATION is public. The full coupons router (list / create / update / delete) was
// previously mounted here with no authentication at all, so it is NOT exposed publicly any more.
app.use('/api/public/coupons', couponsRoutes.publicRouter);

app.use('/api/public/consultations', publicConsultationsRoutes);

// Public route for contact form submission (no auth required)
app.post('/api/public/contact', async (req, res) => {
    try {
        const { supabaseAdmin } = require('./config/supabase');
        const { name, email, subject, message } = req.body;

        if (!name || !email || !subject || !message) {
            return res.status(400).json({ error: 'All fields are required.' });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }

        const { error } = await supabaseAdmin
            .from('contact_messages')
            .insert({ name, email, subject, message });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json({ message: 'Your message has been sent successfully' });
    } catch (err) {
        console.error('Contact form error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Public Blog & Comment Routes (Editorial Blog System) ---

const REFERENCE_TOPICS = [
    'SID Philosophy',
    'Marketing Reclassified',
    'Business Strategy & Growth',
    'Leadership & Governance',
    'AI & Human Thinking',
    'Higher Education & Learning',
    'Innovation & Entrepreneurship',
];

function extractCategories(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(s => String(s).trim()).filter(Boolean);
    if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
    return [];
}

function getBlogCategories(b) {
    const list = [];
    [...extractCategories(b.topic), ...extractCategories(b.topic2)].forEach(t => {
        if (t && !list.some(existing => existing.toLowerCase() === t.toLowerCase())) {
            list.push(t);
        }
    });
    return list;
}

function isBlogPublished(b) {
    // If status is draft or unpublished, never show publicly
    const st = (b.status || 'published').toLowerCase();
    if (st === 'draft' || st === 'unpublished') return false;
    // If scheduled, only show if scheduled time has passed
    if (st === 'scheduled') {
        if (!b.scheduled_for) return false;
        return new Date(b.scheduled_for) <= new Date();
    }
    return true;
}

function normalizePublicBlog(b) {
    const cats = getBlogCategories(b);
    let socials = { linkedin_url: null, instagram_url: null, facebook_url: null };
    try {
        const blogSocialsStore = require('./utils/blogSocialsStore');
        socials = blogSocialsStore.getSocials(b.id);
    } catch (_) { }

    let enriched = b;
    try {
        const blogSubsectionsStore = require('./utils/blogSubsectionsStore');
        enriched = blogSubsectionsStore.enrichBlogSubsections(b);
    } catch (_) { }

    return {
        ...enriched,
        linkedin_url: b.linkedin_url || socials.linkedin_url || null,
        instagram_url: b.instagram_url || socials.instagram_url || null,
        facebook_url: b.facebook_url || socials.facebook_url || null,
        category: cats[0] || b.topic || 'General',
        category2: cats[1] || b.topic2 || null,
        categories: cats,
        author_byline: b.author_byline || 'By M. Q. Siddiqui, Founder, Siddiqui.digital',
        slug: b.slug || String(b.id),
        reading_time: b.reading_time || (b.content ? `${Math.max(2, Math.ceil(b.content.split(/\s+/).length / 200))} min read` : '4 min read'),
    };
}

// Public route for blog listing with search & category filtering
app.get('/api/public/blogs', async (req, res) => {
    try {
        const { supabaseAdmin } = require('./config/supabase');
        const { category, search, limit, page } = req.query;

        let query = supabaseAdmin
            .from('blogs')
            .select('*')
            .order('created_at', { ascending: false });

        let { data, error } = await query;
        if (error) return res.status(500).json({ error: error.message });

        // Filter only publicly published articles
        let blogs = (data || []).filter(isBlogPublished).map(normalizePublicBlog);

        // Filter by category if requested
        if (category && category !== 'all') {
            const target = category.trim().toLowerCase();
            blogs = blogs.filter(b =>
                b.categories.some(c => c.toLowerCase() === target || c.toLowerCase().includes(target)) ||
                (b.topic && String(b.topic).toLowerCase().includes(target)) ||
                (b.topic2 && String(b.topic2).toLowerCase().includes(target))
            );
        }

        // Real-time search across title, summary, standfirst, content, categories
        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            blogs = blogs.filter(b => {
                const titleMatch = (b.title || '').toLowerCase().includes(q);
                const summaryMatch = (b.summary || '').toLowerCase().includes(q);
                const standfirstMatch = (b.standfirst || '').toLowerCase().includes(q);
                const contentMatch = (b.content || '').toLowerCase().includes(q);
                const catMatch = b.categories.some(c => c.toLowerCase().includes(q));
                return titleMatch || summaryMatch || standfirstMatch || contentMatch || catMatch;
            });
        }

        return res.status(200).json({ blogs, total: blogs.length });
    } catch (err) {
        console.error('Public blogs listing error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Public route for featured article
app.get('/api/public/blogs/featured', async (req, res) => {
    try {
        const { supabaseAdmin } = require('./config/supabase');
        const { data, error } = await supabaseAdmin
            .from('blogs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        const published = (data || []).filter(isBlogPublished).map(normalizePublicBlog);
        if (published.length === 0) {
            return res.status(200).json({ blog: null });
        }

        // Prioritize blog with is_featured === true
        const featured = published.find(b => b.is_featured === true) || published[0];
        return res.status(200).json({ blog: featured });
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Public route for single blog detail by slug (or ID)
app.get('/api/public/blogs/by-slug/:slug', async (req, res) => {
    try {
        const { supabaseAdmin } = require('./config/supabase');
        const { slug } = req.params;

        // Fetch all blogs to resolve slug or ID and find related articles
        const { data, error } = await supabaseAdmin
            .from('blogs')
            .select('*');

        if (error) return res.status(500).json({ error: error.message });

        const allBlogs = data || [];
        const match = allBlogs.find(b =>
            String(b.slug).toLowerCase() === slug.toLowerCase() ||
            String(b.id) === String(slug)
        );

        if (!match) {
            return res.status(404).json({ error: 'Article not found' });
        }

        if (!isBlogPublished(match)) {
            return res.status(404).json({ error: 'Article not found' });
        }

        const normalizedBlog = normalizePublicBlog(match);

        // Fetch up to 3 published related articles
        let relatedArticles = [];
        const publishedBlogs = allBlogs.filter(b => b.id !== match.id && isBlogPublished(b)).map(normalizePublicBlog);

        // If author explicitly selected related articles in admin
        if (Array.isArray(match.related_blog_ids) && match.related_blog_ids.length > 0) {
            match.related_blog_ids.forEach(relId => {
                const found = publishedBlogs.find(p => String(p.id) === String(relId));
                if (found && !relatedArticles.some(r => r.id === found.id)) {
                    relatedArticles.push(found);
                }
            });
        }

        // Fallback: fill up to 3 related articles from same category or newest
        if (relatedArticles.length < 3) {
            const sameCategory = publishedBlogs.filter(b =>
                !relatedArticles.some(r => r.id === b.id) &&
                b.categories.some(c => normalizedBlog.categories.some(nc => nc.toLowerCase() === c.toLowerCase()))
            );
            sameCategory.slice(0, 3 - relatedArticles.length).forEach(b => relatedArticles.push(b));
        }

        if (relatedArticles.length < 3) {
            publishedBlogs.filter(b => !relatedArticles.some(r => r.id === b.id))
                .slice(0, 3 - relatedArticles.length)
                .forEach(b => relatedArticles.push(b));
        }

        return res.status(200).json({
            blog: normalizedBlog,
            relatedArticles: relatedArticles.slice(0, 3),
        });
    } catch (err) {
        console.error('Fetch blog by slug error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Public route for listing all distinct blog categories + reference topics
app.get('/api/public/blogs/categories', async (req, res) => {
    try {
        const { supabaseAdmin } = require('./config/supabase');
        const { data, error } = await supabaseAdmin
            .from('blogs')
            .select('*');

        if (error) return res.status(500).json({ error: error.message });

        const published = (data || []).filter(isBlogPublished);
        const categoryCounts = {};

        // Always initialize reference categories
        REFERENCE_TOPICS.forEach(topic => {
            categoryCounts[topic] = 0;
        });

        published.forEach(b => {
            getBlogCategories(b).forEach(t => {
                const matchedRef = REFERENCE_TOPICS.find(ref => ref.toLowerCase() === t.toLowerCase()) || t;
                categoryCounts[matchedRef] = (categoryCounts[matchedRef] || 0) + 1;
            });
        });

        const categories = Object.keys(categoryCounts).map(name => ({
            name,
            count: categoryCounts[name],
        }));

        return res.status(200).json({ categories });
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Public route for comments (approved only)
app.get('/api/public/blogs/:blogId/comments', async (req, res) => {
    try {
        const { supabaseAdmin } = require('./config/supabase');
        const { blogId } = req.params;

        const { data, error } = await supabaseAdmin
            .from('blog_comments')
            .select('id, blog_id, parent_id, user_name, content, is_admin, created_at')
            .eq('blog_id', blogId)
            .or('is_approved.eq.true,status.eq.approved,is_admin.eq.true')
            .order('created_at', { ascending: true });

        if (error) return res.status(500).json({ error: error.message });

        const sanitizedComments = (data || []).map(c => ({
            ...c,
            user_name: (c.is_admin || (c.user_name && c.user_name.toLowerCase().trim() === 'admin'))
                ? 'M. Q. Siddiqui'
                : (c.user_name || 'Reader'),
        }));
        return res.status(200).json({ comments: sanitizedComments });
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Public route for submitting reader comments for moderation
app.post('/api/public/blogs/:blogId/comments', async (req, res) => {
    try {
        const { supabaseAdmin } = require('./config/supabase');
        const { blogId } = req.params;
        const { user_name, content, parent_id } = req.body;

        if (!user_name || !user_name.trim() || !content || !content.trim()) {
            return res.status(400).json({ error: 'Name and comment are required.' });
        }

        // Basic XSS sanitization
        const sanitizedName = String(user_name).trim().slice(0, 100).replace(/<[^>]+>/g, '');
        const sanitizedContent = String(content).trim().slice(0, 2000).replace(/<[^>]+>/g, '');

        if (!sanitizedName || !sanitizedContent) {
            return res.status(400).json({ error: 'Valid name and comment text are required.' });
        }

        const insertPayload = {
            blog_id: blogId,
            parent_id: parent_id || null,
            user_name: sanitizedName,
            content: sanitizedContent,
            is_admin: false,
            is_approved: false,
            status: 'pending',
        };

        const { data, error } = await supabaseAdmin
            .from('blog_comments')
            .insert([insertPayload])
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(201).json({
            message: 'Your comment has been submitted for review. It will appear once approved.',
            comment: data,
        });
    } catch (err) {
        console.error('Comment submit error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});


// Helper: normalize a single ebook row for public API
function normalizePublicProduct(p, idx = 0) {
    function parseJsonb(val, fallback = []) {
        if (val === undefined || val === null) return fallback;
        if (Array.isArray(val)) return val;
        if (typeof val === 'object') return val;
        try { return JSON.parse(val); } catch { return fallback; }
    }
    return {
        id: String(p.id),
        sku: p.sku || `PROD-${String(idx + 1).padStart(3, '0')}`,
        title: p.title || p.name || 'Digital Product',
        subtitle: p.subtitle || null,
        slug: p.slug || null,
        publication_status: p.publication_status || 'available',
        author: p.author || 'M. Q. Siddiqui',
        product_type: p.product_type || 'ebook',
        short_description: p.description ? p.description.substring(0, 140) + '...' : '',
        description: p.description || '',
        price: Number(p.price) || 49.00,
        currency: p.currency || 'USD',
        format: p.format || 'PDF',
        cover_image: p.cover_image || '/assets/images/img/30.webp',
        file_path: p.file_path || 'ebooks/marketing-reclassified.pdf',
        active: p.active !== false,
        download_limit: p.download_limit || 3,
        download_expiry_hours: p.download_expiry_hours || 72,
        created_at: p.created_at || new Date().toISOString(),
        // Publication content fields
        why_this_book_matters: p.why_this_book_matters || null,
        who_its_for: parseJsonb(p.who_its_for, []),
        what_readers_will_learn: parseJsonb(p.what_readers_will_learn, []),
        author_note: p.author_note || null,
        faq: parseJsonb(p.faq, []),
        related_learning: parseJsonb(p.related_learning, []),
        related_frameworks: parseJsonb(p.related_frameworks, []),
        related_blogs: parseJsonb(p.related_blogs, []),
        access_options: parseJsonb(p.access_options, []),
    };
}

// Public route for digital products listing
app.get('/api/public/products', async (req, res) => {
    try {
        const { supabaseAdmin } = require('./config/supabase');
        const { data, error } = await supabaseAdmin
            .from('ebooks')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        const products = (data || []).map((p, idx) => normalizePublicProduct(p, idx));
        return res.status(200).json({ products });
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Public route for single digital product detail by ID
app.get('/api/public/products/:id', async (req, res) => {
    try {
        const { supabaseAdmin } = require('./config/supabase');
        const { id } = req.params;

        const { data: p, error } = await supabaseAdmin
            .from('ebooks')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });
        if (!p) return res.status(404).json({ error: 'Product not found' });

        return res.status(200).json({ product: normalizePublicProduct(p, 0) });
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Public route for single digital product detail by slug
app.get('/api/public/products/by-slug/:slug', async (req, res) => {
    try {
        const { supabaseAdmin } = require('./config/supabase');
        const { slug } = req.params;

        const { data: p, error } = await supabaseAdmin
            .from('ebooks')
            .select('*')
            .eq('slug', slug)
            .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });
        if (!p) return res.status(404).json({ error: 'Publication not found' });

        return res.status(200).json({ product: normalizePublicProduct(p, 0) });
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Public route for recording course clicks
app.post('/api/public/course-clicks', async (req, res) => {
    try {
        const { supabaseAdmin } = require('./config/supabase');
        const { error } = await supabaseAdmin
            .from('course_clicks')
            .insert({ clicked_at: new Date().toISOString() });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json({ message: 'Click recorded' });
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});


// --- Social crawler HTML for individual blog articles ---
app.get('/blogs/:slug', async (req, res) => {
    try {
        const { supabaseAdmin } = require('./config/supabase');
        const { slug } = req.params;

        // Fetch the article using its slug
        const { data: blog, error } = await supabaseAdmin
            .from('blogs')
            .select('*')
            .eq('slug', slug)
            .maybeSingle();

        if (error) {
            console.error('Social metadata blog fetch error:', error);
            return res.status(500).send('Unable to load article');
        }

        if (!blog || !isBlogPublished(blog)) {
            return res.status(404).send('Article not found');
        }

        const article = normalizePublicBlog(blog);

        const htmlPath =
            process.env.FRONTEND_INDEX_PATH ||
            '/var/www/frontend/index.html';

        const template = await fs.readFile(htmlPath, 'utf8');

        // Same renderer as the prerendered pages and the build script, so every route produces identical
        // metadata: seo_title (+ site suffix), description chain, canonical https://siddiqui.digital/blogs/<slug>,
        // og:/twitter: tags, and the image priority social_image_url -> image_url -> website default.
        const html = await blogPrerender.renderArticleOnDemand(template, article);

        res.set('Cache-Control', 'public, max-age=300');
        res.type('html').send(html);

    } catch (err) {
        console.error('Social metadata route error:', err);
        res.status(500).send('Unable to generate article page');
    }
});


// --- Error Handling ---
app.use((req, res, next) => {
    res.status(404).json({ error: `Not found: ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
    console.error('[Server] Unhandled error:', err?.message, err);

    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON payload received' });
    }

    if (err.message && err.message.startsWith('CORS blocked')) {
        return res.status(403).json({ error: err.message });
    }

    if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({ error: err.message });
    }

    if (err.code === 'LIMIT_FILE_SIZE' || (err.message && err.message.includes('File too large'))) {
        if (err.field === 'social_image') {
            return res.status(400).json({ error: 'Social image is too large. Maximum allowed size is 2 MB.' });
        }
        if (err.field === 'zipFile') {
            return res.status(400).json({ error: 'ZIP file is too large. Maximum allowed size is 60 MB.' });
        }
        return res.status(400).json({ error: 'Image file is too large. Maximum allowed size is 5MB.' });
    }

    res.status(500).json({ error: err?.message || 'Internal server error' });
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`);

    // Keeps the public site's prerendered article pages in step with the database (retries failures,
    // publishes scheduled articles when due). Does nothing unless PUBLIC_SITE_ROOT is configured.
    try {
        const { supabaseAdmin } = require('./config/supabase');
        blogPrerender.startSweep(supabaseAdmin, { minutes: Number(process.env.PRERENDER_SWEEP_MINUTES ?? 15) });
    } catch (err) {
        console.error('[prerender] could not start the sweep:', err && err.message);
    }
});
