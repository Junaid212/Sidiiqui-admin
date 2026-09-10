const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// GET /api/orders — Get all orders with enriched product and customer details
router.get('/', async (req, res) => {
    try {
        const { status, search } = req.query;

        let query = supabaseAdmin
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (status && status !== 'all') {
            query = query.eq('status', status.toLowerCase());
        }

        const { data: orders, error: ordersError } = await query;

        if (ordersError) {
            return res.status(500).json({ error: ordersError.message });
        }

        // Fetch profiles to enrich customer info if available
        const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('id, email, full_name');

        const profileMap = {};
        if (profiles) {
            profiles.forEach(p => { profileMap[p.id] = p; });
        }

        let enrichedOrders = (orders || []).map((order, idx) => {
            const profile = profileMap[order.user_id] || {};
            const email = order.email || profile.email || 'guest@customer.com';
            const customerName = order.customer_name || profile.full_name || email.split('@')[0];
            const bookName = order.book_name || order.ebook_title || 'Digital Publication';
            const orderNumber = order.order_number || `ORD-${order.id ? order.id.substring(0, 8).toUpperCase() : String(idx + 1001)}`;

            return {
                ...order,
                order_number: orderNumber,
                customer_name: customerName,
                user_email: email,
                email: email,
                book_name: bookName,
                currency: order.currency || 'AED',
                download_count: order.download_count || 0,
                download_limit: order.download_limit || 3,
                refund_status: order.refund_status || (order.status === 'refunded' ? 'refunded' : null),
            };
        });

        // Search filter
        if (search) {
            const s = search.toLowerCase();
            enrichedOrders = enrichedOrders.filter(o => 
                o.order_number?.toLowerCase().includes(s) ||
                o.customer_name?.toLowerCase().includes(s) ||
                o.email?.toLowerCase().includes(s) ||
                o.book_name?.toLowerCase().includes(s)
            );
        }

        return res.status(200).json({ orders: enrichedOrders });
    } catch (err) {
        console.error('Fetch orders error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/orders/export-csv — Export orders as a CSV file
router.get('/export-csv', async (req, res) => {
    try {
        const { data: orders, error } = await supabaseAdmin
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        const headers = [
            'Order ID',
            'Order Number',
            'Customer Name',
            'Customer Email',
            'Product Name',
            'Amount',
            'Currency',
            'Payment Status',
            'Downloads Used',
            'Download Limit',
            'Created At'
        ];

        const rows = (orders || []).map((o, idx) => [
            `"${o.id || ''}"`,
            `"${o.order_number || `ORD-${o.id ? o.id.substring(0, 8).toUpperCase() : idx + 1001}`}"`,
            `"${(o.customer_name || '').replace(/"/g, '""')}"`,
            `"${o.email || ''}"`,
            `"${(o.book_name || 'Marketing Reclassified').replace(/"/g, '""')}"`,
            Number(o.amount || 0).toFixed(2),
            o.currency || 'AED',
            o.status || 'pending',
            o.download_count || 0,
            o.download_limit || 3,
            `"${new Date(o.created_at).toISOString()}"`
        ]);

        const csvString = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="siddiqui-digital-orders-${Date.now()}.csv"`);
        return res.send(csvString);
    } catch (err) {
        console.error('CSV export error:', err);
        return res.status(500).json({ error: 'Failed to export CSV' });
    }
});

// POST /api/orders/:id/refund — Record refund for an order
router.post('/:id/refund', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('orders')
            .update({
                status: 'refunded',
            })
            .eq('id', id);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ message: 'Order marked as refunded successfully' });
    } catch (err) {
        console.error('Order refund error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
