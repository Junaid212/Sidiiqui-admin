/**
 * Safe handling of non-fatal warnings returned by the admin API.
 *
 * The server may attach a `warnings` array to a successful create/update response (for example
 * when a social image could not be stored). The raw server text is NEVER shown to users:
 * each warning is mapped to a fixed, friendly message so no internal names, errors or other
 * details can leak into the UI.
 */

const SOCIAL_IMAGE_MESSAGE =
    'Saved, but the social image could not be stored because the database has not been updated for social images yet. Please ask your developer to apply the social image database update.';

const SHARE_PREVIEW_MESSAGE =
    'Saved, but the public share preview page could not be refreshed yet. It will be retried automatically, or use "Refresh share previews" to retry now.';

const GENERIC_MESSAGE = 'Saved with a warning. Please review the article.';

/** Map one raw server warning to a fixed, user-safe message. */
export function friendlyWarning(raw) {
    const text = typeof raw === 'string' ? raw : '';
    if (/share preview/i.test(text)) return SHARE_PREVIEW_MESSAGE;
    return /social[_ ]image/i.test(text) ? SOCIAL_IMAGE_MESSAGE : GENERIC_MESSAGE;
}

/** Extract unique, user-safe warning messages from an API response body (max 3). */
export function safeWarnings(responseData) {
    if (!responseData || !Array.isArray(responseData.warnings)) return [];
    const messages = responseData.warnings
        .filter((w) => typeof w === 'string' && w.trim())
        .map(friendlyWarning);
    return [...new Set(messages)].slice(0, 3);
}

/**
 * Attach warnings to a blog object WITHOUT changing its shape: the property is non-enumerable,
 * so it is never copied by spread, serialised, or sent back to the server.
 */
export function attachWarnings(blog, warnings) {
    if (!blog || typeof blog !== 'object' || !Array.isArray(warnings) || warnings.length === 0) return blog;
    Object.defineProperty(blog, '_warnings', { value: warnings, enumerable: false, configurable: true });
    return blog;
}

/** Read warnings previously attached with attachWarnings (always an array). */
export function readWarnings(blog) {
    return blog && Array.isArray(blog._warnings) ? blog._warnings : [];
}

/** One summary message for ZIP-import warnings (raw article titles / server text are not shown). */
export function zipWarningsMessage(batchWarnings) {
    if (!Array.isArray(batchWarnings) || batchWarnings.length === 0) return null;
    const preview = batchWarnings.filter((w) => typeof w === 'string' && /share preview/i.test(w)).length;
    const n = batchWarnings.length - preview; // the rest are social-image warnings
    const parts = [];
    if (n > 0) {
        parts.push(`${n} imported article${n === 1 ? ' was' : 's were'} saved without ${n === 1 ? 'its' : 'their'} social image because the database has not been updated for social images yet. Please ask your developer to apply the social image database update.`);
    }
    if (preview > 0) {
        parts.push(`${preview} imported article${preview === 1 ? ' was' : 's were'} saved, but ${preview === 1 ? 'its' : 'their'} public share preview page could not be refreshed yet. It will be retried automatically, or use "Refresh share previews".`);
    }
    return parts.join(' ');
}
