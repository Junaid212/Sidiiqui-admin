const { supabaseAdmin } = require('../config/supabase');

/**
 * The public website and this admin dashboard share ONE Supabase project, so every customer
 * has a valid Supabase session too. A valid session therefore proves identity only; it must
 * never be treated as proof of administrator rights.
 *
 * Administrator = a Supabase user whose app_metadata.role is 'admin'.
 *   - app_metadata can only be written with the service-role key (server side / Supabase
 *     dashboard). A user can NOT edit it, unlike user_metadata or a profiles row.
 *   - The role is read from the Auth server on every request (auth.getUser), so granting or
 *     revoking it takes effect immediately, not when a JWT expires.
 *   - Deliberately NOT based on email addresses: anyone can sign up with any address on the
 *     shared project, so an email allow-list would be spoofable.
 *
 * Verify, grant or revoke with: node server/scripts/grant-admin-role.js --candidates | --inspect <email> | <email> [--apply] [--revoke]
 */
const ADMIN_ROLE = 'admin';

function isAdminUser(user) {
    if (!user || typeof user !== 'object') return false;
    const meta = user.app_metadata;
    if (!meta || typeof meta !== 'object') return false;
    if (meta.role === ADMIN_ROLE) return true;
    return Array.isArray(meta.roles) && meta.roles.includes(ADMIN_ROLE);
}

async function authenticate(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { status: 401, error: 'Missing or invalid authorization header' };
    }
    const token = authHeader.split(' ')[1];
    if (!token) return { status: 401, error: 'Missing or invalid authorization header' };

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    const user = data && data.user;
    if (error || !user) return { status: 401, error: 'Invalid or expired token' };
    return { user };
}

/**
 * Verifies the Supabase session only. Use for endpoints that any signed-in person may call
 * (none of the dashboard data APIs). Attaches req.user.
 */
const requireAuth = async (req, res, next) => {
    try {
        const result = await authenticate(req);
        if (result.error) return res.status(result.status).json({ error: result.error });
        req.user = result.user;
        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

/**
 * Verifies the session AND that the user is an administrator. Use on every dashboard API.
 * 401 = not signed in, 403 = signed in but not an administrator.
 */
const requireAdmin = async (req, res, next) => {
    try {
        const result = await authenticate(req);
        if (result.error) return res.status(result.status).json({ error: result.error });
        if (!isAdminUser(result.user)) {
            return res.status(403).json({ error: 'Administrator access required' });
        }
        req.user = result.user;
        next();
    } catch (err) {
        console.error('Admin auth middleware error:', err);
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

module.exports = { requireAuth, requireAdmin, isAdminUser };
