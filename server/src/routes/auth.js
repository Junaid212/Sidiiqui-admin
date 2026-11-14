const express = require('express');
const router = express.Router();
const { supabaseAdmin, supabase } = require('../config/supabase');
const nodemailer = require('nodemailer');
const { isAdminUser } = require('../middleware/auth');

// Lazy SMTP transporter — built on first use so dotenv is guaranteed to have run
function getTransporter() {
    const port = parseInt(process.env.SMTP_PORT, 10) || 465;
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: port,
        secure: port === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        tls: { rejectUnauthorized: false },
    });
}

// POST /api/auth/sign-up  -  DISABLED.
// This route used to create an already-confirmed account with admin.createUser() and return a live
// session to ANY caller. Combined with the old "any valid session is an administrator" check, that let
// anyone on the internet create their own administrator. Administrator accounts are now provisioned
// only by the project owner: create the user in the Supabase dashboard, then run
//     node server/scripts/grant-admin-role.js <email> --apply      (run without --apply first to preview)
// Customer sign-up is not affected: the public website signs customers up directly with Supabase Auth.
router.post('/sign-up', (req, res) => {
    return res.status(403).json({
        error: 'Administrator registration is disabled. Please ask the site owner to create your account.',
    });
});

// The reset link is emailed to the account owner, so its host must be one WE trust. Taking it from the
// request body would let an attacker request a reset for someone else's address and make the genuine
// email point at the attacker's site, which would then receive the one-time token.
function resolveFrontendBase(redirectTo) {
    const fallback = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    if (!redirectTo || typeof redirectTo !== 'string') return fallback;
    let origin;
    try { origin = new URL(redirectTo).origin; } catch { return fallback; }
    const allowed = new Set(['https://admin.siddiqui.digital']);
    try { allowed.add(new URL(fallback).origin); } catch { /* ignore */ }
    if (allowed.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return origin;
    return fallback;
}

router.post('/sign-in', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        return res.status(200).json({
            message: 'Signed in successfully',
            user: data.user,
            session: data.session,
        });
    } catch (err) {
        console.error('Sign-in error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
    try {
        const { email, redirectTo } = req.body;
        console.log(`[Reset Password] Request received for: ${email}`);
        if (!email) return res.status(400).json({ error: 'Email is required' });

        // Generate the recovery token via Supabase admin API
        // We do NOT rely on Supabase's redirect_to mechanism (it requires URL whitelisting in the
        // Supabase dashboard). Instead, we extract the token_hash from the action_link and build
        // our own direct link to the frontend — works on localhost AND production with zero dashboard config.
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email,
        });

        if (error) {
            console.error(`[Reset Password] Supabase generateLink error:`, error);
            return res.status(400).json({ error: error.message });
        }

        // Extract token_hash from the Supabase action_link URL
        // action_link looks like: https://[project].supabase.co/auth/v1/verify?token=HASH&type=recovery&redirect_to=...
        let tokenHash = null;
        try {
            const actionUrl = new URL(data.properties.action_link);
            tokenHash = actionUrl.searchParams.get('token');
        } catch (parseErr) {
            console.error('[Reset Password] Failed to parse action_link:', parseErr);
        }

        if (!tokenHash) {
            console.error('[Reset Password] Could not extract token from action_link:', data.properties.action_link);
            return res.status(500).json({ error: 'Failed to generate reset token' });
        }

        // Build a direct link to the frontend reset-password page with the token.
        // Use client-supplied redirectTo base (window.location.origin from the browser) so it works
        // on any environment (localhost:5173, localhost:5174, https://admin.siddiqui.digital, etc.)
        const frontendBase = resolveFrontendBase(redirectTo);

        const resetLink = `${frontendBase}/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
        console.log(`[Reset Password] Generated direct reset link for ${email} → ${frontendBase}/reset-password`);

        // Send email via Nodemailer with our direct link (no Supabase redirect)
        try {
            const transporter = getTransporter();
            await transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: email,
                subject: 'Password Reset Request — Siddiqui Digital Admin',
                html: `
                    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px 32px; border-radius: 12px;">
                        <div style="text-align: center; margin-bottom: 24px;">
                            <div style="display: inline-block; background: linear-gradient(135deg, #dc2626, #ef4444); width: 48px; height: 48px; border-radius: 10px; line-height: 48px; font-size: 22px; font-weight: bold; color: #fff;">S</div>
                        </div>
                        <h2 style="color: #f8fafc; text-align: center; margin: 0 0 8px;">Reset Your Password</h2>
                        <p style="text-align: center; color: #94a3b8; margin: 0 0 28px;">Click the button below to securely reset your password for the admin dashboard.</p>
                        <div style="text-align: center; margin-bottom: 32px;">
                            <a href="${resetLink}" style="background-color: #ef4444; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 15px;">Reset Password</a>
                        </div>
                        <div style="background: #1e293b; padding: 16px; border-radius: 8px; border: 1px solid #334155; font-size: 13px; color: #94a3b8;">
                            <p style="margin: 0 0 8px;">If the button doesn't work, copy and paste this link into your browser:</p>
                            <p style="margin: 0; word-break: break-all; color: #60a5fa;">${resetLink}</p>
                        </div>
                        <p style="color: #64748b; font-size: 13px; text-align: center; margin-top: 24px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
                        <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0;" />
                        <p style="font-size: 12px; color: #64748b; text-align: center;">This is an automated message from Siddiqui Digital Admin.</p>
                    </div>
                `,
            });
            console.log('📧 Password reset email sent to:', email);
        } catch (emailErr) {
            console.error('❌ Password reset email sending failed:', emailErr);
            return res.status(500).json({ error: 'Failed to send password reset email' });
        }

        return res.status(200).json({ message: 'Password reset email sent' });
    } catch (err) {
        console.error('Reset password error:', err?.message, err);
        return res.status(500).json({ error: err?.message || 'Internal server error' });
    }
});

// GET /api/auth/me — get current authenticated user
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing authorization header' });
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Also get profile data
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        return res.status(200).json({ user, profile, isAdmin: isAdminUser(user) });
    } catch (err) {
        console.error('Get user error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

