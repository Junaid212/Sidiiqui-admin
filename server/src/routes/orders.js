const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { isTestOrder, isComplimentaryOrder } = require('../utils/testOrders');

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
                amount: order.raw_metadata?.exact_amount ? Number(order.raw_metadata.exact_amount) : Number(order.amount || 0),
                currency: order.currency || 'USD',
                download_count: order.download_count || 0,
                download_limit: order.download_limit || 3,
                refund_status: order.refund_status || (order.status === 'refunded' ? 'refunded' : null),
                is_test: isTestOrder(order),
                is_complimentary: isComplimentaryOrder(order),
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
            Number(o.raw_metadata?.exact_amount ? o.raw_metadata.exact_amount : o.amount || 0).toFixed(2),
            o.currency || 'USD',
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

        // A refund must revoke access, not only relabel the order: clear the download token and mark the
        // refund so every download / reader check on the customer API denies it. If this database has not
        // got one of the extra columns yet, fall back to the original status-only update (never a regression;
        // the customer API already denies status === 'refunded').
        let { error } = await supabaseAdmin
            .from('orders')
            .update({ status: 'refunded', refund_status: 'refunded', download_token: null })
            .eq('id', id);
        let accessRevoked = !error;

        if (error) {
            ({ error } = await supabaseAdmin
                .from('orders')
                .update({ status: 'refunded' })
                .eq('id', id));
        }

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // A refund also ends the customer's entitlement (Companion downloads / Ask SID / online reader). History is kept.
        // Best effort: the customer API additionally re-checks the source order on every access, so a failure here cannot leave access open.
        let entitlementRevoked = null;
        try {
            const { data: refunded } = await supabaseAdmin.from('orders').select('*').eq('id', id).maybeSingle();
            if (refunded) entitlementRevoked = (await require('../utils/entitlementSync').syncOrderEntitlement({ ...refunded, status: 'refunded', refund_status: 'refunded' })).ok;
        } catch (e) { console.warn('Entitlement revoke after refund:', e.message); }

        return res.status(200).json({
            message: 'Order marked as refunded successfully',
            downloadTokenCleared: accessRevoked,
            entitlementRevoked,
        });
    } catch (err) {
        console.error('Order refund error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/orders/mark-test { ids: [uuid], reason, test? (default true) } — keep the orders AND the access they give, but stop
// counting them as sales/orders in the totals. test:false puts them back. Stored in raw_metadata.is_test; audited with the reason.
router.post('/mark-test', async (req, res) => {
    try {
        const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const { ids, reason } = req.body || {};
        const test = !(req.body && req.body.test === false);
        if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || !ids.every((i) => typeof i === 'string' && UUID.test(i))) return res.status(400).json({ error: 'Choose between 1 and 200 orders.' });
        if (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500) return res.status(400).json({ error: 'A written reason of at least 5 characters is required.' });
        const { data: rows, error } = await supabaseAdmin.from('orders').select('id,order_number,raw_metadata').in('id', ids);
        if (error) return res.status(/raw_metadata/.test(error.message) ? 503 : 500).json({ error: /raw_metadata/.test(error.message) ? 'This database cannot store the test flag yet (orders.raw_metadata is missing).' : error.message });
        if (!rows || rows.length === 0) return res.status(404).json({ error: 'None of those orders exist any more.' });
        let changed = 0;
        for (const r of rows) {
            const meta = { ...((r.raw_metadata && typeof r.raw_metadata === 'object') ? r.raw_metadata : {}) };
            if (test) meta.is_test = true; else delete meta.is_test;
            const up = await supabaseAdmin.from('orders').update({ raw_metadata: meta }).eq('id', r.id);
            if (up.error) return res.status(500).json({ error: `Could not update ${r.order_number || r.id}: ${up.error.message}` });
            changed++;
        }
        await supabaseAdmin.from('admin_audit_log').insert([{ actor_id: req.user.id, actor_label: req.user.email, action: test ? 'order.mark_test' : 'order.unmark_test', target_type: 'order', target_id: String(rows[0].order_number || rows[0].id).slice(0, 80), detail: { reason: reason.trim(), orders: rows.map((r) => r.order_number || r.id).slice(0, 200) } }]);
        return res.json({ updated: changed, test });
    } catch (err) {
        console.error('Order mark-test error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/orders/remove { ids: [uuid], reason, revokeAccess? } — remove TEST orders so the totals show only real sales.
// A full copy of each order is written to the audit log first (so nothing is lost and an order can be restored by hand); if that
// copy cannot be saved, nothing is deleted. An order that currently gives someone access is refused unless revokeAccess is true.
router.post('/remove', async (req, res) => {
    try {
        const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const { ids, reason, revokeAccess } = req.body || {};
        if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || !ids.every((i) => typeof i === 'string' && UUID.test(i))) return res.status(400).json({ error: 'Choose between 1 and 200 orders.' });
        if (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500) return res.status(400).json({ error: 'A written reason of at least 5 characters is required.' });

        const { data: rows, error } = await supabaseAdmin.from('orders').select('*').in('id', ids);
        if (error) return res.status(500).json({ error: error.message });
        if (!rows || rows.length === 0) return res.status(404).json({ error: 'None of those orders exist any more.' });

        // Access that still depends on these orders.
        const { data: ents } = await supabaseAdmin.from('user_entitlements').select('id,order_id,email,edition,status').in('order_id', rows.map((r) => r.id));
        const active = (ents || []).filter((e) => e.status === 'active');
        if (active.length && revokeAccess !== true) {
            const names = active.map((e) => (rows.find((r) => r.id === e.order_id) || {}).order_number || e.order_id);
            return res.status(409).json({ error: `${active.length} of these orders currently give a customer access (${names.slice(0, 5).join(', ')}${names.length > 5 ? '…' : ''}). Tick "also end their access" to remove them anyway.`, activeCount: active.length });
        }

        const snapshots = rows.map((r) => ({ actor_id: req.user.id, actor_label: req.user.email, action: 'order.remove', target_type: 'order', target_id: String(r.order_number || r.id).slice(0, 80), detail: { reason: reason.trim(), order: r } }));
        const saved = await supabaseAdmin.from('admin_audit_log').insert(snapshots);
        if (saved.error) return res.status(500).json({ error: `Nothing was deleted: the safety copy could not be saved (${saved.error.message}).` });

        for (const e of active) {
            const r = await supabaseAdmin.rpc('admin_entitlement_action', { p_entitlement_id: e.id, p_action: 'revoke', p_amount: null, p_reason: `Order removed: ${reason.trim()}`.slice(0, 500), p_actor_id: req.user.id, p_actor_label: req.user.email });
            if (r.error) return res.status(500).json({ error: `Nothing was deleted: access could not be ended (${r.error.message}).` });
        }

        const del = await supabaseAdmin.from('orders').delete().in('id', rows.map((r) => r.id));
        if (del.error) return res.status(500).json({ error: `The orders could not be deleted: ${del.error.message}` });
        return res.json({ removed: rows.length, missing: ids.length - rows.length, accessEnded: active.length });
    } catch (err) {
        console.error('Order remove error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
