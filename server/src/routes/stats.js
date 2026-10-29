const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// GET /api/stats/ebooks — Sum of successful order amounts (paid or successful)
router.get('/ebooks', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('orders')
            .select('amount, currency, status')
            .in('status', ['paid', 'successful']);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Group by currency to avoid inaccurate multi-currency sums
        const byCurrency = {};
        (data || []).forEach(order => {
            const curr = (order.currency || 'USD').toUpperCase();
            const amt = Number(order.amount || 0);
            byCurrency[curr] = (byCurrency[curr] || 0) + amt;
        });

        const currencies = Object.keys(byCurrency);
        const primaryCurrency = currencies.includes('USD') ? 'USD' : (currencies[0] || 'USD');
        const primaryTotal = byCurrency[primaryCurrency] || 0;

        return res.status(200).json({
            total: primaryTotal,
            count: (data || []).length,
            currency: primaryCurrency,
            byCurrency
        });
    } catch (err) {
        console.error('Ebooks stats error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/stats/course-clicks — Count of course click records
router.get('/course-clicks', async (req, res) => {
    try {
        const { count, error } = await supabaseAdmin
            .from('course_clicks')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ count: count || 0 });
    } catch (err) {
        console.error('Course clicks stats error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/stats/course-clicks — Record a course card click (public endpoint)
router.post('/course-clicks', async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('course_clicks')
            .insert({ clicked_at: new Date().toISOString() });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(201).json({ message: 'Click recorded' });
    } catch (err) {
        console.error('Record click error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/stats/sign-ins — Count unique sign-in timestamps
router.get('/sign-ins', async (req, res) => {
    try {
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Get user IDs from the orders table to identify genuine website users
        const { data: orders } = await supabaseAdmin.from('orders').select('user_id');
        const orderUserIds = new Set((orders || []).filter(o => o.user_id).map(o => o.user_id));

        // Count users who have signed in AND have placed an order (excluding admins)
        const signedInUsers = (users || []).filter(u => u.last_sign_in_at && orderUserIds.has(u.id));

        return res.status(200).json({ count: signedInUsers.length });
    } catch (err) {
        console.error('Sign-ins stats error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/stats/consultations-count — Quick count of consultations
router.get('/consultations-count', async (req, res) => {
    try {
        const { count, error } = await supabaseAdmin
            .from('consultations')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ count: count || 0 });
    } catch (err) {
        console.error('Consultations count error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/stats/blogs-count — Count of published blogs across the platform
router.get('/blogs-count', async (req, res) => {
    try {
        const { count, error } = await supabaseAdmin
            .from('blogs')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'published');

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ count: count || 0 });
    } catch (err) {
        console.error('Blogs count error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/stats/emails-sent-count — Count of consultations where email was successfully sent
router.get('/emails-sent-count', async (req, res) => {
    try {
        const { count, error } = await supabaseAdmin
            .from('consultations')
            .select('*', { count: 'exact', head: true })
            .eq('email_sent', true);

        if (error) {
            // Graceful fallback if email_sent column is missing
            if (error.message.includes('email_sent') || error.code === '42703') {
                return res.status(200).json({ count: 0, warning: 'email_sent column missing' });
            }
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ count: count || 0 });
    } catch (err) {
        console.error('Emails sent count error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/stats/contact-messages-count
router.get('/contact-messages-count', async (req, res) => {
    try {
        const { count, error } = await supabaseAdmin
            .from('contact_messages')
            .select('*', { count: 'exact', head: true });

        if (error) {
            // Graceful fallback if table doesn't exist yet
            if (error.code === '42P01') {
                return res.status(200).json({ count: 0 });
            }
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ count: count || 0 });
    } catch (err) {
        console.error('Contact messages count error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/stats/timeline — Real time-series data for revenue and platform interactions
router.get('/timeline', async (req, res) => {
    try {
        // 1. Fetch paid orders with date, amount, currency
        const { data: orders, error: ordersErr } = await supabaseAdmin
            .from('orders')
            .select('amount, currency, status, created_at')
            .in('status', ['paid', 'successful'])
            .order('created_at', { ascending: true });

        if (ordersErr) {
            console.error('Timeline orders error:', ordersErr);
        }

        // 2. Fetch consultations
        const { data: consultations, error: consultErr } = await supabaseAdmin
            .from('consultations')
            .select('id, created_at, date')
            .order('created_at', { ascending: true });

        if (consultErr) {
            console.error('Timeline consultations error:', consultErr);
        }

        // 3. Fetch user activity / sign-ins
        const { data: activities, error: actErr } = await supabaseAdmin
            .from('user_activity')
            .select('id, created_at, activity_type');

        if (actErr && actErr.code !== '42P01') {
            console.error('Timeline activity error:', actErr);
        }

        // 4. Fetch contact messages
        const { data: contactMsgs, error: contactErr } = await supabaseAdmin
            .from('contact_messages')
            .select('id, created_at');

        if (contactErr && contactErr.code !== '42P01') {
            console.error('Timeline contact error:', contactErr);
        }

        // Aggregate revenue by day (YYYY-MM-DD)
        const revenueByDate = {};
        let latestOrderDate = null;
        const currenciesUsed = new Set();

        (orders || []).forEach(o => {
            if (!o.created_at) return;
            const dateStr = o.created_at.slice(0, 10);
            const curr = (o.currency || 'USD').toUpperCase();
            currenciesUsed.add(curr);
            const amt = Number(o.amount || 0);

            if (!latestOrderDate || dateStr > latestOrderDate) {
                latestOrderDate = dateStr;
            }

            if (!revenueByDate[dateStr]) {
                revenueByDate[dateStr] = { date: dateStr, count: 0, revenue: 0, byCurrency: {} };
            }
            revenueByDate[dateStr].count += 1;
            revenueByDate[dateStr].revenue += amt;
            revenueByDate[dateStr].byCurrency[curr] = (revenueByDate[dateStr].byCurrency[curr] || 0) + amt;
        });

        // Generate a 7-day rolling daily series anchored on the latest order date (or today)
        const anchor = latestOrderDate ? new Date(`${latestOrderDate}T00:00:00Z`) : new Date();
        const revenueTimeline = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(anchor);
            d.setUTCDate(d.getUTCDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
            const dayEntry = revenueByDate[dateStr] || { revenue: 0, count: 0, byCurrency: {} };
            revenueTimeline.push({
                date: dateStr,
                name: label,
                revenue: dayEntry.revenue,
                orders: dayEntry.count,
                currency: currenciesUsed.size === 1 ? Array.from(currenciesUsed)[0] : 'USD',
                byCurrency: dayEntry.byCurrency
            });
        }

        // Aggregate interactions by month
        const interactionsByMonth = {};
        function ensureMonth(key, monthLabel) {
            if (!interactionsByMonth[key]) {
                interactionsByMonth[key] = {
                    key,
                    name: monthLabel,
                    Consultations: 0,
                    SignIns: 0,
                    ContactMessages: 0
                };
            }
        }

        (consultations || []).forEach(c => {
            const rawDate = c.created_at || c.date;
            if (!rawDate) return;
            const d = new Date(rawDate);
            if (isNaN(d.getTime())) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            ensureMonth(key, label);
            interactionsByMonth[key].Consultations += 1;
        });

        (activities || []).forEach(a => {
            if (!a.created_at) return;
            const d = new Date(a.created_at);
            if (isNaN(d.getTime())) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            ensureMonth(key, label);
            interactionsByMonth[key].SignIns += 1;
        });

        (contactMsgs || []).forEach(m => {
            if (!m.created_at) return;
            const d = new Date(m.created_at);
            if (isNaN(d.getTime())) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            ensureMonth(key, label);
            interactionsByMonth[key].ContactMessages += 1;
        });

        const interactionsTimeline = Object.keys(interactionsByMonth).sort().map(k => interactionsByMonth[k]);

        return res.status(200).json({
            revenueTimeline,
            interactionsTimeline,
            currency: currenciesUsed.size === 1 ? Array.from(currenciesUsed)[0] : 'USD',
            currencies: Array.from(currenciesUsed)
        });
    } catch (err) {
        console.error('Timeline stats error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
