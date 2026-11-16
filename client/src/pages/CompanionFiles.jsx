import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineDocumentText, HiOutlineUpload, HiOutlineRefresh, HiOutlineTrash } from 'react-icons/hi';
import { companion } from '../services/featureService';

const card = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 };
const muted = { color: '#a6adc8', fontSize: '0.85rem' };
const errText = (e) => (e && e.message) || 'Something went wrong';
const STATUS = { uploaded: ['Uploaded', '#89b4fa'], processing: ['Processing…', '#f9e2af'], indexed: ['Indexed', '#a6e3a1'], failed: ['Failed', '#f38ba8'] };
const size = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function CompanionFiles() {
    const [files, setFiles] = useState(null);
    const [busy, setBusy] = useState(false);
    const [notInstalled, setNotInstalled] = useState(false);
    const input = useRef(null);
    const kindRef = useRef('companion_pdf'); // which button opened the file picker
    const pickFor = (kind) => { kindRef.current = kind; if (input.current) input.current.click(); };

    const load = useCallback(async () => {
        try { setFiles((await companion.list()).files); setNotInstalled(false); }
        catch (e) { if (/not installed|migration/i.test(errText(e))) setNotInstalled(true); else toast.error(errText(e)); setFiles((f) => f || []); }
    }, []);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { // follow processing until it finishes
        if (!files || !files.some((f) => f.status === 'uploaded' || f.status === 'processing')) return undefined;
        const t = setInterval(load, 2500); return () => clearInterval(t);
    }, [files, load]);

    async function onPick(e) {
        const file = e.target.files && e.target.files[0]; e.target.value = '';
        if (!file) return;
        if (!/\.pdf$/i.test(file.name)) return toast.error('Choose a PDF file.');
        if (file.size > 30 * 1024 * 1024) return toast.error('The file is larger than 30 MB.');
        setBusy(true);
        const kind = kindRef.current;
        try { await companion.upload(file, kind); toast.success(kind === 'book_pdf' ? 'Book PDF uploaded. It is now the book download.' : 'Uploaded. Reading and indexing the PDF…'); await load(); } catch (err) { toast.error(errText(err)); } finally { setBusy(false); }
    }
    const act = async (fn, msg) => { setBusy(true); try { await fn(); toast.success(msg); await load(); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); } };

    if (notInstalled) return <div className="page"><div className="empty-state"><h3>Companion files are not installed yet</h3><p>The database migration has not been applied. Contact the developer.</p></div></div>;
    if (!files) return <div className="page-loading"><div className="spinner" /></div>;
    const current = files.find((f) => f.isCurrent && f.kind !== 'book_pdf');
    const currentBook = files.find((f) => f.isCurrent && f.kind === 'book_pdf');

    return (
        <div className="page" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }} data-testid="companion-page">
            <div className="page__header"><div><h1 className="page__title"><HiOutlineDocumentText style={{ verticalAlign: '-3px', color: '#d4af37' }} /> Digital Companion files</h1>
                <p className="page__subtitle">Digital Companion customers can download two PDFs. The <b>Companion Pack</b> is read and indexed for Ask SID. The <b>Book PDF</b> is download-only: Ask SID does not read it (it reads the book from Online Reading). A new version only replaces what customers download after it is ready. Only Digital Companion customers can download these files.</p></div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><input ref={input} type="file" accept="application/pdf,.pdf" onChange={onPick} style={{ display: 'none' }} data-testid="file-input" />
                    <button className="btn btn--primary" onClick={() => pickFor('companion_pdf')} disabled={busy} data-testid="upload-btn"><HiOutlineUpload /> Upload Companion Pack</button>
                    <button className="btn btn--outline" onClick={() => pickFor('book_pdf')} disabled={busy} data-testid="upload-book-btn"><HiOutlineUpload /> Upload Book PDF</button></div></div>

            <div style={{ ...card, marginBottom: 16 }}>
                <b style={{ color: '#fff' }}>Current downloads for customers</b>
                <div style={muted} data-testid="current-file"><b>Companion Pack:</b> {current ? `Version ${current.version} — ${current.originalName} (${size(current.sizeBytes)}), ${current.chunkCount} passages indexed` : 'No Companion file has been uploaded through this page. Customers still receive the file configured under Digital Products.'}</div>
                <div style={muted} data-testid="current-book"><b>Book PDF:</b> {currentBook ? `Version ${currentBook.version} — ${currentBook.originalName} (${size(currentBook.sizeBytes)})` : 'No book PDF uploaded. Customers see only the Companion Pack.'}</div>
            </div>

            <div className="table-wrapper"><table className="data-table" data-testid="files-table"><thead><tr><th>Version</th><th>Type</th><th>File</th><th>Size</th><th>Status</th><th>Passages</th><th>Uploaded</th><th /></tr></thead><tbody>
                {files.map((f) => { const [label, color] = STATUS[f.status] || [f.status, '#ccc']; return (
                    <tr key={f.id} data-testid={`file-${f.kind === 'book_pdf' ? 'book-' : ''}${f.version}`}>
                        <td>v{f.version} {f.isCurrent && <span style={{ color: '#d4af37', fontWeight: 700 }}>● current</span>}</td><td>{f.kind === 'book_pdf' ? 'Book PDF' : 'Companion Pack'}</td><td>{f.originalName}</td><td>{size(f.sizeBytes)}</td>
                        <td><span style={{ color, fontWeight: 700 }}>{label}</span>{f.status === 'failed' && <div style={{ color: '#f38ba8', fontSize: '0.8rem', maxWidth: 320 }}>{f.errorMessage} <span style={muted}>(attempt {f.attempts})</span></div>}</td>
                        <td>{f.kind === 'book_pdf' ? 'download only' : f.chunkCount}</td><td>{new Date(f.createdAt).toISOString().slice(0, 10)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                            {f.kind !== 'book_pdf' && (f.status === 'failed' || f.status === 'indexed') && <button className="btn btn--outline btn--sm" disabled={busy} onClick={() => act(() => companion.retry(f.id), 'Processing again…')}><HiOutlineRefresh /> {f.status === 'failed' ? 'Retry' : 'Re-index'}</button>}{' '}
                            {f.status === 'indexed' && !f.isCurrent && <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => act(() => companion.makeCurrent(f.id), 'This version is now the download')}>Make current</button>}{' '}
                            {f.status !== 'processing' && <button className="btn btn--outline btn--sm" style={{ color: '#f38ba8', borderColor: 'rgba(243,139,168,0.5)' }} disabled={busy} title="Delete this file" data-testid={`delete-${f.version}`}
                                onClick={() => {
                                    const others = files.some((x) => x.id !== f.id && x.status === 'indexed' && (x.kind || 'companion_pdf') === (f.kind || 'companion_pdf'));
                                    const warn = f.isCurrent ? (others ? ' This is the current download: the newest other indexed version will become the download.' : ' This is the current download and the only indexed file: customers will not be able to download the Companion until you upload a new PDF.') : '';
                                    if (window.confirm(`Delete version ${f.version} (${f.originalName})? The file and its indexed passages will be removed. This cannot be undone.${warn}`)) act(() => companion.remove(f.id), 'File deleted');
                                }}><HiOutlineTrash /> Delete</button>}
                        </td>
                    </tr>); })}
                {files.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', ...muted }}>No files uploaded yet.</td></tr>}
            </tbody></table></div>
            <p style={muted}>Tip: use a text-based PDF with headings such as “Chapter 3 …”. Ask SID quotes chapters and concepts from it; a scanned (image-only) PDF cannot be indexed. An old version stays stored, so you can go back to it with “Make current”.</p>
        </div>
    );
}
