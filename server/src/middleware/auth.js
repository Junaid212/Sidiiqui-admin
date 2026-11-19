const { supabaseAdmin } = require('../config/supabase');
const { roleOf, can, labelOf, permissionsOf } = require('../utils/permissions');

/**
 * The public website and this admin dashboard share ONE Supabase project, so every customer
 * has a valid Supabase session too. A valid session therefore proves identity only; it must
 * never be treated as proof of administrator rights.
 *
 * A dashboard user is a Supabase user whose app_metadata.role is 'admin' (Owner), 'editor' or 'support'
 * (what each may do: see utils/permissions.js).
 *   - app_metadata can only be written with the service-role key (server side / Supabase
 *     dashboard). A user can NOT edit it, unlike user_metadata or a profiles row.
 *   - The role is read from the Auth server on every request (auth.getUser), so granting,
 *     changing or revoking it takes effect immediately, not when a JWT expires.
 *   - Deliberately NOT based on email addresses: anyone can sign up with any address on the
 *     shared project, so an email allow-list would be spoofable.
 *
 * Verify, grant or revoke the Owner role with: node server/scripts/grant-admin-role.js --candidates | --inspect <email> | <email> [--apply] [--revoke]
 * Editors and Support people are added by the Owner in the dashboard (Team).
 */

/** True for ANY dashboard role (Owner, Editor, Support). Use can()/need() for what they may do. */
function isAdminUser(user) {
    return roleOf(user) !== null;
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
 * Verifies the session AND that the user has a dashboard role. Use on every dashboard API, then add need(...) for what the route needs.
 * 401 = not signed in, 403 = signed in but not a dashboard user.
 * Attaches req.user, req.adminRole ('admin' | 'editor' | 'support').
 */
const requireAdmin = async (req, res, next) => {
    try {
        const result = await authenticate(req);
        if (result.error) return res.status(result.status).json({ error: result.error });
        const role = roleOf(result.user);
        if (!role) {
            return res.status(403).json({ error: 'Administrator access required' });
        }
        req.user = result.user;
        req.adminRole = role;
        next();
    } catch (err) {
        console.error('Admin auth middleware error:', err);
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

const refuse = (req, res) =>
    res.status(403).json({ error: `Your role (${labelOf(req.adminRole)}) does not allow this.`, code: 'role_not_allowed' });

/** Allow only a role that has this permission. Mount after requireAdmin. */
const need = (permission) => (req, res, next) => (can(req.adminRole, permission) ? next() : refuse(req, res));

/** Reading (GET / HEAD) needs one permission, changing anything needs another. */
const needByMethod = (readPermission, writePermission) => (req, res, next) =>
    need(req.method === 'GET' || req.method === 'HEAD' ? readPermission : writePermission)(req, res, next);

/** Decide the permission from the request itself (method + path), for routers whose actions need different rights. */
const needBy = (fn) => (req, res, next) => {
    const permission = fn(req);
    return permission && can(req.adminRole, permission) ? next() : refuse(req, res);
};

module.exports = { requireAuth, requireAdmin, isAdminUser, need, needByMethod, needBy, permissionsOf, labelOf };
