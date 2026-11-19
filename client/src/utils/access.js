// Which permission each dashboard screen needs (the same names the server uses: server/src/utils/permissions.js).
// This only decides what is SHOWN: the server refuses anything a role may not do, on every request.
export const ROUTE_PERMISSION = {
    '/': 'dashboard',
    '/orders': 'orders.view',
    '/coupons': 'coupons',
    '/products': 'products',
    '/ask-sid': 'asksid',
    '/reading': 'reading',
    '/companion-files': 'companion',
    '/customers-access': 'customers.view',
    '/consultations': 'consultations',
    '/sign-ins': 'analytics',
    '/contact-messages': 'messages.view',
    '/questionnaire': 'analytics',
    '/blogs': 'blog',
    '/course-interactions': 'analytics',
    '/team': 'team',
};

// where a person lands when the Dashboard (Owner's overview) is not theirs: the first screen their role allows
const LANDING_ORDER = ['/', '/reading', '/blogs', '/ask-sid', '/companion-files', '/orders', '/customers-access', '/contact-messages', '/products', '/coupons', '/team'];

export function firstAllowedPath(can) {
    return LANDING_ORDER.find((p) => can(ROUTE_PERMISSION[p])) || null;
}
