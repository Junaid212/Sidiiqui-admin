/**
 * adminAudit.js - the audit log for EVERY administrator action.
 *
 * Two layers write to the same table (admin_audit_log):
 *   - the routes that already record a specific entry with the written reason (grant, revoke, import, remove, ...), and
 *   - this middleware, which records every change a signed-in administrator makes through the dashboard API (POST / PUT / PATCH /
 *     DELETE), and every request that was REFUSED (403), whoever made it and whatever the route. So nothing an admin does can
 *     miss the log, even for a route that never had its own entry.
 * What is stored: who (id + e-mail), their role, the method, the route with ids replaced by :id, the result status. Never request
 * bodies, passwords or tokens. Writing the log is best effort and never slows or breaks the request itself.
 */
'use strict';
const { supabaseAdmin } = require('../config/supabase');

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** /api/orders/3f2a...-uuid/refund?x=1 -> POST /api/orders/:id/refund */
function routeKey(method, url) {
    const p = String(url || '').split('?')[0]
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
        .replace(/\/\d{3,}(?=\/|$)/g, '/:id');
    return `${method} ${p}`.slice(0, 140);
}

function record(entry) {
    try {
        const p = supabaseAdmin.from('admin_audit_log').insert([entry]);
        if (p && typeof p.then === 'function') p.then(() => {}, () => {});
    } catch { /* best effort */ }
}

/** Mount AFTER requireAdmin so req.user and req.adminRole exist. */
function auditAdminRequests(req, res, next) {
    const method = req.method;
    const url = req.originalUrl;
    res.on('finish', () => {
        const status = res.statusCode;
        if (!WRITE.has(method) && status !== 403) return;
        const u = req.user || {};
        record({
            actor_id: u.id || null,
            actor_label: u.email || null,
            action: status === 403 ? 'admin.denied' : status >= 400 ? 'admin.request_failed' : 'admin.request',
            target_type: 'api',
            target_id: routeKey(method, url),
            detail: { role: req.adminRole || null, method, status },
        });
    });
    next();
}

/** A specific, hand-written entry (used by the team routes). */
function logAudit(req, action, targetType, targetId, detail) {
    const u = (req && req.user) || {};
    record({ actor_id: u.id || null, actor_label: u.email || null, action, target_type: targetType || null, target_id: targetId ? String(targetId).slice(0, 140) : null, detail: detail || {} });
}

module.exports = { auditAdminRequests, logAudit, routeKey };
