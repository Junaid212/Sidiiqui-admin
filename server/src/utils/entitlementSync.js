/**
 * entitlementSync.js - the admin server's copy of the order -> entitlement rules used by the customer API
 * (server/utils/entitlements.js there). Used when an administrator refunds an order and by "Re-check this customer".
 * Both servers call the same database functions, which hold the real rules (one active entitlement per customer, atomic launch
 * allocation, quota); this file only maps an order row to those calls. Keep the two mappings identical.
 */
const { supabaseAdmin } = require('../config/supabase');

const CATALOG_KEY = 'marketing-reclassified';
const MR_PRODUCT_ID = String(process.env.MR_PRODUCT_ID || '04b84648-3609-4b31-9ded-2486bacf1e74').toLowerCase();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (v) => (v && UUID_RE.test(String(v)) ? String(v) : null);
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
const escapeLike = (v) => String(v).replace(/[\\%_]/g, (c) => '\\' + c);

const isRefundedOrder = (o) => !!o && (String(o.status || '').toLowerCase() === 'refunded' || ['refunded', 'full'].includes(String(o.refund_status || '').toLowerCase()));
const isPaidOrder = (o) => !!o && (o.status === 'paid' || o.status === 'successful') && !isRefundedOrder(o);
const isCatalogOrder = (o) => !!o && (String(o.product_id || '').toLowerCase() === MR_PRODUCT_ID || String(o.book_name || '').toLowerCase().includes('marketing reclassified'));
function editionFromOrder(o) {
    if (o.is_upgrade === true) return 'companion';
    const tier = String(o.access_tier || o.edition_type || '').toLowerCase();
    if (tier === 'online') return 'online';
    if (tier === 'companion' || tier === 'upgrade') return 'companion';
    const name = String(o.book_name || '').toLowerCase();
    if (name.includes('companion') || name.includes('upgrade')) return 'companion';
    if (name.includes('online')) return 'online';
    return Number(o.amount) < 30 ? 'online' : 'companion';
}

async function syncOrderEntitlement(order) {
    try {
        if (!order || !order.id) return { ok: false, skipped: 'no_order' };
        if (!isCatalogOrder(order)) return { ok: true, skipped: 'not_catalog' };
        const email = normalizeEmail(order.email);
        if (!email) return { ok: false, skipped: 'no_email' };
        if (isRefundedOrder(order)) {
            const { data, error } = await supabaseAdmin.rpc('revoke_entitlement_for_order', { p_order_id: order.id, p_reason: 'full_refund' });
            if (error) throw new Error(error.message);
            return { ok: true, action: 'revoke', ...data };
        }
        if (!isPaidOrder(order)) return { ok: true, skipped: 'not_paid' };
        const { data, error } = await supabaseAdmin.rpc('grant_entitlement_for_order', {
            p_order_id: order.id, p_email: email, p_user_id: uuidOrNull(order.user_id), p_edition: editionFromOrder(order),
            p_is_upgrade: order.is_upgrade === true, p_paid_at: order.created_at || new Date().toISOString(), p_catalog: CATALOG_KEY,
        });
        if (error) throw new Error(error.message);
        return { ok: true, action: 'grant', ...data };
    } catch (err) {
        console.error(`[entitlementSync] order ${order && order.id}: ${err.message}`);
        return { ok: false, error: err.message };
    }
}

async function syncEmail(email) {
    const e = normalizeEmail(email);
    const { data: orders, error } = await supabaseAdmin.from('orders').select('*').ilike('email', escapeLike(e)).order('created_at', { ascending: true }).limit(200);
    if (error) return { ok: false, error: error.message, results: [] };
    const results = [];
    for (const o of orders || []) results.push({ order: o.order_number || o.id, ...(await syncOrderEntitlement(o)) });
    return { ok: results.every((r) => r.ok), results };
}

// How far ahead the end date is set when a complimentary Companion access is given "no end date" (the database needs a date; anything this far away is shown as "No end date").
const NO_END_YEARS = 100;

module.exports = { NO_END_YEARS, CATALOG_KEY, normalizeEmail, escapeLike, isRefundedOrder, isPaidOrder, isCatalogOrder, editionFromOrder, syncOrderEntitlement, syncEmail };
