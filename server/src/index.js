require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const statsRoutes = require('./routes/stats');
const consultationsRoutes = require('./routes/consultations');
const publicConsultationsRoutes = require('./routes/consultationDetails');
const blogsRoutes = require('./routes/blogs');
const commentsRoutes = require('./routes/comments');
const ordersRoutes = require('./routes/orders');
const courseClicksRoutes = require('./routes/courseClicks');
const signInsRoutes = require('./routes/signIns');
const metricsRoutes = require('./routes/metrics');
const contactMessagesRoutes = require('./routes/contactMessages');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
const allowedOrigins = [
    'https://siddiqui.digital',
    'https://www.siddiqui.digital',
    'https://admin.siddiqui.digital',
    'http://localhost:3000',
    'http://localhost:5173',
];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS blocked: ${origin}`));
        }
    },
    credentials: true,
}));
app.use(express.json());
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
app.use('/api/auth', authRoutes);
app.use('/api/stats', requireAuth, statsRoutes);
app.use('/api/consultations', requireAuth, consultationsRoutes);
app.use('/api/blogs', requireAuth, blogsRoutes);
app.use('/api/comments', requireAuth, commentsRoutes);
app.use('/api/orders', requireAuth, ordersRoutes);
app.use('/api/course-clicks-details', requireAuth, courseClicksRoutes);
app.use('/api/sign-ins-details', requireAuth, signInsRoutes);
app.use('/api/admin/metrics', requireAuth, metricsRoutes);
app.use('/api/contact-messages', requireAuth, contactMessagesRoutes);

app.use('/api/public/consultations', publicConsultationsRoutes);

// Public route for contact form submission (no auth required)
app.post('/api/public/contact', async (req, res) => {
    try {
        const { supabaseAdmin } = require('./config/supabase');
        const { name, email, subject, message } = req.body;

        // Validation
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

// Public route for blog listing (main site can fetch without auth)
app.get('/api/public/blogs', async (req, res) => {
    try {
        const { supabaseAdmin } = require('./config/supabase');
        const { data, error } = await supabaseAdmin
            .from('blogs')
            .select('id, title, image_url, created_at')
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ blogs: data || [] });
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

// --- Error Handling ---
// Catch 404 and forward to error handler
app.use((req, res, next) => {
    res.status(404).json({ error: `Not found: ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);

    if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: 'Something went wrong!' });
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
});
