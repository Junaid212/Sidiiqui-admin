/**
 * adminMail.js - the e-mail sent when the Owner adds someone to the dashboard.
 * The person gets a one-time link to choose THEIR OWN password (nobody ever sends or shares a password). The link host must be one we
 * trust, never taken from the request, so a forged request cannot point the e-mail at someone else's site.
 */
'use strict';
const nodemailer = require('nodemailer');
const { supabaseAdmin } = require('../config/supabase');

function transporter() {
    const port = parseInt(process.env.SMTP_PORT, 10) || 465;
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST, port, secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: false },
    });
}

function frontendBase(redirectTo) {
    const fallback = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    if (!redirectTo || typeof redirectTo !== 'string') return fallback;
    let origin;
    try { origin = new URL(redirectTo).origin; } catch { return fallback; }
    const allowed = new Set(['https://admin.siddiqui.digital']);
    try { allowed.add(new URL(fallback).origin); } catch { /* ignore */ }
    return allowed.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ? origin : fallback;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const WHAT = {
    editor: 'You can manage Online Reading (chapters, import, publish), the Blog, Ask SID settings and Companion Files.',
    support: 'You can view orders and customers, grant or revoke reader access, and read contact messages.',
};

/**
 * Sends the "choose your password" e-mail. Returns { sent: true } or { sent: false, error }. It never throws: the caller keeps the account
 * either way and can send the e-mail again.
 *   mode 'new'      = a brand-new account: link to choose a password
 *   mode 'existing' = the person already has an account on this site: same sign-in, new access (a reset link is still offered)
 */
async function sendTeamInvite({ email, role, roleLabel, mode = 'new', redirectTo, invitedBy }) {
    try {
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email });
        if (error) return { sent: false, error: error.message };
        let tokenHash = null;
        try { tokenHash = new URL(data.properties.action_link).searchParams.get('token'); } catch { /* handled below */ }
        if (!tokenHash) return { sent: false, error: 'Could not create the password link.' };
        const base = frontendBase(redirectTo);
        const link = `${base}/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
        const lead = mode === 'existing'
            ? `You now have <b>${esc(roleLabel)}</b> access to the Siddiqui Digital admin dashboard. Sign in at ${esc(base)} with the e-mail address and password you already use; if you do not remember the password, use the button below to choose a new one.`
            : `You have been added to the Siddiqui Digital admin dashboard as <b>${esc(roleLabel)}</b>. Use the button below to choose your own password, then sign in at ${esc(base)}.`;
        await transporter().sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: email,
            subject: 'You have been added to the Siddiqui Digital admin dashboard',
            html: `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:36px 30px;border-radius:12px">
  <h2 style="color:#f8fafc;margin:0 0 10px">Welcome to the admin dashboard</h2>
  <p style="color:#cbd5e1;line-height:1.6;margin:0 0 14px">${lead}</p>
  <p style="color:#94a3b8;line-height:1.6;margin:0 0 22px">${esc(WHAT[role] || '')} Your login is personal: please do not share it.${invitedBy ? ` Added by ${esc(invitedBy)}.` : ''}</p>
  <p style="text-align:center;margin:0 0 22px"><a href="${link}" style="background:#ef4444;color:#fff;padding:13px 26px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">Choose my password</a></p>
  <p style="color:#64748b;font-size:12px;line-height:1.5;margin:0">If the button does not work, copy this link into your browser:<br><span style="word-break:break-all;color:#60a5fa">${link}</span><br>The link works once and expires in 1 hour. If you were not expecting this, ignore this e-mail.</p>
</div>`,
        });
        return { sent: true };
    } catch (e) {
        return { sent: false, error: (e && e.message) || 'The e-mail could not be sent.' };
    }
}

module.exports = { sendTeamInvite, frontendBase };
