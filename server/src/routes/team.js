/**
 * /api/team - the people who can sign in to the dashboard (Owner only; mounted behind requireAdmin + need('team')).
 *   GET    /            who has access, with role, last sign-in
 *   POST   /            add a person: { email, role: 'editor' | 'support' }  - they get an e-mail to choose THEIR OWN password
 *   POST   /:id/resend  send that e-mail again
 *   PUT    /:id         change a person's role (Editor <-> Support)
 *   DELETE /:id         remove a person's dashboard access at once (their account stays; they simply lose the dashboard)
 * Safety rules: only an Owner can reach this; you cannot remove or change yourself; the last Owner can never be removed; new people can
 * only be Editor or Support (an Owner is created only by the site owner on the server). Every change is written to the audit log.
 */
'use strict';
const express = require('express');
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { roleOf, labelOf, OWNER, STAFF } = require('../utils/permissions');
const { logAudit } = require('../utils/adminAudit');
const { sendTeamInvite } = require('../utils/adminMail');

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (res, code, message) => res.status(code).json({ error: message });
const mask = (e) => String(e || '').replace(/^(.).*(@.*)$/, '$1***$2');

async function allUsers() {
    const out = [];
    for (let page = 1; page <= 200; page++) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw new Error(error.message);
        const users = (data && data.users) || [];
        out.push(...users);
        if (users.length < 1000) break;
    }
    return out;
}

const shape = (u, selfId) => {
    const role = roleOf(u);
    return { id: u.id, email: u.email, role, roleLabel: labelOf(role), createdAt: u.created_at || null, lastSignInAt: u.last_sign_in_at || null, confirmed: !!(u.email_confirmed_at || u.confirmed_at), isSelf: u.id === selfId };
};

router.get('/', async (req, res) => {
    try {
        const members = (await allUsers()).filter((u) => roleOf(u)).map((u) => shape(u, req.user.id));
        const rank = { [OWNER]: 0, editor: 1, support: 2 };
        members.sort((a, b) => rank[a.role] - rank[b.role] || String(a.email).localeCompare(String(b.email)));
        res.json({ members });
    } catch (e) { fail(res, 500, `Could not load the team: ${e.message}`); }
});

router.post('/', async (req, res) => {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    const role = req.body && req.body.role;
    if (!EMAIL.test(email) || email.length > 200) return fail(res, 400, 'Enter a valid e-mail address.');
    if (!STAFF.includes(role)) return fail(res, 400, 'Choose a role: Editor or Support.');
    try {
        const existing = (await allUsers()).find((u) => String(u.email || '').toLowerCase() === email);
        let userId; let mode = 'new';
        if (existing) {
            if (roleOf(existing)) return fail(res, 409, `This person already has dashboard access (${labelOf(roleOf(existing))}). Change their role instead.`);
            if (!(existing.email_confirmed_at || existing.confirmed_at)) return fail(res, 409, 'This e-mail address has an account that is not confirmed yet, so it cannot be given access.');
            const { error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, { app_metadata: { ...(existing.app_metadata || {}), role } });
            if (error) return fail(res, 500, `Could not give access: ${error.message}`);
            userId = existing.id; mode = 'existing';
        } else {
            // a brand-new account with a random password nobody ever sees: the person chooses their own through the e-mailed link
            const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password: crypto.randomBytes(24).toString('base64url'), email_confirm: true, app_metadata: { role } });
            if (error || !data || !data.user) return fail(res, 500, `Could not create the account: ${error ? error.message : 'unknown error'}`);
            userId = data.user.id;
        }
        const mail = await sendTeamInvite({ email, role, roleLabel: labelOf(role), mode, redirectTo: req.body && req.body.redirectTo, invitedBy: req.user.email });
        logAudit(req, 'team.add', 'admin_user', userId, { email: mask(email), role, existingAccount: mode === 'existing', emailSent: mail.sent });
        res.status(201).json({ ok: true, id: userId, email, role, roleLabel: labelOf(role), existingAccount: mode === 'existing', emailSent: mail.sent, emailError: mail.sent ? undefined : mail.error });
    } catch (e) { fail(res, 500, e.message || 'Could not add this person.'); }
});

async function loadMember(req, res) {
    if (!UUID.test(req.params.id)) { fail(res, 400, 'Invalid id'); return null; }
    const user = (await allUsers()).find((u) => u.id === req.params.id);
    if (!user || !roleOf(user)) { fail(res, 404, 'This person does not have dashboard access.'); return null; }
    return user;
}

router.post('/:id/resend', async (req, res) => {
    try {
        const user = await loadMember(req, res); if (!user) return;
        const role = roleOf(user);
        if (role === OWNER) return fail(res, 400, 'Owners sign in with their existing password.');
        const mail = await sendTeamInvite({ email: user.email, role, roleLabel: labelOf(role), mode: 'new', redirectTo: req.body && req.body.redirectTo, invitedBy: req.user.email });
        logAudit(req, 'team.resend_invite', 'admin_user', user.id, { email: mask(user.email), emailSent: mail.sent });
        if (!mail.sent) return fail(res, 502, `The e-mail could not be sent: ${mail.error}`);
        res.json({ ok: true });
    } catch (e) { fail(res, 500, e.message); }
});

router.put('/:id', async (req, res) => {
    const role = req.body && req.body.role;
    if (!STAFF.includes(role)) return fail(res, 400, 'Choose a role: Editor or Support.');
    try {
        const user = await loadMember(req, res); if (!user) return;
        if (user.id === req.user.id) return fail(res, 400, 'You cannot change your own role.');
        if (roleOf(user) === OWNER) return fail(res, 400, 'An Owner\'s role cannot be changed here. Remove the Owner instead, if they should no longer have access.');
        if (roleOf(user) === role) return res.json({ ok: true, unchanged: true });
        const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { app_metadata: { ...(user.app_metadata || {}), role } });
        if (error) return fail(res, 500, `Could not change the role: ${error.message}`);
        logAudit(req, 'team.change_role', 'admin_user', user.id, { email: mask(user.email), from: roleOf(user), to: role });
        res.json({ ok: true, id: user.id, role, roleLabel: labelOf(role) });
    } catch (e) { fail(res, 500, e.message); }
});

router.delete('/:id', async (req, res) => {
    try {
        const user = await loadMember(req, res); if (!user) return;
        if (user.id === req.user.id) return fail(res, 400, 'You cannot remove yourself. Ask another Owner to do it.');
        if (roleOf(user) === OWNER) {
            const owners = (await allUsers()).filter((u) => roleOf(u) === OWNER);
            if (owners.length <= 1) return fail(res, 409, 'This is the only Owner and cannot be removed.');
        }
        // Supabase MERGES app_metadata, so a key is removed by setting it to null (leaving it out would keep it).
        const meta = { ...(user.app_metadata || {}), role: null };
        if (Array.isArray(meta.roles)) meta.roles = meta.roles.filter((r) => r !== OWNER);
        const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { app_metadata: meta });
        if (error) return fail(res, 500, `Could not remove access: ${error.message}`);
        logAudit(req, 'team.remove', 'admin_user', user.id, { email: mask(user.email), role: roleOf(user) });
        res.json({ ok: true });
    } catch (e) { fail(res, 500, e.message); }
});

module.exports = router;
