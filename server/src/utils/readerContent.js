/**
 * readerContent.js - everything that turns administrator input into safe, searchable reader content.
 *   sanitizeChapterHtml : the ONLY way chapter HTML reaches the database (allow-list; scripts, styles, event handlers, javascript: URLs are removed)
 *   slugify / uniqueSlug
 *   htmlToBlocks / chunkBlocks / chunkPlainText : split content into the passages Ask SID searches
 *   indexPublishedChapter / removeChapterIndex : keep the "book" knowledge source in step with the published chapters
 */
const sanitizeHtml = require('sanitize-html');

const SANITIZE = {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'br', 'hr', 'ul', 'ol', 'li', 'blockquote', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'code', 'pre', 'a', 'img', 'figure', 'figcaption',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col', 'span', 'div', 'mark'],
    allowedAttributes: { a: ['href', 'title', 'target', 'rel'], img: ['src', 'alt', 'title', 'width', 'height'], th: ['colspan', 'rowspan', 'scope'], td: ['colspan', 'rowspan'], col: ['span'], '*': ['style'] },
    allowedStyles: { '*': { 'text-align': [/^(left|right|center|justify)$/] } },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
        a: (tagName, attribs) => ({ tagName: 'a', attribs: { ...attribs, rel: 'noopener noreferrer nofollow', ...(attribs.href && /^https?:/i.test(attribs.href) ? { target: '_blank' } : {}) } }),
    },
};
const sanitizeChapterHtml = (html) => sanitizeHtml(String(html || ''), SANITIZE);

const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
async function uniqueSlug(db, table, scope, base, excludeId) {
    const root = slugify(base) || 'untitled';
    for (let i = 0; i < 200; i++) {
        const candidate = i === 0 ? root : `${root}-${i + 1}`;
        let q = db.from(table).select('id').eq('slug', candidate);
        for (const [k, v] of Object.entries(scope || {})) q = q.eq(k, v);
        const { data } = await q.limit(1);
        if (!data || data.length === 0 || (excludeId && data.every((r) => r.id === excludeId))) return candidate;
    }
    return `${root}-${Date.now()}`;
}

/** HTML -> ordered text blocks, remembering the closest heading (used as the "concept" of each passage). */
function htmlToBlocks(html) {
    const marked = String(html || '')
        .replace(/<\/(p|li|tr|blockquote|pre|figcaption|caption)>/gi, '</$1>\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, _l, inner) => `\n@@H@@${inner}\n`);
    const text = sanitizeHtml(marked, { allowedTags: [], allowedAttributes: {} }).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
    const blocks = []; let heading = null;
    for (const raw of text.split('\n')) {
        const line = raw.replace(/\s+/g, ' ').trim();
        if (!line) continue;
        if (line.startsWith('@@H@@')) { heading = line.slice(5).trim() || heading; continue; }
        blocks.push({ heading, text: line });
    }
    return blocks;
}

/** Group consecutive blocks under the same heading into passages of roughly 80-170 words. */
function chunkBlocks(blocks, chapterRef, { target = 130, max = 190 } = {}) {
    const chunks = []; let cur = null;
    const flush = () => { if (cur && cur.text.trim()) chunks.push({ chapter_ref: chapterRef, concept: cur.heading || null, content: cur.text.trim() }); cur = null; };
    for (const b of blocks) {
        const n = b.text.split(/\s+/).length;
        if (cur && (cur.heading !== b.heading || cur.words + n > max)) flush();
        if (!cur) cur = { heading: b.heading, text: '', words: 0 };
        cur.text += (cur.text ? ' ' : '') + b.text; cur.words += n;
        if (cur.words >= target) flush();
    }
    flush();
    return chunks;
}

/** Plain text (PDF extraction) -> passages. Headings: "Chapter 3 ...", "Part ...", short lines in capitals or without a full stop. */
function chunkPlainText(pages, { fallbackRef = 'Companion Pack' } = {}) {
    const blocks = []; let chapter = null; let section = null;
    const isChapter = (l) => /^(chapter|part|module|worksheet|appendix)\s+[\w.-]+/i.test(l) && l.split(/\s+/).length <= 14;
    const isHeading = (l) => l.length <= 70 && l.split(/\s+/).length <= 9 && !/[.!?,;:]$/.test(l) && /^[A-Z0-9]/.test(l);
    pages.forEach((pageText, idx) => {
        let para = [];
        const pushPara = () => { if (para.length) { blocks.push({ heading: section, ref: chapter || `${fallbackRef}, page ${idx + 1}`, text: para.join(' ').replace(/\s+/g, ' ').trim() }); para = []; } };
        for (const raw of String(pageText || '').split(/\r?\n/)) {
            const line = raw.replace(/\s+/g, ' ').trim();
            if (!line) { pushPara(); continue; }
            if (isChapter(line)) { pushPara(); chapter = line; section = line; continue; }
            if (isHeading(line) && para.length === 0) { section = line; continue; }
            para.push(line);
        }
        pushPara();
    });
    const chunks = []; let cur = null;
    const flush = () => { if (cur && cur.text.trim().length > 40) chunks.push({ chapter_ref: cur.ref, concept: cur.heading || null, content: cur.text.trim() }); cur = null; };
    for (const b of blocks) {
        const n = b.text.split(/\s+/).length;
        if (cur && (cur.heading !== b.heading || cur.ref !== b.ref || cur.words + n > 190)) flush();
        if (!cur) cur = { heading: b.heading, ref: b.ref, text: '', words: 0 };
        cur.text += (cur.text ? ' ' : '') + b.text; cur.words += n;
        if (cur.words >= 130) flush();
    }
    flush();
    return chunks;
}

/** (Re)index ONE published chapter into the standard "book" knowledge source. Unpublished chapters have no chunks. */
async function indexPublishedChapter(db, book, chapter) {
    await db.from('knowledge_chunks').delete().eq('reader_chapter_id', chapter.id);
    if (chapter.status !== 'published' || book.status !== 'published') return 0;
    const chunks = chunkBlocks(htmlToBlocks(chapter.content_html), chapter.title);
    if (!chunks.length) return 0;
    const rows = chunks.map((c, i) => ({ catalog_key: book.catalog_key, source: 'book', reader_chapter_id: chapter.id, position: chapter.position * 1000 + i, ...c }));
    const { error } = await db.from('knowledge_chunks').insert(rows);
    if (error) throw new Error('indexing failed: ' + error.message);
    return rows.length;
}
const removeChapterIndex = (db, chapterId) => db.from('knowledge_chunks').delete().eq('reader_chapter_id', chapterId);

module.exports = { sanitizeChapterHtml, slugify, uniqueSlug, htmlToBlocks, chunkBlocks, chunkPlainText, indexPublishedChapter, removeChapterIndex };
