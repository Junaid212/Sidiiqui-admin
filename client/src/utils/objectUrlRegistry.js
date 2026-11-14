/**
 * Tracks temporary browser object URLs (URL.createObjectURL) so they can be released.
 * Without this, every selected preview image stays in memory until the tab is closed.
 * Only URLs created through the registry are ever revoked, so saved image URLs are never touched.
 */
export function createObjectUrlRegistry() {
    const urls = new Set();

    return {
        /** Create and remember an object URL for a File/Blob. */
        create(blob) {
            const url = URL.createObjectURL(blob);
            urls.add(url);
            return url;
        },
        /** Revoke one URL, but only if this registry created it. */
        revoke(url) {
            if (url && urls.has(url)) {
                URL.revokeObjectURL(url);
                urls.delete(url);
            }
        },
        /** Revoke everything (form closed or another article loaded). */
        revokeAll() {
            urls.forEach((url) => URL.revokeObjectURL(url));
            urls.clear();
        },
        has(url) {
            return urls.has(url);
        },
        get size() {
            return urls.size;
        },
    };
}
