'use strict';
/**
 * Blog article page metadata: the ONE place that decides every title, description, canonical URL,
 * Open Graph and Twitter tag of a prerendered article page (https://siddiqui.digital/blogs/<slug>/).
 *
 * IDENTICAL COPY in both repositories (a test enforces byte equality):
 *   - siddique-admin/server/src/utils/blogPrerenderCore.cjs   (refreshes one page right after an admin save)
 *   - siddiui.digital/scripts/lib/blogPrerenderCore.cjs        (regenerates all pages at build time)
 *
 * Pure and dependency-free (Node built-ins only). It never touches the database or the file system;
 * callers pass in a template and an article row and get HTML back.
 *
 * Design rules (from production findings):
 *  - The image is ALWAYS the URL stored on the article row (social_image_url, then image_url, then the site
 *    default). Nothing is ever derived from a filename or slug.
 *  - Stored URLs are only used when they are real http(s) URLs.
 *  - Output is deterministic (no timestamps) so "is this page already up to date?" is a string comparison.
 */
const http = require('http');
const https = require('https');

const SITE_URL = 'https://siddiqui.digital';
const SITE_AUTHOR = 'M. Q. Siddiqui';
const DEFAULT_IMAGE = `${SITE_URL}/assets/images/img/main-ogimg.jpg`;
const DEFAULT_DESCRIPTION = 'Empowering entrepreneurs and students through strategic marketing.';
const TITLE_SUFFIX = ' | M. Q. Siddiqui';

// Used only when the real size of an image cannot be read (probe disabled/failed).
const FALLBACK_DIMS = {
    social: { width: 1200, height: 627 },   // the documented recommended size
    cover: { width: 1600, height: 820 },    // the size the site has always declared for covers
    default: { width: 1600, height: 836 },  // real size of main-ogimg.jpg
};

const PAGE_MARKER = 'prerendered-article:v1';
const REDIRECT_MARKER = 'prerendered-redirect:v1';

// ── Visibility: must mirror isBlogPublished() in the admin server's index.js exactly ────────────────────
function isPubliclyVisible(article, now = new Date()) {
    if (!article) return false;
    const st = String(article.status || 'published').toLowerCase();
    if (st === 'draft' || st === 'unpublished') return false;
    if (st === 'scheduled') {
        if (!article.scheduled_for) return false;
        return new Date(article.scheduled_for) <= now;
    }
    return true;
}

// Slugs become directory names, so they are validated strictly (no dots, slashes or traversal).
function isValidSlug(slug) {
    return typeof slug === 'string' && /^[a-z0-9][a-z0-9_-]{0,199}$/i.test(slug);
}

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

function httpUrl(u) {
    const s = clean(u);
    return /^https?:\/\/[^\s"'<>]+$/i.test(s) && s.length <= 2048 ? s : '';
}

function escapeAttr(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Priority: saved social image -> article cover -> website default. Never guessed.
function pickImage(article, defaultImage = DEFAULT_IMAGE) {
    const social = httpUrl(article && article.social_image_url);
    if (social) return { url: social, source: 'social' };
    const cover = httpUrl(article && article.image_url);
    if (cover) return { url: cover, source: 'cover' };
    return { url: defaultImage, source: 'default' };
}

function isoDay(value) {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
}

/** Everything a page needs, computed once. opts: { defaultImage, dims:{width,height} } */
function articleMeta(article, opts = {}) {
    const rawTitle = clean(article.seo_title) || clean(article.title) || 'Siddiqui.Digital';
    const title = rawTitle.includes('M. Q. Siddiqui') || rawTitle.includes('Siddiqui.digital')
        ? rawTitle
        : rawTitle + TITLE_SUFFIX;
    const description = clean(article.seo_description) || clean(article.standfirst) || clean(article.summary) || DEFAULT_DESCRIPTION;
    const url = `${SITE_URL}/blogs/${article.slug}`;
    const image = pickImage(article, opts.defaultImage || DEFAULT_IMAGE);
    const d = opts.dims && opts.dims.width > 0 && opts.dims.height > 0 ? opts.dims : FALLBACK_DIMS[image.source];
    return { title, description, url, image: image.url, imageSource: image.source, width: d.width, height: d.height, published: isoDay(article.published_date) };
}

// Remove EVERY existing copy of the tags we own, so the result can never contain duplicates or conflicts,
// whatever the template looked like.
const OWNED_TAG_PATTERNS = [
    /<meta\b[^>]*?\bname=["']description["'][^>]*>\s*/gi,
    /<meta\b[^>]*?\bproperty=["'](?:og|article):[^"']*["'][^>]*>\s*/gi,
    /<meta\b[^>]*?\bname=["']twitter:[^"']*["'][^>]*>\s*/gi,
    /<link\b[^>]*?\brel=["']canonical["'][^>]*>\s*/gi,
    /<!--\s*prerendered-(?:article|redirect):v1[^>]*-->\s*/gi,
];

function assertTemplate(template) {
    if (typeof template !== 'string' || !/<head[\s>]/i.test(template) || !/<\/head>/i.test(template) || !/<div id=["']root["']/i.test(template)) {
        throw new Error('Page template is not a valid built index.html (missing <head>, </head> or the React root element)');
    }
}

function renderArticleHtml(template, article, opts = {}) {
    assertTemplate(template);
    if (!isValidSlug(article && article.slug)) throw new Error('Article has no valid slug');
    const m = articleMeta(article, opts);
    let html = template;
    for (const re of OWNED_TAG_PATTERNS) html = html.replace(re, '');

    const titleTag = `<title>${escapeAttr(m.title)}</title>`;
    html = /<title>[\s\S]*?<\/title>/i.test(html)
        ? html.replace(/<title>[\s\S]*?<\/title>/i, () => titleTag)
        : html.replace(/<head([^>]*)>/i, (all) => `${all}\n        ${titleTag}`);

    const t = escapeAttr(m.title), d = escapeAttr(m.description), u = escapeAttr(m.url), i = escapeAttr(m.image);
    const block = [
        `<!-- ${PAGE_MARKER} -->`,
        `<meta name="description" content="${d}" />`,
        `<link rel="canonical" href="${u}" />`,
        `<meta property="og:type" content="article" />`,
        `<meta property="og:url" content="${u}" />`,
        `<meta property="og:title" content="${t}" />`,
        `<meta property="og:description" content="${d}" />`,
        `<meta property="og:image" content="${i}" />`,
        `<meta property="og:image:width" content="${m.width}" />`,
        `<meta property="og:image:height" content="${m.height}" />`,
        ...(m.published ? [`<meta property="article:published_time" content="${m.published}" />`] : []),
        `<meta property="article:author" content="${escapeAttr(SITE_AUTHOR)}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:url" content="${u}" />`,
        `<meta name="twitter:title" content="${t}" />`,
        `<meta name="twitter:description" content="${d}" />`,
        `<meta name="twitter:image" content="${i}" />`,
    ].map((l) => `        ${l}`).join('\n');
    return html.replace(/<\/head>/i, () => `${block}\n    </head>`);
}

/** Small page left at an OLD slug after a slug change: canonical + instant redirect to the new URL. */
function renderRedirectStub(oldSlug, newSlug) {
    if (!isValidSlug(oldSlug) || !isValidSlug(newSlug)) throw new Error('Invalid slug for redirect page');
    const target = `${SITE_URL}/blogs/${newSlug}`;
    const u = escapeAttr(target);
    return `<!doctype html>\n<html lang="en">\n    <head>\n        <meta charset="UTF-8" />\n        <title>Article moved | Siddiqui.Digital</title>\n        <!-- ${REDIRECT_MARKER} -->\n        <meta name="robots" content="noindex, follow" />\n        <link rel="canonical" href="${u}" />\n        <meta http-equiv="refresh" content="0; url=/blogs/${escapeAttr(newSlug)}" />\n    </head>\n    <body>\n        <p>This article has moved to <a href="${u}">${u}</a>.</p>\n    </body>\n</html>\n`;
}

const isRedirectStub = (html) => typeof html === 'string' && html.includes(REDIRECT_MARKER);
// True for pages produced by this module AND by the older build script (which had no marker).
function looksGenerated(html) {
    if (typeof html !== 'string') return false;
    if (html.includes(PAGE_MARKER) || html.includes(REDIRECT_MARKER)) return true;
    return /property=["']og:type["'][^>]*content=["']article["']/i.test(html) && /<div id=["']root["']/i.test(html);
}

// Read back the tags that matter from rendered HTML (used to verify a file was really written).
function extractMeta(html) {
    const tag = (re) => { const m = html.match(re); return m ? m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : null; };
    return {
        title: tag(/<title>([\s\S]*?)<\/title>/i),
        description: tag(/<meta\s+name="description"\s+content="([^"]*)"/i),
        canonical: tag(/<link\s+rel="canonical"\s+href="([^"]*)"/i),
        ogImage: tag(/<meta\s+property="og:image"\s+content="([^"]*)"/i),
        twitterImage: tag(/<meta\s+name="twitter:image"\s+content="([^"]*)"/i),
        ogUrl: tag(/<meta\s+property="og:url"\s+content="([^"]*)"/i),
    };
}

/** Does `html` really carry the metadata we meant to write? */
function verifyRendered(html, article, opts = {}) {
    const m = articleMeta(article, opts); const got = extractMeta(html);
    const problems = [];
    if (got.title !== m.title) problems.push('title');
    if (got.description !== m.description) problems.push('description');
    if (got.canonical !== m.url || got.ogUrl !== m.url) problems.push('canonical');
    if (got.ogImage !== m.image || got.twitterImage !== m.image) problems.push('image');
    if ((html.match(/rel=["']canonical["']/gi) || []).length !== 1) problems.push('duplicate-canonical');
    if (!/<div id=["']root["']/i.test(html)) problems.push('react-root-missing');
    return problems;
}

// ── Image size probing (so og:image:width/height are the REAL size) ──────────────────────────────────────
function parseImageDimensions(buf) {
    if (!buf || buf.length < 24) return null;
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) { // PNG
        const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20); return w > 0 && h > 0 ? { width: w, height: h } : null;
    }
    if (buf[0] === 0xFF && buf[1] === 0xD8) { // JPEG
        let i = 2;
        while (i + 9 < buf.length) {
            if (buf[i] !== 0xFF) { i++; continue; }
            const marker = buf[i + 1];
            if (marker === 0xFF) { i++; continue; }
            if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD9)) { i += 2; continue; }
            const len = buf.readUInt16BE(i + 2);
            if (len < 2) return null;
            if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
                const h = buf.readUInt16BE(i + 5), w = buf.readUInt16BE(i + 7); return w > 0 && h > 0 ? { width: w, height: h } : null;
            }
            i += 2 + len;
        }
        return null;
    }
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') { // WebP
        const kind = buf.toString('ascii', 12, 16);
        if (kind === 'VP8 ' && buf.length >= 30) return { width: buf.readUInt16LE(26) & 0x3FFF, height: buf.readUInt16LE(28) & 0x3FFF };
        if (kind === 'VP8L' && buf.length >= 25) { const b = buf.readUInt32LE(21); return { width: (b & 0x3FFF) + 1, height: ((b >> 14) & 0x3FFF) + 1 }; }
        if (kind === 'VP8X' && buf.length >= 30) return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
    }
    return null;
}

/**
 * Fetch just the first 64 KB of an image and read its size. Returns {width,height} or null. Never throws.
 * opts: { allowHosts: string[] (required — only these hosts are contacted), cache: Map, timeoutMs, redirects }
 */
function probeImageDimensions(url, opts = {}) {
    return new Promise((resolve) => {
        let parsed;
        try { parsed = new URL(url); } catch { return resolve(null); }
        const allow = (opts.allowHosts || []).map((h) => String(h).toLowerCase());
        if (!/^https?:$/.test(parsed.protocol) || !allow.includes(parsed.hostname.toLowerCase())) return resolve(null);
        if (opts.cache && opts.cache.has(url)) return resolve(opts.cache.get(url));
        const done = (v) => { if (opts.cache && v) opts.cache.set(url, v); resolve(v); };
        const lib = parsed.protocol === 'https:' ? https : http;
        const req = lib.get(url, { headers: { Range: 'bytes=0-65535', 'User-Agent': 'siddiqui-prerender/1' }, timeout: opts.timeoutMs || 6000 }, (res) => {
            if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && (opts.redirects || 0) < 2) {
                res.resume();
                return probeImageDimensions(new URL(res.headers.location, url).href, { ...opts, redirects: (opts.redirects || 0) + 1 }).then(done);
            }
            if (res.statusCode !== 200 && res.statusCode !== 206) { res.resume(); return done(null); }
            const chunks = []; let n = 0;
            res.on('data', (c) => { chunks.push(c); n += c.length; if (n >= 65536) { res.destroy(); } });
            res.on('close', () => done(parseImageDimensions(Buffer.concat(chunks))));
            res.on('error', () => done(null));
        });
        req.on('timeout', () => { req.destroy(); done(null); });
        req.on('error', () => done(null));
    });
}

module.exports = {
    SITE_URL, SITE_AUTHOR, DEFAULT_IMAGE, DEFAULT_DESCRIPTION, TITLE_SUFFIX, FALLBACK_DIMS, PAGE_MARKER, REDIRECT_MARKER,
    isPubliclyVisible, isValidSlug, httpUrl, escapeAttr, pickImage, articleMeta,
    renderArticleHtml, renderRedirectStub, isRedirectStub, looksGenerated, extractMeta, verifyRendered,
    parseImageDimensions, probeImageDimensions,
};
