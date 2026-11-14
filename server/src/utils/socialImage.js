/**
 * Social-share image helpers: validation (signature, size, real dimensions) and
 * safe storage cleanup (never deletes a file that any blog record still references).
 *
 * Pure / dependency-free except for the Supabase client that callers pass in,
 * so everything here can be unit-tested offline with a mock client.
 */

const BUCKET = 'blogs';
const ALLOWED_PREFIX = 'blog-images/';

// ── Validation limits ───────────────────────────────────────────────────────
// Social cards are displayed at ~1200x627 (1.91:1). Large files are slow for scrapers
// (WhatsApp/LinkedIn skip images that are too big), so keep the cap well below the 5 MB cover limit.
const MAX_SOCIAL_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const MIN_WIDTH = 1200;
const MAX_WIDTH = 2400;
const MIN_RATIO = 1.85; // width / height, 1200x627 = 1.914
const MAX_RATIO = 1.97;

function hasJpegSignature(buf) {
    return Buffer.isBuffer(buf) && buf.length > 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
}

/**
 * Read width/height from a JPEG by walking its marker segments to the first SOF marker.
 * Returns null if the structure is malformed or no frame header is found.
 */
function readJpegDimensions(buf) {
    if (!hasJpegSignature(buf)) return null;
    let i = 2;
    while (i + 3 < buf.length) {
        if (buf[i] !== 0xFF) { i++; continue; }
        let marker = buf[i + 1];
        while (marker === 0xFF && i + 2 < buf.length) { i++; marker = buf[i + 1]; } // fill bytes
        // Standalone markers (no length): TEM, RSTn, SOI, EOI
        if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD9)) { i += 2; continue; }
        if (marker === 0xDA) return null; // start of scan reached without a frame header
        if (i + 3 >= buf.length) return null;
        const segLen = buf.readUInt16BE(i + 2);
        if (segLen < 2) return null;
        const isSof = marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
        if (isSof) {
            if (i + 9 > buf.length) return null;
            const height = buf.readUInt16BE(i + 5);
            const width = buf.readUInt16BE(i + 7);
            return width > 0 && height > 0 ? { width, height } : null;
        }
        i += 2 + segLen;
    }
    return null;
}

/**
 * Validate a multer file object (memory storage) as a social-share image.
 * Server-side and authoritative: does not trust the client MIME type or filename.
 * Returns { ok: true, width, height } or { ok: false, error }.
 */
function validateSocialJpeg(file) {
    if (!file || !Buffer.isBuffer(file.buffer)) {
        return { ok: false, code: 'MISSING', error: 'Social image is missing or unreadable.' };
    }
    if (file.buffer.length > MAX_SOCIAL_IMAGE_BYTES) {
        return { ok: false, code: 'TOO_LARGE', error: `Social image is too large (${(file.buffer.length / 1048576).toFixed(1)} MB). Maximum is ${MAX_SOCIAL_IMAGE_BYTES / 1048576} MB.` };
    }
    if (!hasJpegSignature(file.buffer)) {
        return { ok: false, code: 'NOT_JPEG', error: 'Social image is not a valid JPEG file (content does not match its extension).' };
    }
    const dims = readJpegDimensions(file.buffer);
    if (!dims) {
        return { ok: false, code: 'CORRUPT', error: 'Could not read the social image dimensions. The JPEG appears to be corrupted.' };
    }
    const { width, height } = dims;
    const ratio = width / height;
    if (width < MIN_WIDTH || width > MAX_WIDTH || ratio < MIN_RATIO || ratio > MAX_RATIO) {
        return {
            ok: false,
            code: 'BAD_DIMENSIONS',
            error: `Social image is ${width} × ${height}px. It must be between ${MIN_WIDTH} and ${MAX_WIDTH}px wide with a landscape ratio of about 1.91:1 (recommended 1200 × 627).`,
        };
    }
    return { ok: true, width, height };
}

// ── ZIP-import helpers (same rules as direct uploads) ───────────────────────

/**
 * Validate a "data:image/jpeg;base64,..." URL (as produced by ZIP inspection) with exactly the
 * same rules as a direct upload. Pure: decodes in memory, never uploads anything.
 * Returns { ok: true, buffer, width, height } or { ok: false, code, error }.
 */
function validateSocialDataUrl(dataUrl) {
    const m = typeof dataUrl === 'string' && dataUrl.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=\s]+)$/);
    if (!m) return { ok: false, code: 'NOT_JPEG', error: 'Social image must be a JPG/JPEG image.' };
    const buffer = Buffer.from(m[1].replace(/\s+/g, ''), 'base64');
    const result = validateSocialJpeg({ buffer });
    return result.ok ? { ...result, buffer } : result;
}

/**
 * Evaluate a social image found inside an uploaded ZIP during INSPECTION (preview only).
 * getBuffer is lazy so wrong-extension entries are never decompressed.
 * status values: matched | invalid-format | too-large | invalid-dimensions
 */
function evaluateZipSocialImage({ entryName, getBuffer, title }) {
    const extMatch = String(entryName || '').toLowerCase().match(/\.[a-z0-9]+$/);
    const ext = extMatch ? extMatch[0] : '';
    if (ext !== '.jpg' && ext !== '.jpeg') {
        return { status: 'invalid-format', url: null, message: `Social image for "${title}" must be JPG/JPEG. Found: ${ext || 'unknown format'}. It will be ignored.` };
    }
    const buffer = getBuffer();
    const v = validateSocialJpeg({ buffer });
    if (!v.ok) {
        const status = v.code === 'TOO_LARGE' ? 'too-large' : v.code === 'BAD_DIMENSIONS' ? 'invalid-dimensions' : 'invalid-format';
        return { status, url: null, message: `Social image for "${title}" was rejected: ${v.error} It will be ignored.` };
    }
    return { status: 'matched', url: `data:image/jpeg;base64,${buffer.toString('base64')}`, message: null, width: v.width, height: v.height };
}

// ── Crawler / Open Graph image selection ────────────────────────────────────
const DEFAULT_OG_IMAGE = 'https://siddiqui.digital/assets/images/img/main-ogimg.jpg';

/**
 * og:image for an article: the social image when it is a real http(s) URL, otherwise the
 * article cover (unchanged legacy behaviour), otherwise the site default image.
 */
function resolveOgImage(article) {
    const social = article && article.social_image_url;
    if (typeof social === 'string' && /^https?:\/\//i.test(social.trim())) return social.trim();
    return (article && article.image_url) || DEFAULT_OG_IMAGE;
}

// ── Storage path helpers ────────────────────────────────────────────────────

/**
 * Convert a public Supabase Storage URL into a bucket-relative path, but ONLY if it
 * belongs to this project's `blogs` bucket under `blog-images/`. Anything else
 * (external URLs, other buckets, other prefixes, path traversal) returns null,
 * so cleanup can never touch files we don't own.
 */
function storagePathFromPublicUrl(url, supabaseUrl) {
    if (typeof url !== 'string' || !url || !supabaseUrl) return null;
    let u, base;
    try { u = new URL(url); base = new URL(supabaseUrl); } catch { return null; }
    if (u.host !== base.host) return null;
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx !== 0) return null;
    let path;
    try { path = decodeURIComponent(u.pathname.slice(marker.length)); } catch { return null; }
    if (!path.startsWith(ALLOWED_PREFIX) || path.includes('..') || path.includes('\\')) return null;
    return path;
}

function isMissingColumnError(err, column) {
    if (!err) return false;
    const msg = String(err.message || '');
    return (
        err.code === '42703' || err.code === 'PGRST204' ||
        (msg.includes(column) && (msg.includes('column') || msg.includes('schema cache')))
    );
}

/**
 * True if ANY blog row still references this storage path (cover path/url, social url, or inline
 * in article text). Fails SAFE: any unexpected query error counts as "referenced" so nothing is
 * deleted on uncertainty. A missing social_image_url column is tolerated (nothing can reference
 * it through a column that does not exist).
 */
async function isStorageFileReferenced(db, path) {
    const checks = [
        { col: 'image_path', run: () => db.from('blogs').select('id').eq('image_path', path).limit(1) },
        { col: 'image_url', run: () => db.from('blogs').select('id').ilike('image_url', `%${path}%`).limit(1) },
        { col: 'social_image_url', run: () => db.from('blogs').select('id').ilike('social_image_url', `%${path}%`).limit(1) },
        { col: 'content', run: () => db.from('blogs').select('id').ilike('content', `%${path}%`).limit(1) },
        { col: 'content2', run: () => db.from('blogs').select('id').ilike('content2', `%${path}%`).limit(1) },
    ];
    for (const c of checks) {
        let res;
        try { res = await c.run(); } catch (e) { return true; }
        if (res.error) {
            if (c.col === 'social_image_url' && isMissingColumnError(res.error, 'social_image_url')) continue;
            return true; // unknown error → assume referenced
        }
        if (res.data && res.data.length > 0) return true;
    }
    return false;
}

/**
 * Delete `path` from the blogs bucket only if it is inside blog-images/ and no blog still
 * references it. Never throws; returns { deleted: boolean, reason: string }.
 */
async function deleteStorageFileIfUnreferenced(db, path) {
    try {
        if (typeof path !== 'string' || !path.startsWith(ALLOWED_PREFIX) || path.includes('..')) {
            return { deleted: false, reason: 'not-an-owned-path' };
        }
        if (await isStorageFileReferenced(db, path)) {
            return { deleted: false, reason: 'still-referenced' };
        }
        const { error } = await db.storage.from(BUCKET).remove([path]);
        if (error) {
            console.error('[socialImage] Storage cleanup failed:', error.message);
            return { deleted: false, reason: 'storage-error' };
        }
        return { deleted: true, reason: 'deleted' };
    } catch (e) {
        console.error('[socialImage] Storage cleanup error:', e && e.message);
        return { deleted: false, reason: 'error' };
    }
}

// ── Column presence ─────────────────────────────────────────────────────────
let socialColumnKnownPresent = false; // only cache the positive result; a missing column can be fixed at any time

/**
 * Read-only probe: does blogs.social_image_url exist? Returns true/false, or throws
 * on unexpected errors so callers can report them instead of guessing.
 */
async function socialColumnExists(db) {
    if (socialColumnKnownPresent) return true;
    const { error } = await db.from('blogs').select('social_image_url').limit(1);
    if (!error) { socialColumnKnownPresent = true; return true; }
    if (isMissingColumnError(error, 'social_image_url')) return false;
    throw new Error(error.message || 'Could not check the social_image_url column');
}

const SOCIAL_COLUMN_MISSING_MESSAGE =
    'The database column blogs.social_image_url does not exist yet, so a social image cannot be saved. ' +
    'Nothing was uploaded or changed. Apply supabase/migrations/add_social_image_to_blogs.sql first, then try again.';

module.exports = {
    MAX_SOCIAL_IMAGE_BYTES,
    hasJpegSignature,
    readJpegDimensions,
    validateSocialJpeg,
    validateSocialDataUrl,
    evaluateZipSocialImage,
    resolveOgImage,
    DEFAULT_OG_IMAGE,
    storagePathFromPublicUrl,
    isStorageFileReferenced,
    deleteStorageFileIfUnreferenced,
    socialColumnExists,
    SOCIAL_COLUMN_MISSING_MESSAGE,
    _resetColumnCacheForTests: () => { socialColumnKnownPresent = false; },
};
