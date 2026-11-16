/**
 * /api/companion-files - Digital Companion PDF management (mounted behind requireAdmin).
 *   upload  : PDF only (checked by content, not by name), up to 30 MB, stored in the PRIVATE digital-products bucket
 *   process : text is extracted and split into passages with chapter references, then indexed for Ask SID ("companion" source)
 *   replace : a newly uploaded file becomes the CURRENT download only after it was indexed successfully; the old version stays in storage
 *             (and can be made current again), so a bad upload can never leave customers without a file
 *   status  : uploaded / processing / indexed / failed, with the error and the number of attempts; failed files can be retried
 * Customers reach the file only through the customer API, which checks their Digital Companion entitlement on every download.
 */
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { supabaseAdmin } = require('../config/supabase');
const { chunkPlainText } = require('../utils/readerContent');

const router = express.Router();
const CATALOG = 'marketing-reclassified';
const BUCKET = 'digital-products';
const MAX_BYTES = 30 * 1024 * 1024;
const MR_PRODUCT_ID = String(process.env.MR_PRODUCT_ID || '04b84648-3609-4b31-9ded-2486bacf1e74');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });
const fail = (res, code, message) => res.status(code).json({ error: message });
const notInstalled = (res, error) => (error && /does not exist|schema cache|PGRST20/.test(`${error.code} ${error.message}`) ? fail(res, 503, 'The Companion tables are not installed yet (database migration pending).') : fail(res, 500, error.message));
async function audit(req, action, id, detail) { try { await supabaseAdmin.from('admin_audit_log').insert([{ actor_id: req.user.id, actor_label: req.user.email, action, target_type: 'companion_file', target_id: String(id), detail: detail || {} }]); } catch { /* best effort */ } }

/** PDF -> array of page texts (pdfjs-dist, the maintained PDF.js build). Loaded lazily so the server still starts if the package is missing: the upload then reports it. */
async function extractPages(buffer) {
    let pdfjs;
    try { pdfjs = require('pdfjs-dist/legacy/build/pdf.js'); } catch { throw new Error('The PDF reader (pdfjs-dist) is not installed on the server. Run "npm install" in the server folder.'); }
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false, disableFontFace: true }).promise;
    try {
        const pages = [];
        for (let i = 1; i <= doc.numPages; i++) {
            const tc = await (await doc.getPage(i)).getTextContent();
            let last = null; let text = '';
            for (const item of tc.items) { if (last !== null && item.transform[5] !== last) text += String.fromCharCode(10); text += item.str; last = item.transform[5]; }
            pages.push(text);
        }
        return pages;
    } finally { await doc.destroy(); }
}

/** Extract + index one stored file. Never throws: the outcome is written to the row. */
async function processFile(fileRow, { makeCurrent }) {
    const id = fileRow.id;
    await supabaseAdmin.from('companion_files').update({ process_status: 'processing', error_message: null, attempts: (fileRow.attempts || 0) + 1 }).eq('id', id);
    try {
        const { data: blob, error } = await supabaseAdmin.storage.from(fileRow.storage_bucket).download(fileRow.storage_path);
        if (error || !blob) throw new Error('The stored file could not be read: ' + (error && error.message));
        const buffer = Buffer.from(await blob.arrayBuffer());
        const pages = await extractPages(buffer);
        const chunks = chunkPlainText(pages, { fallbackRef: 'Companion Pack' });
        if (!chunks.length) throw new Error('No readable text was found in this PDF (a scanned or image-only PDF cannot be indexed). Upload a text-based PDF.');
        await supabaseAdmin.from('knowledge_chunks').delete().eq('file_id', id);
        const rows = chunks.map((c, i) => ({ catalog_key: CATALOG, source: 'companion', file_id: id, position: i + 1, ...c }));
        for (let i = 0; i < rows.length; i += 200) { const { error: e2 } = await supabaseAdmin.from('knowledge_chunks').insert(rows.slice(i, i + 200)); if (e2) throw new Error('Indexing failed: ' + e2.message); }
        await supabaseAdmin.from('companion_files').update({ process_status: 'indexed', chunk_count: rows.length, error_message: null, processed_at: new Date().toISOString() }).eq('id', id);
        if (makeCurrent) await setCurrent(id);
        return { ok: true, chunks: rows.length };
    } catch (err) {
        await supabaseAdmin.from('knowledge_chunks').delete().eq('file_id', id);
        await supabaseAdmin.from('companion_files').update({ process_status: 'failed', chunk_count: 0, error_message: String(err.message).slice(0, 500), processed_at: new Date().toISOString() }).eq('id', id);
        return { ok: false, error: err.message };
    }
}

/**
 * Make an INDEXED file the current download of ITS kind (the Companion Pack, or the book PDF). Each kind has exactly one current file.
 * The Companion Pack is also the current Ask SID knowledge; the book PDF is download-only and never touches Ask SID.
 */
async function setCurrent(id) {
    const { data: f } = await supabaseAdmin.from('companion_files').select('*').eq('id', id).maybeSingle();
    if (!f || f.process_status !== 'indexed') throw new Error('Only an indexed file can be made current.');
    const kind = f.kind || 'companion_pdf';
    await supabaseAdmin.from('companion_files').update({ is_current: false }).eq('catalog_key', CATALOG).eq('kind', kind).eq('is_current', true);
    await supabaseAdmin.from('companion_files').update({ is_current: true }).eq('id', id);
    if (kind === 'companion_pdf') {
        await supabaseAdmin.from('ebooks').update({ file_path: f.storage_path }).eq('id', MR_PRODUCT_ID); // what customers download
        await supabaseAdmin.from('knowledge_chunks').delete().eq('source', 'companion').eq('catalog_key', CATALOG).neq('file_id', id);
        // (the chunks of older versions are removed; an older version is re-indexed from storage if an administrator makes it current again)
    }
}

router.get('/', async (_req, res) => {
    const { data, error } = await supabaseAdmin.from('companion_files').select('*').eq('catalog_key', CATALOG).order('created_at', { ascending: false });
    if (error) return notInstalled(res, error);
    res.json({ files: (data || []).map((f) => ({ id: f.id, kind: f.kind || 'companion_pdf', originalName: f.original_name, sizeBytes: Number(f.size_bytes), version: f.version, isCurrent: f.is_current, status: f.process_status, chunkCount: f.chunk_count, errorMessage: f.error_message, attempts: f.attempts, createdAt: f.created_at, processedAt: f.processed_at })) });
});

router.post('/', (req, res, next) => upload.single('file')(req, res, (err) => (err ? fail(res, err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, err.code === 'LIMIT_FILE_SIZE' ? 'The file is larger than 30 MB.' : 'Upload failed.') : next())), async (req, res) => {
    const f = req.file;
    if (!f) return fail(res, 400, 'Choose a PDF file.');
    if (f.buffer.slice(0, 5).toString('latin1') !== '%PDF-') return fail(res, 400, 'This is not a PDF file.');
    const sha = crypto.createHash('sha256').update(f.buffer).digest('hex');
    const { data: dup } = await supabaseAdmin.from('companion_files').select('id,version').eq('catalog_key', CATALOG).eq('sha256', sha).limit(1);
    if (dup && dup.length) return fail(res, 409, `This exact file was already uploaded (version ${dup[0].version}).`);
    // kind: 'companion_pdf' (default, read by Ask SID) or 'book_pdf' (the book, download only, never indexed: Ask SID reads the book from Online Reading)
    const kind = req.body.kind === 'book_pdf' ? 'book_pdf' : 'companion_pdf';
    const { data: last } = await supabaseAdmin.from('companion_files').select('version').eq('catalog_key', CATALOG).eq('kind', kind).order('version', { ascending: false }).limit(1);
    const version = ((last && last[0] && last[0].version) || 0) + 1;
    const storagePath = kind === 'book_pdf' ? `book/${CATALOG}/v${version}-${sha.slice(0, 12)}.pdf` : `companion/${CATALOG}/v${version}-${sha.slice(0, 12)}.pdf`;
    const up = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, f.buffer, { contentType: 'application/pdf', upsert: false });
    if (up.error) return fail(res, 500, 'Storage upload failed: ' + up.error.message);
    const safeName = String(f.originalname || 'companion.pdf').replace(/[^\w .()-]/g, '_').slice(0, 120);
    const insertRow = { catalog_key: CATALOG, kind, storage_bucket: BUCKET, storage_path: storagePath, original_name: safeName, size_bytes: f.size, sha256: sha, version, uploaded_by: req.user.id };
    if (kind === 'book_pdf') Object.assign(insertRow, { process_status: 'indexed', chunk_count: 0, processed_at: new Date().toISOString() }); // nothing to index
    const { data: row, error } = await supabaseAdmin.from('companion_files').insert([insertRow]).select().single();
    if (error) {
        await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
        if (kind === 'book_pdf' && /check constraint|23514/.test(`${error.code} ${error.message}`)) return fail(res, 503, 'The book PDF option is not installed yet (database migration 20261114 pending).');
        return notInstalled(res, error);
    }
    await audit(req, 'companion.upload', row.id, { version, size: f.size, kind });
    const makeCurrent = req.body.makeCurrent !== 'false';
    if (kind === 'book_pdf') {
        if (makeCurrent) { try { await setCurrent(row.id); } catch (e) { return fail(res, 500, e.message); } }
        return res.status(201).json({ id: row.id, version, kind, status: 'indexed', message: 'Uploaded. Customers with the Digital Companion can now download it.' });
    }
    res.status(202).json({ id: row.id, version, status: 'uploaded', message: 'Uploaded. Processing has started.' });
    processFile(row, { makeCurrent }).catch((e) => console.error('[companion] processing crashed:', e.message)); // after the response: large PDFs take a while
});

router.post('/:id/retry', async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return fail(res, 400, 'Invalid id');
    const { data: row } = await supabaseAdmin.from('companion_files').select('*').eq('id', req.params.id).maybeSingle();
    if (!row) return fail(res, 404, 'File not found');
    if (row.kind === 'book_pdf') return fail(res, 400, 'The book PDF is download-only: there is nothing to index.');
    if (row.process_status === 'processing') return fail(res, 409, 'This file is already being processed.');
    await audit(req, 'companion.retry', row.id, { attempts: row.attempts });
    res.status(202).json({ id: row.id, status: 'processing' });
    processFile(row, { makeCurrent: row.is_current || req.body.makeCurrent === true }).catch((e) => console.error('[companion] retry crashed:', e.message));
});

router.post('/:id/make-current', async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return fail(res, 400, 'Invalid id');
    const { data: row } = await supabaseAdmin.from('companion_files').select('*').eq('id', req.params.id).maybeSingle();
    if (!row) return fail(res, 404, 'File not found');
    try {
        if (row.process_status !== 'indexed') return fail(res, 409, 'Only a successfully indexed file can be made current. Retry processing first.');
        const { count } = row.kind === 'book_pdf' ? { count: 1 } : await supabaseAdmin.from('knowledge_chunks').select('id', { count: 'exact', head: true }).eq('file_id', row.id);
        if (!count) { const r = await processFile(row, { makeCurrent: true }); if (!r.ok) return fail(res, 422, r.error); } else await setCurrent(row.id);
        await audit(req, 'companion.make_current', row.id, { version: row.version });
        res.json({ id: row.id, isCurrent: true });
    } catch (e) { return fail(res, 500, e.message); }
});

/** Delete one stored version (file in storage + its Ask SID passages + the row). The current download cannot be deleted: make another version current first. */
router.delete('/:id', async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return fail(res, 400, 'Invalid id');
    const { data: row } = await supabaseAdmin.from('companion_files').select('*').eq('id', req.params.id).maybeSingle();
    if (!row) return fail(res, 404, 'File not found');
    if (row.process_status === 'processing') return fail(res, 409, 'This file is being processed. Try again in a moment.');
    await supabaseAdmin.from('knowledge_chunks').delete().eq('file_id', row.id);
    const { error } = await supabaseAdmin.from('companion_files').delete().eq('id', row.id);
    if (error) return fail(res, 500, error.message);
    await supabaseAdmin.storage.from(row.storage_bucket).remove([row.storage_path]); // best effort: the row is already gone
    // deleting the current download: the newest other indexed version takes over; if there is none, customers have no file until a new PDF is uploaded
    let promoted = null;
    if (row.is_current) {
        const { data: next } = await supabaseAdmin.from('companion_files').select('id,version').eq('catalog_key', CATALOG).eq('kind', row.kind || 'companion_pdf').eq('process_status', 'indexed').order('version', { ascending: false }).limit(1);
        if (next && next[0]) { try { await setCurrent(next[0].id); promoted = next[0].version; } catch { /* leave it: an administrator can pick one */ } }
    }
    await audit(req, 'companion.delete', row.id, { version: row.version, name: row.original_name, wasCurrent: !!row.is_current, promoted });
    res.json({ id: row.id, deleted: true, promotedVersion: promoted });
});

module.exports = router;
module.exports._processFile = processFile;
