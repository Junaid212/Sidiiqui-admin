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

// ---------------------------------------------------------------------------------------------------------------------
// Grant access by hand, and import Payhip orders whose webhook never arrived. Both create ordinary order rows (the same shape
// the webhook writes) and then run the normal order -> access rule, so the customer sees them in My Orders and gets the reader,
// downloads and Ask SID exactly as a webhook purchase would. Every write needs a written reason and is audited.
// ---------------------------------------------------------------------------------------------------------------------
const imp = require('../utils/orderImport');
const audit = (req, action, target, detail) => supabaseAdmin.from('admin_audit_log').insert([{ actor_id: req.user.id, actor_label: req.user.email, action, target_type: 'order', target_id: String(target).slice(0, 80), detail }]);
const reasonOf = (b) => (typeof (b && b.reason) === 'string' ? b.reason.trim() : '');

router.post('/grant', async (req, res) => {
    const email = sync.normalizeEmail(req.body && req.body.email);
    const edition = req.body && req.body.edition;
    const reason = reasonOf(req.body);
    if (!imp.EMAIL_RE.test(email)) return fail(res, 400, 'A valid e-mail address is required.');
    if (!['online', 'companion'].includes(edition)) return fail(res, 400, 'edition must be "online" or "companion".');
    if (reason.length < 5 || reason.length > 500) return fail(res, 400, 'A written reason of at least 5 characters is required.');
    const { data: act, error: aerr } = await supabaseAdmin.from('user_entitlements').select('id,edition').eq('email', email).eq('status', 'active').maybeSingle();
    if (aerr) return notInstalled(res, aerr);
    if (act && (act.edition === 'companion' || act.edition === edition)) return fail(res, 409, `This person already has active ${act.edition === 'companion' ? 'Digital Companion' : 'Online Reading'} access.`);
    // Optional, Digital Companion only: the Ask SID question total and how many months Ask SID access lasts.
    const b = req.body || {};
    const questions = b.questions === undefined || b.questions === null || b.questions === '' ? null : Number(b.questions);
    const months = b.months === undefined || b.months === null || b.months === '' ? null : Number(b.months);
    if (questions !== null && (!Number.isInteger(questions) || questions < 1 || questions > 2000)) return fail(res, 400, 'Ask SID questions must be a whole number from 1 to 2000.');
    if (months !== null && (!Number.isInteger(months) || months < 1 || months > 60)) return fail(res, 400, 'Duration must be a whole number of months from 1 to 60.');
    if (edition === 'online' && (questions !== null || months !== null)) return fail(res, 400, 'Online Reading has no Ask SID questions and no end date. Leave those fields empty, or choose Digital Companion.');

    // A complimentary grant must NEVER take one of the 200 launch positions. The database gives a position to any Companion grant dated
    // on or after the launch start, so the grant is dated just before it (nothing else about the grant changes: the dates the customer
    // sees are set below). If the offer is not configured at all we stop rather than risk it.
    const { data: cfg } = await supabaseAdmin.from('entitlement_settings').select('value').eq('key', 'ask_sid_limits').maybeSingle();
    const limits = (cfg && cfg.value) || null;
    if (!limits || !limits.launch_starts_at) return fail(res, 409, 'The launch offer is not configured, so a grant could take a launch position. Nothing was changed.');
    const now = new Date();
    const starts = new Date(limits.launch_starts_at);
    const paidAt = starts <= now ? new Date(starts.getTime() - 1000) : now;

    const row = imp.buildOrderRow({ email, name: String(b.name || '').trim().slice(0, 120) || 'Valued Reader', edition, txid: 'G' + Date.now().toString(36).toUpperCase(), provider: 'manual', actor: req.user.email, reason });
    row.raw_metadata = { ...row.raw_metadata, complimentary: true }; // not a sale: kept out of order totals and revenue
    const ins = await imp.insertOrder(supabaseAdmin, row);
    if (!ins.ok) return fail(res, 500, `The order could not be created: ${ins.error.message}`);

    const { data: g, error: gerr } = await supabaseAdmin.rpc('grant_entitlement_for_order', {
        p_order_id: ins.row.id, p_email: email, p_user_id: null, p_edition: edition, p_is_upgrade: false, p_paid_at: paidAt.toISOString(), p_catalog: sync.CATALOG_KEY,
    });
    if (gerr) { await supabaseAdmin.from('orders').delete().eq('id', ins.row.id); return fail(res, 500, `The access could not be granted: ${gerr.message}`); }
    if (g && g.launch_position) return fail(res, 500, 'Unexpected: a launch position was assigned. Please tell the developer.'); // cannot happen with the date above

    let applied = { questions: null, expiresAt: null };
    if (edition === 'companion' && g && g.entitlement_id) {
        const expires = new Date(now); expires.setUTCMonth(expires.getUTCMonth() + (months || Number(limits.months) || 12));
        const patch = { granted_at: now.toISOString(), ask_sid_expires_at: expires.toISOString() };
        if (questions !== null) patch.total_question_limit = questions;
        const up = await supabaseAdmin.from('user_entitlements').update(patch).eq('id', g.entitlement_id);
        if (up.error) return fail(res, 500, `The grant was created but its dates could not be set: ${up.error.message}`);
        applied = { questions: questions !== null ? questions : (g.total_limit || null), expiresAt: patch.ask_sid_expires_at };
        await supabaseAdmin.from('entitlement_events').insert([{ entitlement_id: g.entitlement_id, email, order_id: ins.row.id, event_type: 'admin_complimentary_grant', detail: { reason, questions: applied.questions, months: months || Number(limits.months) || 12 }, actor_id: req.user.id, actor_label: req.user.email }]);
    }
    await audit(req, 'entitlement.manual_grant', ins.row.id, { email: email.replace(/^(.).*(@.*)$/, '$1***$2'), edition, reason, questions: applied.questions, months, result: (g && g.result) || null });
    res.status(201).json({ ok: true, orderNumber: ins.row.order_number, edition, result: g, ...applied });
});

router.post('/import-payhip', async (req, res) => {
    const csv = req.body && req.body.csv;
    if (typeof csv !== 'string' || csv.length < 10) return fail(res, 400, 'Paste the contents of the Payhip export (CSV).');
    if (csv.length > 90000) return fail(res, 413, 'The file is too large for one import. Split it into smaller parts.');
    const out = imp.interpretPayhipCsv(csv);
    if (!out.ok) return fail(res, 400, out.error);
    // Orders already stored (by Payhip order id + what was bought) are never imported twice.
    const ids = [...new Set(out.items.filter((i) => i.action === 'import').map((i) => i.txid))];
    const have = new Set();
    if (ids.length) {
        const { data: ex, error } = await supabaseAdmin.from('orders').select('payhip_transaction_id,access_tier,is_upgrade').in('payhip_transaction_id', ids);
        if (error) return fail(res, 500, error.message);
        for (const o of ex || []) have.add(`${o.payhip_transaction_id}|${o.access_tier}|${o.is_upgrade === true}`);
    }
    const seen = new Set();
    for (const it of out.items) {
        if (it.action !== 'import') continue;
        const k = `${it.txid}|${it.edition}|${it.isUpgrade}`;
        if (have.has(k) || seen.has(k)) { it.action = 'skip'; it.reason = 'already imported'; } else seen.add(k);
    }
    const summary = { total: out.items.length, toImport: out.items.filter((i) => i.action === 'import').length, skipped: out.items.filter((i) => i.action === 'skip').length };
    if (!(req.body && req.body.apply === true)) return res.json({ dryRun: true, columns: out.columns, summary, items: out.items });

    const reason = reasonOf(req.body);
    if (reason.length < 5 || reason.length > 500) return fail(res, 400, 'A written reason of at least 5 characters is required.');
    // The administrator may untick rows in the preview: only the chosen file rows are imported (omitted = all that passed the check).
    const only = Array.isArray(req.body.lines) ? new Set(req.body.lines.map(Number)) : null;
    if (only && only.size === 0) return fail(res, 400, 'No rows were selected.');
    const todo = out.items.filter((i) => i.action === 'import' && (!only || only.has(i.line))).sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))); // oldest first: an upgrade must follow its Online purchase
    const done = [];
    for (const it of todo) {
        const row = imp.buildOrderRow({ email: it.email, name: it.name, edition: it.edition, isUpgrade: it.isUpgrade, txid: it.txid, amount: it.amount, currency: it.currency, createdAt: it.date || undefined, provider: 'payhip', actor: req.user.email, reason });
        const ins = await imp.insertOrder(supabaseAdmin, row);
        if (!ins.ok) { done.push({ line: it.line, ok: false, error: ins.error.message }); continue; }
        const r = await sync.syncOrderEntitlement(ins.row);
        done.push({ line: it.line, ok: r.ok !== false, edition: it.edition, result: r.result || r.skipped || r.error || null });
    }
    await audit(req, 'entitlement.import_payhip', `import-${Date.now()}`, { reason, imported: done.filter((d) => d.ok).length, failed: done.filter((d) => !d.ok).length, skipped: summary.skipped });
    res.json({ dryRun: false, summary: { ...summary, selected: todo.length, imported: done.filter((d) => d.ok).length, failed: done.filter((d) => !d.ok).length }, results: done });
});

module.exports = router;
