/**
 * permissions.js - who may do what in the admin dashboard. ONE place, so the rules are easy to read and to change.
 *
 * Roles (stored in the Supabase user's app_metadata.role, which only the server can write):
 *   'admin'   = OWNER. Full access, including payments, coupons, customers, settings and adding / removing admins.
 *               (The stored value stays 'admin' so every account that is an administrator today keeps working unchanged.)
 *   'editor'  = Online Reading (chapters, import, publish), Blog, Ask SID settings and Companion Files.
 *               No orders, customers, coupons, products or payment settings.
 *   'support' = view orders and customers, grant or revoke reader access, read contact messages (reply by e-mail from the message).
 *               Cannot edit content or settings.
 *
 * The role is read from the Auth server on EVERY request (see middleware/auth.js), so removing a person or changing their role
 * takes effect immediately. Anything not listed here is refused: a new route is owner-only until it is given a permission.
 */
'use strict';

const OWNER = 'admin';
const STAFF = ['editor', 'support'];
const LABELS = { admin: 'Owner', editor: 'Editor', support: 'Support' };

// every permission that exists (the owner has all of them)
const ALL = [
    'dashboard',          // sales / activity statistics on the dashboard
    'orders.view', 'orders.manage',          // manage = refund, remove, mark as test, export
    'customers.view', 'customers.grant',     // grant = give or revoke / restore reader access, re-check a customer
    'customers.manage',   // extend, add questions, open the launch offer, import Payhip orders
    'coupons', 'products', 'settings',       // settings = the launch offer shown on the site
    'reading', 'blog', 'asksid', 'companion', // content areas
    'messages.view', 'messages.manage',      // manage = delete a contact message
    'analytics',          // sign-ins, course clicks, questionnaire
    'consultations',
    'audit',              // the audit log and webhook delivery log
    'team',               // add / change / remove admins
];

const BY_ROLE = {
    admin: ALL,
    editor: ['reading', 'blog', 'asksid', 'companion'],
    support: ['orders.view', 'customers.view', 'customers.grant', 'messages.view'],
};

/** 'admin' | 'editor' | 'support' | null for a Supabase user object. Only app_metadata counts (a user cannot edit it). */
function roleOf(user) {
    if (!user || typeof user !== 'object') return null;
    const meta = user.app_metadata;
    if (!meta || typeof meta !== 'object') return null;
    if (meta.role === OWNER || (Array.isArray(meta.roles) && meta.roles.includes(OWNER))) return OWNER;
    if (STAFF.includes(meta.role)) return meta.role;
    return null;
}

const permissionsOf = (role) => (BY_ROLE[role] ? BY_ROLE[role].slice() : []);
const can = (role, permission) => !!BY_ROLE[role] && BY_ROLE[role].includes(permission);
const labelOf = (role) => LABELS[role] || 'None';

module.exports = { OWNER, STAFF, LABELS, ALL, roleOf, permissionsOf, can, labelOf };
