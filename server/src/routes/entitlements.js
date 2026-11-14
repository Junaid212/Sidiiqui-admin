/**
 * /api/entitlements - Digital Companion and Online Reading customer management (mounted behind requireAdmin).
 * Read: customers by edition / status, purchase + upgrade history, access status and expiry, launch-offer position,
 * question usage and remaining allowance, refund status, webhook deliveries and failures.
 * Write (always with a written reason, always audited, one database transaction): revoke, restore, extend, add questions,
 * open the launch offer, re-check a customer's orders.
 */
const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const sync = require('../utils/entitlementSync');

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (res, code, message) => res.status(code).json({ error: message });
const page = (req) => { const p = Math.max(1, parseInt(req.query.page, 10) || 1); const s = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25)); return { p, s, from: (p - 1) * s, to: (p - 1) * s + s - 1 }; };
const notInstalled = (res, error) => (error && /does not exist|schema cache|PGRST20/.test(`${error.code} ${error.message}`) ? fail(res, 503, 'The entitlement tables are not installed yet (database migration pending).') : fail(res, 500, error.message));
const status = (e) => (e.revoked_at ? 'revoked' : e.edition === 'companion' && e.ask_sid_expires_at && new Date(e.ask_sid_expires_at) <= new Date() ? 'ask_sid_expired' : 'active');

router.get('/overview', async (_req, res) => {
    const { data: ents, error } = await supabaseAdmin.from('user_entitlements').select('edition,status,is_upgrade,revoke_reason,launch_position');
    if (error) return notInstalled(res, error);
    const c = { onlineActive: 0, companionActive: 0, upgradedActive: 0, revoked: 0, refunded: 0, launchPositionsUsed: 0 };
    for (const e of ents || []) {
        if (e.status === 'active') { if (e.edition === 'online') c.onlineActive++; else { c.companionActive++; if (e.is_upgrade) c.upgradedActive++; } } else c.revoked++;
        if (['full_refund', 'chargeback'].includes(e.revoke_reason)) c.refunded++;
        if (e.launch_position) c.launchPositionsUsed++;
    }
    const { data: lim } = await supabaseAdmin.from('entitlement_settings').select('value').eq('key', 'ask_sid_limits').maybeSingle();
    const v = (lim && lim.value) || {};
    const startsAt = v.launch_starts_at ? new Date(v.launch_starts_at) : null;
    res.json({ counts: c, limits: { daily: v.daily, standardTotal: v.standard_total, launchTotal: v.launch_total, launchSize: v.launch_size, months: v.months },
        launchOffer: { startsAt: v.launch_starts_at || null, open: !startsAt || startsAt <= new Date(), positionsRemaining: Math.max((v.launch_size || 200) - c.launchPositionsUsed, 0) } });
});

router.get('/', async (req, res) => {
    const { from, to, p, s } = page(req);
    let q = supabaseAdmin.from('user_entitlements').select('*', { count: 'exact' });
    const group = String(req.query.group || 'all');
    if (group === 'online') q = q.eq('edition', 'online').eq('status', 'active');
    else if (group === 'companion') q = q.eq('edition', 'companion').eq('status', 'active').eq('is_upgrade', false);
    else if (group === 'upgraded') q = q.eq('edition', 'companion').eq('is_upgrade', true).eq('status', 'active');
    else if (group === 'revoked') q = q.eq('status', 'revoked');
    else if (group === 'refunded') q = q.in('revoke_reason', ['full_refund', 'chargeback']);
    if (req.query.edition === 'online' || req.query.edition === 'companion') q = q.eq('edition', req.query.edition);
    if (req.query.q) q = q.ilike('email', `%${sync.escapeLike(sync.normalizeEmail(req.query.q))}%`);
    const { data, error, count } = await q.order('granted_at', { ascending: false }).range(from, to);
    if (error) return notInstalled(res, error);
    const ids = [...new Set((data || []).map((e) => e.order_id).filter(Boolean))];
    const orders = ids.length ? ((await supabaseAdmin.from('orders').select('id,order_number,payment_provider,amount,currency,created_at,status,refund_status').in('id', ids)).data || []) : [];
    const byId = Object.fromEntries(orders.map((o) => [o.id, o]));
    const items = [];
    for (const e of data || []) {
        let allowance = null;
        if (e.edition === 'companion') { const a = await supabaseAdmin.rpc('ask_sid_allowance', { p_entitlement_id: e.id }); allowance = a.data || null; }
        items.push({ id: e.id, email: e.email, edition: e.edition, isUpgrade: e.is_upgrade, accessStatus: status(e), revokeReason: e.revoke_reason, grantedAt: e.granted_at, askSidExpiresAt: e.ask_sid_expires_at,
            launchPosition: e.launch_position, order: byId[e.order_id] || null, allowance });
    }
    res.json({ items, total: count || 0, page: p, pageSize: s });
});

router.get('/webhooks', async (req, res) => {
    const { from, to, p, s } = page(req);
    let q = supabaseAdmin.from('webhook_events').select('*', { count: 'exact' });
    if (['received', 'processed', 'duplicate', 'ignored', 'rejected', 'failed'].includes(req.query.outcome)) q = q.eq('outcome', req.query.outcome);
    const { data, error, count } = await q.order('last_seen_at', { ascending: false }).range(from, to);
    if (error) return notInstalled(res, error);
    res.json({ items: data || [], total: count || 0, page: p, pageSize: s });
});

router.get('/audit', async (req, res) => {
    const { from, to } = page(req);
    const { data, error } = await supabaseAdmin.from('admin_audit_log').select('*').order('id', { ascending: false }).range(from, to);
    if (error) return notInstalled(res, error);
    res.json({ items: data || [] });
});

router.get('/:id', async (req, res) => {
    if (!UUID.test(req.params.id)) return fail(res, 400, 'Invalid id');
    const { data: e, error } = await supabaseAdmin.from('user_entitlements').select('*').eq('id', req.params.id).maybeSingle();
    if (error) return notInstalled(res, error);
    if (!e) return fail(res, 404, 'Not found');
    const [orders, events, usage, prior] = await Promise.all([
        supabaseAdmin.from('orders').select('id,order_number,payment_provider,amount,currency,status,refund_status,is_upgrade,access_tier,book_name,created_at').ilike('email', sync.escapeLike(e.email)).order('created_at', { ascending: true }),
        supabaseAdmin.from('entitlement_events').select('id,event_type,detail,actor_label,created_at').eq('entitlement_id', e.id).order('id', { ascending: true }),
        e.edition === 'companion' ? supabaseAdmin.from('ask_sid_usage').select('day,status').eq('entitlement_id', e.id) : Promise.resolve({ data: [] }),
        e.supersedes_id ? supabaseAdmin.from('user_entitlements').select('id,edition,granted_at,revoked_at,revoke_reason,order_id').eq('id', e.supersedes_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const perDay = {};
    for (const u of usage.data || []) if (u.status === 'committed') perDay[u.day] = (perDay[u.day] || 0) + 1;
    const allowance = e.edition === 'companion' ? (await supabaseAdmin.rpc('ask_sid_allowance', { p_entitlement_id: e.id })).data : null;
    res.json({ entitlement: { ...e, accessStatus: status(e) }, allowance, orders: orders.data || [], events: events.data || [], usageByDay: perDay, replacedEntitlement: prior.data || null });
});

const ACTIONS = ['revoke', 'restore', 'extend_months', 'add_questions'];
router.post('/:id/action', async (req, res) => {
    if (!UUID.test(req.params.id)) return fail(res, 400, 'Invalid id');
    const { action, reason } = req.body || {};
    const amount = req.body && req.body.amount !== undefined ? Number(req.body.amount) : null;
    if (!ACTIONS.includes(action)) return fail(res, 400, `action must be one of ${ACTIONS.join(', ')}`);
    if (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500) return fail(res, 400, 'A written reason of at least 5 characters is required.');
    if ((action === 'extend_months' || action === 'add_questions') && !Number.isInteger(amount)) return fail(res, 400, 'amount must be a whole number.');
    const { data, error } = await supabaseAdmin.rpc('admin_entitlement_action', { p_entitlement_id: req.params.id, p_action: action, p_amount: amount, p_reason: reason.trim(), p_actor_id: req.user.id, p_actor_label: req.user.email });
    if (error) {
        const m = String(error.message);
        if (/entitlement_not_found/.test(m)) return fail(res, 404, 'Not found');
        if (/refunded_entitlement_cannot_be_restored/.test(m)) return fail(res, 409, 'A refunded purchase cannot be restored. Ask the customer to buy again, or grant extra questions to a new entitlement.');
        if (/already_revoked|not_revoked|another_entitlement_active|bad_amount|reason_required/.test(m)) return fail(res, 409, m.replace(/^.*?:\s*/, ''));
        return notInstalled(res, error);
    }
    res.json(data);
});

// Open (or schedule) the first-200 launch offer. Until it is opened no purchase can take a launch position, so old and test orders never do.
router.post('/launch', async (req, res) => {
    const { startsAt, reason } = req.body || {};
    if (typeof reason !== 'string' || reason.trim().length < 5) return fail(res, 400, 'A written reason is required.');
    const when = startsAt === 'now' || startsAt === undefined ? new Date() : new Date(startsAt);
    if (Number.isNaN(when.getTime())) return fail(res, 400, 'startsAt must be "now" or an ISO date.');
    const { data: cur } = await supabaseAdmin.from('entitlement_settings').select('value').eq('key', 'ask_sid_limits').maybeSingle();
    if (!cur) return fail(res, 503, 'The entitlement tables are not installed yet (database migration pending).');
    const { count } = await supabaseAdmin.from('launch_allocations').select('position', { count: 'exact', head: true });
    if ((count || 0) > 0 && when > new Date(cur.value.launch_starts_at || 0)) return fail(res, 409, 'Positions have already been allocated; the start date can no longer be moved later.');
    const value = { ...cur.value, launch_starts_at: when.toISOString() };
    const { error } = await supabaseAdmin.from('entitlement_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', 'ask_sid_limits');
    if (error) return fail(res, 500, error.message);
    await supabaseAdmin.from('admin_audit_log').insert([{ actor_id: req.user.id, actor_label: req.user.email, action: 'entitlement.launch_offer', target_type: 'entitlement_settings', target_id: 'ask_sid_limits', detail: { startsAt: value.launch_starts_at, reason: reason.trim() } }]);
    res.json({ launchStartsAt: value.launch_starts_at });
});

// Re-check one customer's orders (idempotent): repairs an entitlement if a webhook was missed.
router.post('/reconcile', async (req, res) => {
    const email = sync.normalizeEmail(req.body && req.body.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, 'A valid e-mail address is required.');
    const out = await sync.syncEmail(email);
    await supabaseAdmin.from('admin_audit_log').insert([{ actor_id: req.user.id, actor_label: req.user.email, action: 'entitlement.reconcile', target_type: 'customer', target_id: email.replace(/^(.).*(@.*)$/, '$1***$2'), detail: { orders: out.results.length, ok: out.ok } }]);
    res.json(out);
});

module.exports = router;
