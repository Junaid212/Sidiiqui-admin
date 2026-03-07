require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const statsRoutes = require('./routes/stats');
const consultationsRoutes = require('./routes/consultations');
const blogsRoutes = require('./routes/blogs');
const ordersRoutes = require('./routes/orders');
const courseClicksRoutes = require('./routes/courseClicks');
const signInsRoutes = require('./routes/signIns');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// --- Health Check ---
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/stats', requireAuth, statsRoutes);
app.use('/api/consultations', requireAuth, consultationsRoutes);
app.use('/api/blogs', requireAuth, blogsRoutes);
app.use('/api/orders', requireAuth, ordersRoutes);
app.use('/api/course-clicks-details', requireAuth, courseClicksRoutes);
app.use('/api/sign-ins-details', requireAuth, signInsRoutes);

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
