/**
 * /api/reading - Online Reading content management (mounted behind requireAdmin in index.js).
 * Books and chapters: create, edit (rich text, sanitised on the server), draft / publish / unpublish, reorder, preview, delete with confirmation.
 * Only PUBLISHED chapters of PUBLISHED books ever reach customers (the customer API enforces it too). Every change is written to the audit log,
 * and the "book" knowledge source used by Ask SID is kept in step automatically.
 */
const express = require('express');
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { sanitizeChapterHtml, uniqueSlug, slugify, indexPublishedChapter, removeChapterIndex } = require('../utils/readerContent');

const router = express.Router();
router.use(express.json({ limit: '3mb' })); // chapter bodies are larger than the 100 kb default; this only runs after requireAdmin
const CATALOG = 'marketing-reclassified';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOOK_STATUS = ['draft', 'published', 'unpublished'];
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
const fail = (res, code, message) => res.status(code).json({ error: message });
const guardId = (req, res, next) => (UUID_RE.test(req.params.id) ? next() : fail(res, 400, 'Invalid id'));

async function audit(req, action, targetType, targetId, detail = {}) {
    try { await supabaseAdmin.from('admin_audit_log').insert([{ actor_id: req.user.id, actor_label: req.user.email, action, target_type: targetType, target_id: String(targetId), detail }]); }
    catch (e) { console.warn('[reading] audit failed:', e.message); }
}
const loadBook = async (id) => (await supabaseAdmin.from('reader_books').select('*').eq('id', id).maybeSingle()).data;
const loadChapter = async (id) => (await supabaseAdmin.from('reader_chapters').select('*').eq('id', id).maybeSingle()).data;
const migrated = (res, error) => (error && /does not exist|schema cache|PGRST20/.test(`${error.code} ${error.message}`) ? fail(res, 503, 'The reading tables are not installed yet (database migration pending).') : fail(res, 500, error.message));

// ----- books -----------------------------------------------------------------------------------------------------------
router.get('/books', async (_req, res) => {
    const { data: books, error } = await supabaseAdmin.from('reader_books').select('*').eq('catalog_key', CATALOG).order('position', { ascending: true });
    if (error) return migrated(res, error);
    const { data: chapters } = await supabaseAdmin.from('reader_chapters').select('book_id,status');
    const counts = {};
    for (const c of chapters || []) { const k = counts[c.book_id] || (counts[c.book_id] = { draft: 0, published: 0, unpublished: 0 }); k[c.status] += 1; }
    res.json({ books: (books || []).map((b) => ({ ...b, chapterCounts: counts[b.id] || { draft: 0, published: 0, unpublished: 0 } })) });
});

router.post('/books', async (req, res) => {
    const title = str(req.body.title, 200);
    if (!title) return fail(res, 400, 'A title is required.');
    const slug = await uniqueSlug(supabaseAdmin, 'reader_books', {}, req.body.slug || title);
    const { data: last } = await supabaseAdmin.from('reader_books').select('position').order('position', { ascending: false }).limit(1);
    const row = { catalog_key: CATALOG, slug, title, subtitle: str(req.body.subtitle, 300) || null, description: str(req.body.description, 4000) || null, cover_image_url: str(req.body.cover_image_url, 1000) || null, status: 'draft', position: ((last && last[0] && last[0].position) || 0) + 1, created_by: req.user.id };
    const { data, error } = await supabaseAdmin.from('reader_books').insert([row]).select().single();
    if (error) return migrated(res, error);
    await audit(req, 'reading.book.create', 'reader_book', data.id, { title });
    res.status(201).json({ book: data });
});

router.put('/books/:id', guardId, async (req, res) => {
    const book = await loadBook(req.params.id);
    if (!book) return fail(res, 404, 'Book not found');
    const patch = {};
    for (const [k, max] of [['title', 200], ['subtitle', 300], ['description', 4000], ['cover_image_url', 1000]]) if (req.body[k] !== undefined) patch[k] = str(req.body[k], max) || (k === 'title' ? book.title : null);
    if (req.body.slug !== undefined) patch.slug = await uniqueSlug(supabaseAdmin, 'reader_books', {}, req.body.slug, book.id);
    if (req.body.status !== undefined) { if (!BOOK_STATUS.includes(req.body.status)) return fail(res, 400, 'Invalid status'); patch.status = req.body.status; }
    if (!Object.keys(patch).length) return fail(res, 400, 'Nothing to update');
    const { data, error } = await supabaseAdmin.from('reader_books').update(patch).eq('id', book.id).select().single();
    if (error) return migrated(res, error);
    if (patch.status && patch.status !== book.status) { // book visibility changes what Ask SID may quote
        const { data: chs } = await supabaseAdmin.from('reader_chapters').select('*').eq('book_id', book.id);
        for (const c of chs || []) await indexPublishedChapter(supabaseAdmin, data, c);
    }
    await audit(req, 'reading.book.update', 'reader_book', book.id, { fields: Object.keys(patch) });
    res.json({ book: data });
});

router.delete('/books/:id', guardId, async (req, res) => {
    const book = await loadBook(req.params.id);
    if (!book) return fail(res, 404, 'Book not found');
    if (req.body.confirm !== true || req.body.confirmTitle !== book.title) return fail(res, 400, 'Deleting a book needs confirm=true and the exact book title in confirmTitle.');
    if (book.status === 'published') return fail(res, 409, 'Unpublish the book before deleting it.');
    const { error } = await supabaseAdmin.from('reader_books').delete().eq('id', book.id);
    if (error) return fail(res, 500, error.message);
    await audit(req, 'reading.book.delete', 'reader_book', book.id, { title: book.title });
    res.json({ deleted: true });
});

// ----- Ask SID status: what the book index contains right now, and a repair ("re-index everything") ------------------------
router.get('/ask-sid-status', async (_req, res) => {
    const { data: books, error } = await supabaseAdmin.from('reader_books').select('id,title,status').eq('catalog_key', CATALOG).order('position', { ascending: true });
    if (error) return migrated(res, error);
    const { data: chs } = await supabaseAdmin.from('reader_chapters').select('id,book_id,status');
    const { data: chunks } = await supabaseAdmin.from('knowledge_chunks').select('reader_chapter_id').eq('source', 'book').not('reader_chapter_id', 'is', null).limit(20000);
    const perChapter = {}; for (const c of chunks || []) perChapter[c.reader_chapter_id] = (perChapter[c.reader_chapter_id] || 0) + 1;
    const { count: orphan } = await supabaseAdmin.from('knowledge_chunks').select('id', { count: 'exact', head: true }).eq('source', 'book').is('reader_chapter_id', null);
    const list = (books || []).map((b) => {
        const mine = (chs || []).filter((c) => c.book_id === b.id);
        const published = mine.filter((c) => c.status === 'published');
        return { id: b.id, title: b.title, status: b.status, chapters: mine.length, publishedChapters: published.length, passages: mine.reduce((n, c) => n + (perChapter[c.id] || 0), 0) };
    });
    const passages = list.reduce((n, b) => n + b.passages, 0) + (orphan || 0);
    res.json({ books: list, passages, otherPassages: orphan || 0, usingBook: passages > 0 });
});

router.post('/reindex', async (req, res) => {
    const { data: books, error } = await supabaseAdmin.from('reader_books').select('*').eq('catalog_key', CATALOG);
    if (error) return migrated(res, error);
    let passages = 0; const problems = [];
    for (const b of books || []) {
        const { data: chs } = await supabaseAdmin.from('reader_chapters').select('*').eq('book_id', b.id);
        for (const c of chs || []) { try { passages += await indexPublishedChapter(supabaseAdmin, b, c); } catch (e) { problems.push(`${b.title} / ${c.title}: ${e.message}`); } }
    }
    await audit(req, 'reading.reindex', 'reader_book', 'all', { passages, problems: problems.length });
    res.json({ passages, problems });
});

// ----- chapters --------------------------------------------------------------------------------------------------------
router.get('/books/:id/chapters', guardId, async (req, res) => {
    const { data, error } = await supabaseAdmin.from('reader_chapters').select('id,book_id,slug,title,position,status,version,published_at,updated_at').eq('book_id', req.params.id).order('position', { ascending: true });
    if (error) return migrated(res, error);
    res.json({ chapters: data || [] });
});

router.post('/books/:id/chapters', guardId, async (req, res) => {
    const book = await loadBook(req.params.id);
    if (!book) return fail(res, 404, 'Book not found');
    const title = str(req.body.title, 200);
    if (!title) return fail(res, 400, 'A chapter title is required.');
    const slug = await uniqueSlug(supabaseAdmin, 'reader_chapters', { book_id: book.id }, req.body.slug || title);
    const { data: last } = await supabaseAdmin.from('reader_chapters').select('position').eq('book_id', book.id).order('position', { ascending: false }).limit(1);
    const row = { book_id: book.id, slug, title, position: ((last && last[0] && last[0].position) || 0) + 1, content_html: sanitizeChapterHtml(req.body.content_html), status: 'draft', created_by: req.user.id };
    const { data, error } = await supabaseAdmin.from('reader_chapters').insert([row]).select().single();
    if (error) return migrated(res, error);
    await audit(req, 'reading.chapter.create', 'reader_chapter', data.id, { title, book: book.slug });
    res.status(201).json({ chapter: data });
});

// Full chapter (also drafts): this is the administrator's PREVIEW. The customer API never returns anything that is not published.
router.get('/chapters/:id', guardId, async (req, res) => {
    const c = await loadChapter(req.params.id);
    if (!c) return fail(res, 404, 'Chapter not found');
    res.json({ chapter: c });
});

router.put('/chapters/:id', guardId, async (req, res) => {
    const c = await loadChapter(req.params.id);
    if (!c) return fail(res, 404, 'Chapter not found');
    if (req.body.expectedVersion !== undefined && Number(req.body.expectedVersion) !== c.version) return fail(res, 409, 'This chapter was changed by someone else. Reload it before saving.');
    const patch = {};
    if (req.body.title !== undefined) { const t = str(req.body.title, 200); if (!t) return fail(res, 400, 'A chapter title is required.'); patch.title = t; }
    if (req.body.content_html !== undefined) patch.content_html = sanitizeChapterHtml(req.body.content_html);
    if (req.body.slug !== undefined) patch.slug = await uniqueSlug(supabaseAdmin, 'reader_chapters', { book_id: c.book_id }, req.body.slug, c.id);
    if (!Object.keys(patch).length) return fail(res, 400, 'Nothing to update');
    patch.version = c.version + 1;
    const { data, error } = await supabaseAdmin.from('reader_chapters').update(patch).eq('id', c.id).select().single();
    if (error) return migrated(res, error);
    if (data.status === 'published') { const book = await loadBook(data.book_id); await indexPublishedChapter(supabaseAdmin, book, data); }
    await audit(req, 'reading.chapter.update', 'reader_chapter', c.id, { fields: Object.keys(patch).filter((k) => k !== 'version') });
    res.json({ chapter: data });
});

async function setChapterStatus(req, res, status) {
    const c = await loadChapter(req.params.id);
    if (!c) return fail(res, 404, 'Chapter not found');
    if (status === 'published' && !String(c.content_html || '').replace(/<[^>]*>/g, '').trim()) return fail(res, 400, 'An empty chapter cannot be published.');
    const patch = { status, published_at: status === 'published' ? new Date().toISOString() : c.published_at };
    const { data, error } = await supabaseAdmin.from('reader_chapters').update(patch).eq('id', c.id).select().single();
    if (error) return migrated(res, error);
    const book = await loadBook(data.book_id);
    await indexPublishedChapter(supabaseAdmin, book, data);
    await audit(req, `reading.chapter.${status === 'published' ? 'publish' : 'unpublish'}`, 'reader_chapter', c.id, { title: c.title, bookStatus: book && book.status });
    res.json({ chapter: data, note: status === 'published' && book && book.status !== 'published' ? 'The book itself is not published yet, so customers cannot see this chapter.' : undefined });
}
router.post('/chapters/:id/publish', guardId, (req, res) => setChapterStatus(req, res, 'published'));
router.post('/chapters/:id/unpublish', guardId, (req, res) => setChapterStatus(req, res, 'unpublished'));

router.delete('/chapters/:id', guardId, async (req, res) => {
    const c = await loadChapter(req.params.id);
    if (!c) return fail(res, 404, 'Chapter not found');
    if (req.body.confirm !== true) return fail(res, 400, 'Deleting a chapter needs confirm=true.');
    await removeChapterIndex(supabaseAdmin, c.id);
    const { error } = await supabaseAdmin.from('reader_chapters').delete().eq('id', c.id);
    if (error) return fail(res, 500, error.message);
    await audit(req, 'reading.chapter.delete', 'reader_chapter', c.id, { title: c.title });
    res.json({ deleted: true });
});

router.put('/books/:id/order', guardId, async (req, res) => {
    const ids = req.body.chapterIds;
    if (!Array.isArray(ids) || !ids.every((x) => UUID_RE.test(String(x)))) return fail(res, 400, 'chapterIds must be a list of chapter ids.');
    const { error } = await supabaseAdmin.rpc('reorder_reader_chapters', { p_book_id: req.params.id, p_ids: ids });
    if (error) return fail(res, /mismatch|not_found/.test(error.message) ? 409 : 500, /mismatch/.test(error.message) ? 'The list must contain every chapter of the book exactly once.' : error.message);
    await audit(req, 'reading.chapter.reorder', 'reader_book', req.params.id, { count: ids.length });
    res.json({ reordered: ids.length });
});

// ----- import a book from a Word (.docx) file -----------------------------------------------------------------------------
// Each "Heading 1" starts a chapter. Nothing is published: chapters are created as DRAFTS (appended after the existing ones).
// dryRun=true only reports what would be created, so the administrator can check it first.
const multer = require('multer');
const DOCX_MAX_MB = 50;
const docxUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: DOCX_MAX_MB * 1024 * 1024, files: 1 } });
// Figures: the editor only accepts https images, so each picture inside the Word file is stored in the public "blogs" image bucket
// under an unguessable name and referenced by its URL (embedded base64 pictures would be removed by the sanitizer).
const IMG_BUCKET = 'blogs';
const IMG_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
const IMG_MAX_BYTES = 10 * 1024 * 1024;
function splitByHeading(html, fallbackTitle) {
    const parts = []; const re = /<h1[^>]*>([\s\S]*?)<\/h1>/gi; let m; let lastIdx = 0; let title = null;
    const text = (x) => x.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    while ((m = re.exec(html))) {
        const before = html.slice(lastIdx, m.index);
        if (title !== null || text(before)) parts.push({ title: title || fallbackTitle, html: before });
        title = text(m[1]) || 'Untitled chapter'; lastIdx = re.lastIndex;
    }
    const rest = html.slice(lastIdx);
    if (title !== null) parts.push({ title, html: rest }); else if (text(rest)) parts.push({ title: fallbackTitle, html: rest });
    return parts.filter((p) => text(p.html).length > 0 || p.title);
}
router.post('/books/:id/import-docx', guardId, (req, res, next) => docxUpload.single('file')(req, res, (err) => (err ? fail(res, err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, err.code === 'LIMIT_FILE_SIZE' ? `The file is larger than ${DOCX_MAX_MB} MB.` : 'Upload failed.') : next())), async (req, res) => {
    req.setTimeout(10 * 60 * 1000); res.setTimeout(10 * 60 * 1000); // a large file with many figures takes a while
    const book = await loadBook(req.params.id);
    if (!book) return fail(res, 404, 'Book not found');
    const f = req.file;
    if (!f) return fail(res, 400, 'Choose a Word (.docx) file.');
    if (f.buffer.slice(0, 2).toString('latin1') !== 'PK') return fail(res, 400, 'This is not a Word (.docx) document.');
    const dryRun = req.body.dryRun === 'true';
    let converted; let imageCount = 0; let imageSkipped = 0; const stored = [];
    try {
        const mammoth = require('mammoth');
        converted = await mammoth.convertToHtml({ buffer: f.buffer }, { convertImage: mammoth.images.imgElement(async (image) => {
            imageCount++;
            const ext = IMG_TYPES[String(image.contentType || '').toLowerCase()];
            if (dryRun) return { src: 'https://example.invalid/preview.' + (ext || 'png'), alt: image.altText || '' }; // nothing is stored in a check run
            const buf = await image.readAsBuffer();
            if (!ext || buf.length > IMG_MAX_BYTES) { imageSkipped++; return { src: '' }; }
            const name = `reader/${book.id}/${crypto.randomUUID()}.${ext}`;
            const up = await supabaseAdmin.storage.from(IMG_BUCKET).upload(name, buf, { contentType: image.contentType, upsert: false });
            if (up.error) throw new Error('Figure upload failed: ' + up.error.message);
            stored.push(name);
            return { src: supabaseAdmin.storage.from(IMG_BUCKET).getPublicUrl(name).data.publicUrl, alt: image.altText || '' };
        }) });
    } catch (e) {
        if (stored.length) await supabaseAdmin.storage.from(IMG_BUCKET).remove(stored).catch(() => {}); // nothing was created: do not leave the figures behind
        return fail(res, 422, /Figure upload failed/.test(e.message) ? e.message : 'The Word file could not be read. Save it again as .docx and retry.');
    }
    const fallback = String(f.originalname || 'Chapter').replace(/\.docx$/i, '').slice(0, 120) || 'Chapter';
    const dropFigures = async () => { if (stored.length) await supabaseAdmin.storage.from(IMG_BUCKET).remove(stored).catch(() => {}); };
    const chapters = splitByHeading(sanitizeChapterHtml(converted.value.replace(/<img\b[^>]*\bsrc=""[^>]*>/gi, '')), fallback);
    if (!chapters.length) { await dropFigures(); return fail(res, 422, 'No text was found in this document.'); }
    if (chapters.length > 80) { await dropFigures(); return fail(res, 422, 'More than 80 chapters were found. Check that only chapter titles use "Heading 1".'); }
    const summary = chapters.map((c) => ({ title: c.title.slice(0, 200), words: c.html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length }));
    if (dryRun) return res.json({ dryRun: true, chapters: summary, figures: imageCount, warnings: converted.messages.slice(0, 5).map((m) => m.message) });
    const { data: last } = await supabaseAdmin.from('reader_chapters').select('position').eq('book_id', book.id).order('position', { ascending: false }).limit(1);
    let position = (last && last[0] && last[0].position) || 0;
    const created = [];
    for (const c of chapters) {
        const title = c.title.slice(0, 200);
        const slug = await uniqueSlug(supabaseAdmin, 'reader_chapters', { book_id: book.id }, title);
        const { data, error } = await supabaseAdmin.from('reader_chapters').insert([{ book_id: book.id, slug, title, position: ++position, content_html: sanitizeChapterHtml(c.html), status: 'draft', created_by: req.user.id }]).select('id,title').single();
        if (error) return fail(res, 500, `Stopped after ${created.length} chapter(s): ${error.message}`);
        created.push(data);
    }
    await audit(req, 'reading.book.import_docx', 'reader_book', book.id, { chapters: created.length });
    res.status(201).json({ created: created.length, chapters: created, figures: imageCount - imageSkipped, figuresSkipped: imageSkipped });
});

module.exports = router;
