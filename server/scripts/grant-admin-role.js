#!/usr/bin/env node
/**
 * Verify, grant, revoke or list dashboard administrators.
 *
 * The admin API treats a user as an administrator only when their Supabase app_metadata.role is
 * 'admin' (see src/middleware/auth.js). app_metadata can only be written with the service-role key,
 * so customers cannot give themselves the role. Run this on the server (it reads SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY from server/.env) BEFORE deploying the version that enforces the check,
 * for every person who currently uses the dashboard.
 *
 * Recommended procedure (nothing is changed until step 4):
 *   1. node server/scripts/grant-admin-role.js --candidates
 *        Read-only. Lists accounts that have authored dashboard content (blogs / admin comments) - the dashboard
 *        stamps the signed-in user on those - with a MASKED e-mail, sign-in method and dates.
 *   2. node server/scripts/grant-admin-role.js --inspect <email>
 *        Read-only. Shows one account and warns if it also has customer orders (probably a customer, not staff).
 *   3. node server/scripts/grant-admin-role.js <email>
 *        Still read-only: prints exactly what WOULD change.
 *   4. node server/scripts/grant-admin-role.js <email> --apply
 *        Grants the role.   Add --revoke to take it away again.   --list shows the current administrators.
 *
 * Only the 'role' key of app_metadata is touched; provider information is preserved. E-mail addresses are
 * masked (j***@example.com) in all output, and keys and passwords are never printed.
 */
'use strict';

const ADMIN_ROLE = 'admin';

function maskEmail(email) {
    const e = String(email || '');
    const at = e.indexOf('@');
    if (at < 1) return '(no email)';
    return e[0] + '***' + e.slice(at);
}
const day = (iso) => (iso ? String(iso).slice(0, 10) : 'never');
const providersOf = (u) => ((u.app_metadata && (u.app_metadata.providers || [u.app_metadata.provider])) || []).filter(Boolean).join('+') || 'unknown';
const isAdminMeta = (u) => {
    const meta = (u && u.app_metadata) || {};
    return meta.role === ADMIN_ROLE || (Array.isArray(meta.roles) && meta.roles.includes(ADMIN_ROLE));
};

async function allUsers(client) {
    const out = [];
    // listUsers is paginated; walk every page so no account is ever missed on a large user base.
    for (let page = 1; page <= 200; page++) {
        const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw new Error('Could not list users: ' + error.message);
        const users = (data && data.users) || [];
        out.push(...users);
        if (users.length < 1000) break;
    }
    return out;
}

async function findUserByEmail(client, email) {
    const wanted = String(email || '').trim().toLowerCase();
    return (await allUsers(client)).find((u) => String(u.email || '').toLowerCase() === wanted) || null;
}

async function listAdmins(client) {
    return (await allUsers(client)).filter(isAdminMeta).map((u) => ({ id: u.id, email: u.email }));
}

/** Read-only summary of one account, safe to print (e-mail masked). */
async function inspectUser(client, email) {
    const user = await findUserByEmail(client, email);
    if (!user) return { found: false };
    let customerOrders = null;
    try {
        const [byUser, byEmail] = await Promise.all([
            client.from('orders').select('id').eq('user_id', user.id),
            client.from('orders').select('id').ilike('email', String(user.email).replace(/[\\%_]/g, (c) => '\\' + c)),
        ]);
        if (!byUser.error && !byEmail.error) {
            customerOrders = new Set([...(byUser.data || []), ...(byEmail.data || [])].map((o) => o.id)).size;
        }
    } catch { /* orders are optional context only */ }
    return {
        found: true, id: user.id, email: maskEmail(user.email), providers: providersOf(user), emailConfirmed: !!(user.email_confirmed_at || user.confirmed_at),
        created: day(user.created_at), lastSignIn: day(user.last_sign_in_at), isAdmin: isAdminMeta(user), customerOrders,
    };
}

/** Accounts that authored dashboard content: the dashboard records the signed-in user on every blog and admin comment. */
async function listCandidates(client) {
    const counts = new Map();
    const bump = (id, key) => { if (!id) return; const c = counts.get(id) || { blogs: 0, comments: 0 }; c[key] += 1; counts.set(id, c); };
    const blogs = await client.from('blogs').select('admin_id');
    if (blogs.error) throw new Error('Could not read blogs: ' + blogs.error.message);
    (blogs.data || []).forEach((r) => bump(r.admin_id, 'blogs'));
    const comments = await client.from('blog_comments').select('admin_id').eq('is_admin', true);
    if (!comments.error) (comments.data || []).forEach((r) => bump(r.admin_id, 'comments'));

    const byId = new Map((await allUsers(client)).map((u) => [u.id, u]));
    return [...counts.entries()].map(([id, c]) => {
        const u = byId.get(id);
        return u
            ? { id, email: maskEmail(u.email), providers: providersOf(u), emailConfirmed: !!(u.email_confirmed_at || u.confirmed_at), created: day(u.created_at), lastSignIn: day(u.last_sign_in_at), isAdmin: isAdminMeta(u), blogs: c.blogs, adminComments: c.comments }
            : { id, email: '(account no longer exists)', blogs: c.blogs, adminComments: c.comments, missing: true };
    }).sort((a, b) => (b.blogs + b.adminComments) - (a.blogs + a.adminComments));
}

async function setAdminRole(client, email, { revoke = false, dryRun = false } = {}) {
    const user = await findUserByEmail(client, email);
    if (!user) return { ok: false, reason: 'user_not_found' };
    if (!revoke && !(user.email_confirmed_at || user.confirmed_at)) return { ok: false, reason: 'email_not_confirmed' };

    const meta = { ...(user.app_metadata || {}) };
    const hasRoleKey = meta.role === ADMIN_ROLE;
    const hasInRoles = Array.isArray(meta.roles) && meta.roles.includes(ADMIN_ROLE);
    const had = hasRoleKey || hasInRoles;
    if (revoke) {
        if (hasRoleKey) delete meta.role;
        if (hasInRoles) meta.roles = meta.roles.filter((r) => r !== ADMIN_ROLE);
    } else {
        meta.role = ADMIN_ROLE;
    }

    const changed = revoke ? had : !hasRoleKey;
    if (dryRun || !changed) return { ok: true, changed: false, dryRun, wouldChange: changed, wasAdmin: had, userId: user.id };

    const { error } = await client.auth.admin.updateUserById(user.id, { app_metadata: meta });
    if (error) return { ok: false, reason: 'update_failed', message: error.message };
    return { ok: true, changed: true, wasAdmin: had, userId: user.id };
}

function printAccount(a) {
    if (a.missing) return console.log(`  ${a.email}  (id ${String(a.id).slice(0, 8)}…)  blogs: ${a.blogs}, admin comments: ${a.adminComments}`);
    console.log(`  ${a.email.padEnd(28)} sign-in: ${String(a.providers).padEnd(14)} confirmed: ${a.emailConfirmed ? 'yes' : 'NO '}  created: ${a.created}  last sign-in: ${a.lastSignIn}`
        + `  ${a.blogs !== undefined ? `blogs: ${a.blogs}, admin comments: ${a.adminComments}  ` : ''}role: ${a.isAdmin ? 'ADMIN' : 'none'}`);
}

async function main(argv) {
    const args = argv.slice(2);
    const flags = new Set(args.filter((a) => a.startsWith('--')));
    const email = args.find((a) => !a.startsWith('--'));

    require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
    const { supabaseAdmin } = require('../src/config/supabase');

    if (flags.has('--list')) {
        const admins = await listAdmins(supabaseAdmin);
        console.log(admins.length ? 'Current administrators:' : 'No administrators have the role yet.');
        admins.forEach((a) => console.log('  ' + maskEmail(a.email)));
        return 0;
    }

    if (flags.has('--candidates')) {
        const list = await listCandidates(supabaseAdmin);
        console.log(list.length
            ? `Accounts that authored dashboard content (${list.length}). Review with the site owner; these are the likely administrators:`
            : 'No dashboard authors found (no blogs or admin comments carry an author).');
        list.forEach(printAccount);
        console.log('\nNothing was changed. Next: --inspect <email>, then grant with --apply.');
        return 0;
    }

    if (!email) {
        console.error('Usage: grant-admin-role.js --candidates | --list | --inspect <email> | <email> [--apply] [--revoke]');
        return 2;
    }

    if (flags.has('--inspect')) {
        const info = await inspectUser(supabaseAdmin, email);
        if (!info.found) { console.error('No Supabase user with that email.'); return 1; }
        printAccount(info);
        if (info.customerOrders) console.log(`  WARNING: this account also has ${info.customerOrders} customer order(s). Confirm it really is a staff account before granting.`);
        if (!info.emailConfirmed) console.log('  WARNING: the e-mail address is not confirmed; the role cannot be granted until it is.');
        console.log('  Nothing was changed.');
        return 0;
    }

    const revoke = flags.has('--revoke');
    const apply = flags.has('--apply');
    const result = await setAdminRole(supabaseAdmin, email, { revoke, dryRun: !apply });
    if (!result.ok) {
        const msg = { user_not_found: 'No Supabase user with that email. Create the account first (Supabase dashboard -> Authentication -> Users).', email_not_confirmed: 'That account\'s e-mail address is not confirmed, so the role will not be granted.' }[result.reason] || ('Failed: ' + (result.message || result.reason));
        console.error(msg);
        return 1;
    }
    const who = maskEmail(email);
    if (!apply) console.log(`[preview] ${who}: ${result.wouldChange ? (revoke ? 'the administrator role WOULD be revoked' : 'the administrator role WOULD be granted') : 'no change needed'}. Nothing was changed. Add --apply to do it.`);
    else if (!result.changed) console.log(`${who}: ${revoke ? 'already not an administrator' : 'already an administrator'}. No change.`);
    else console.log(`${who}: administrator role ${revoke ? 'revoked' : 'granted'}.`);
    return 0;
}

if (require.main === module) {
    main(process.argv).then((code) => process.exit(code), (err) => { console.error(err.message); process.exit(1); });
}

module.exports = { findUserByEmail, listAdmins, setAdminRole, inspectUser, listCandidates, maskEmail, ADMIN_ROLE };
