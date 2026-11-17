import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import toast from 'react-hot-toast';
import { HiOutlineBookOpen, HiOutlinePlus, HiOutlineEye, HiOutlineTrash, HiOutlineArrowUp, HiOutlineArrowDown, HiOutlineSave } from 'react-icons/hi';
import RichTextEditor from '../components/Blog/RichTextEditor';
import { reading } from '../services/featureService';

const card = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 18 };
const muted = { color: '#a6adc8', fontSize: '0.85rem' };
const STATUS = { draft: ['Draft', '#f9e2af'], published: ['Published', '#a6e3a1'], unpublished: ['Unpublished', '#f38ba8'] };
const Badge = ({ status }) => { const [label, color] = STATUS[status] || [status, '#ccc']; return <span data-testid={`badge-${status}`} style={{ fontSize: '0.72rem', fontWeight: 700, color, border: `1px solid ${color}55`, borderRadius: 20, padding: '2px 10px' }}>{label}</span>; };
const errText = (e) => (e && e.message) || 'Something went wrong';

function ConfirmModal({ title, body, confirmLabel, danger, onCancel, onConfirm, requireText }) {
    const [typed, setTyped] = useState('');
    return (
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal" style={{ maxWidth: 480 }}>
                <div className="modal__header"><h2>{title}</h2></div>
                <div className="modal__body">
                    <p style={{ ...muted, margin: '0 0 14px', lineHeight: 1.55 }}>{body}</p>
                    {requireText && <input className="form-input" aria-label="Type to confirm" placeholder={`Type: ${requireText}`} value={typed} onChange={(e) => setTyped(e.target.value)} />}
                    <div className="form-actions" style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn--outline" onClick={onCancel}>Cancel</button>
                        <button type="button" className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} disabled={requireText ? typed !== requireText : false} onClick={onConfirm}>{confirmLabel}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PreviewModal({ chapter, onClose }) {
    const html = useMemo(() => DOMPurify.sanitize(chapter.content_html || '', { USE_PROFILES: { html: true } }), [chapter.content_html]);
    const published = chapter.status === 'published';
    return (
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal" style={{ maxWidth: 900, maxHeight: '92vh', overflow: 'auto' }}>
                <div className="modal__header"><h2>Preview</h2><button className="modal__close" onClick={onClose} aria-label="Close preview">×</button></div>
                <div className="modal__body">
                    <p style={{ ...muted, background: 'rgba(249,226,175,0.08)', border: '1px solid rgba(249,226,175,0.25)', padding: '10px 14px', borderRadius: 8, margin: '0 0 18px', lineHeight: 1.5 }}>
                        This is how the chapter will look to readers. Status: <b>{chapter.status}</b>{published ? '.' : ' — customers cannot see it yet.'}
                    </p>
                    <article className="reading-preview-paper" data-testid="preview-paper">
                        <h1 className="rp-title">{chapter.title}</h1>
                        <div className="rp-content" data-testid="preview-body" dangerouslySetInnerHTML={{ __html: html }} />
                    </article>
                </div>
            </div>
        </div>
    );
}

export default function ReadingContent() {
    const [books, setBooks] = useState([]);
    const [bookId, setBookId] = useState(null);
    const [chapters, setChapters] = useState([]);
    const [chapter, setChapter] = useState(null);       // the chapter open in the editor (full record)
    const [draft, setDraft] = useState({ title: '', html: '' });
    const [dirty, setDirty] = useState(false);
    const [htmlMode, setHtmlMode] = useState(false);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [dialog, setDialog] = useState(null);
    const [preview, setPreview] = useState(false);
    const [notInstalled, setNotInstalled] = useState(false);

    const book = books.find((b) => b.id === bookId) || null;
    const docxInput = useRef(null);

    const loadBooks = useCallback(async (keep) => {
        try {
            const { books: list } = await reading.listBooks();
            setBooks(list); setNotInstalled(false);
            setBookId((cur) => keep || cur || (list[0] && list[0].id) || null);
        } catch (e) { if (/not installed|migration/i.test(errText(e))) setNotInstalled(true); else toast.error(errText(e)); }
        finally { setLoading(false); }
    }, []);
    const loadChapters = useCallback(async (id) => { if (!id) return setChapters([]); try { setChapters((await reading.listChapters(id)).chapters); } catch (e) { toast.error(errText(e)); } }, []);

    const [sid, setSid] = useState(null);
    const loadSid = useCallback(async () => { try { setSid(await reading.askSidStatus()); } catch { setSid(null); } }, []);
    useEffect(() => { loadSid(); }, [loadSid, books, chapters]);
    async function reindexAll() {
        setBusy(true);
        try { const r = await reading.reindex(); if (r.problems && r.problems.length) toast.error(r.problems[0]); else toast.success(`Ask SID re-read the published chapters (${r.passages} passages).`); await loadSid(); }
        catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
    }

    useEffect(() => { loadBooks(); }, [loadBooks]);
    useEffect(() => { setChapter(null); setDirty(false); loadChapters(bookId); }, [bookId, loadChapters]);

    async function openChapter(id) {
        if (dirty && !window.confirm('You have unsaved changes in this chapter. Discard them?')) return;
        try { const { chapter: c } = await reading.getChapter(id); setChapter(c); setDraft({ title: c.title, html: c.content_html || '' }); setDirty(false); setHtmlMode(false); }
        catch (e) { toast.error(errText(e)); }
    }
    async function run(fn, okMsg) { setBusy(true); try { const r = await fn(); if (okMsg) toast.success(okMsg); return r; } catch (e) { toast.error(errText(e)); return null; } finally { setBusy(false); } }

    async function saveChapter() {
        if (!chapter) return null;
        const r = await run(() => reading.updateChapter(chapter.id, { title: draft.title, content_html: draft.html, expectedVersion: chapter.version }), 'Saved');
        if (r) { setChapter(r.chapter); setDraft({ title: r.chapter.title, html: r.chapter.content_html }); setDirty(false); loadChapters(bookId); loadBooks(bookId); }
        return r;
    }
    async function setStatus(publish) {
        if (dirty) { const s = await saveChapter(); if (!s) return; }
        const r = await run(() => (publish ? reading.publishChapter(chapter.id) : reading.unpublishChapter(chapter.id)), publish ? 'Published' : 'Unpublished');
        if (r) { setChapter({ ...chapter, ...r.chapter }); if (r.note) toast(r.note, { icon: 'ℹ️' }); loadChapters(bookId); loadBooks(bookId); }
    }
    async function move(index, delta) {
        const ids = chapters.map((c) => c.id); const j = index + delta; if (j < 0 || j >= ids.length) return;
        [ids[index], ids[j]] = [ids[j], ids[index]];
        const r = await run(() => reading.reorder(bookId, ids), 'Order saved'); if (r) loadChapters(bookId);
    }
    async function addChapter() {
        const title = window.prompt('Chapter title');
        if (!title || !title.trim()) return;
        const r = await run(() => reading.createChapter(bookId, { title: title.trim(), content_html: '' }), 'Chapter created');
        if (r) { await loadChapters(bookId); loadBooks(bookId); openChapter(r.chapter.id); }
    }
    async function addBook() {
        const title = window.prompt('Book title');
        if (!title || !title.trim()) return;
        const r = await run(() => reading.createBook({ title: title.trim() }), 'Book created');
        if (r) { await loadBooks(r.book.id); }
    }
    async function toggleBook() {
        const next = book.status === 'published' ? 'unpublished' : 'published';
        const r = await run(() => reading.updateBook(book.id, { status: next }), next === 'published' ? 'Book is now visible to readers' : 'Book hidden from readers');
        if (r) loadBooks(book.id);
    }
    async function importWord(e) {
        const file = e.target.files && e.target.files[0]; e.target.value = '';
        if (!file || !book) return;
        if (!/\.docx$/i.test(file.name)) return toast.error('Choose a Word (.docx) file.');
        setBusy(true);
        try {
            const dry = await reading.importDocx(book.id, file, true);
            const list = dry.chapters.map((c, i) => `${i + 1}. ${c.title} (${c.words} words)`).join('\n');
            if (!window.confirm(`This will add ${dry.chapters.length} DRAFT chapter(s) to "${book.title}". Nothing is published.\n\n${list}\n\nContinue?`)) return;
            const done = await reading.importDocx(book.id, file, false);
            toast.success(`${done.created} draft chapter(s) created. Review them, then publish.`);
            await loadChapters(book.id); loadBooks(book.id);
        } catch (err) { toast.error(errText(err)); } finally { setBusy(false); }
    }
    // Chapters imported earlier: paragraphs that were turned into headings (long sentences, Heading 4-6) go back to normal text.
    async function repairHeadings() {
        if (!book) return;
        setBusy(true);
        try {
            const dry = await reading.repairHeadings(book.id, { apply: false });
            if (!dry.total) { toast.success('Nothing to fix: no normal paragraph is formatted as a heading.'); return; }
            const list = dry.chapters.map((c) => `• ${c.title}: ${c.demoted} change(s)\n${(c.samples || []).map((s) => `     "${s.text}" (H${s.level})`).join('\n')}`).join('\n');
            if (!window.confirm(`${dry.chaptersChecked} chapter(s) checked. ${dry.total} paragraph(s) in ${dry.chapters.length} chapter(s) are formatted as headings but look like normal text (a long sentence, or Heading 4-6). Tables, pictures, boxes and all other text are NOT touched.\n\n${list}\n\nChange these back to normal paragraphs? A copy of every changed chapter is saved first, and "Undo last fix" puts it all back. Published chapters change for readers straight away.`)) return;
            const r = await reading.repairHeadings(book.id, { apply: true, reason: 'Repair: paragraphs wrongly converted to headings by the Word import' });
            toast.success(`${r.paragraphs} paragraph(s) in ${r.repaired} chapter(s) are normal text again. You can undo this with "Undo last fix".`);
            await loadChapters(book.id);
        } catch (err) { toast.error(errText(err)); } finally { setBusy(false); }
    }
    async function undoRepairHeadings() {
        if (!book) return;
        setBusy(true);
        try {
            const dry = await reading.undoRepairHeadings(book.id, { apply: false });
            const list = dry.chapters.map((c) => `• ${c.title}${c.restore ? '' : ` (left as it is: ${c.why})`}`).join('\n');
            if (!window.confirm(`Put ${dry.willRestore} chapter(s) back exactly as they were before the last "Fix headings"?\n\n${list}`)) return;
            const r = await reading.undoRepairHeadings(book.id, { apply: true, reason: 'Undo of the last Fix headings' });
            toast.success(`${r.restored} chapter(s) restored${r.skipped ? `, ${r.skipped} left as they are` : ''}.`);
            await loadChapters(book.id);
        } catch (err) { toast.error(errText(err)); } finally { setBusy(false); }
    }
    async function editBook() {
        const title = window.prompt('Book title', book.title); if (!title) return;
        const subtitle = window.prompt('Subtitle (optional)', book.subtitle || '') ?? book.subtitle;
        const description = window.prompt('Short description (optional)', book.description || '') ?? book.description;
        const r = await run(() => reading.updateBook(book.id, { title, subtitle, description }), 'Book updated'); if (r) loadBooks(book.id);
    }

    if (loading) return <div className="page-loading"><div className="spinner" /></div>;
    if (notInstalled) return <div className="page"><div className="empty-state"><h3>Online Reading is not installed yet</h3><p>The database migration for the reading tables has not been applied. Contact the developer.</p></div></div>;

    return (
        <div className="page" style={{ maxWidth: 1640, margin: '0 auto', padding: '24px 20px' }} data-testid="reading-page">
            <div className="page__header">
                <div><h1 className="page__title"><HiOutlineBookOpen style={{ verticalAlign: '-3px', color: '#d4af37' }} /> Online Reading</h1>
                    <p className="page__subtitle">Write and publish the chapters that Online Reading customers can read. Only published chapters of published books are visible to customers; changes appear immediately.</p></div>
                <button className="btn btn--primary" onClick={addBook} disabled={busy}><HiOutlinePlus /> New book</button>
            </div>

            {sid && (
                <div style={{ ...card, marginBottom: 16, borderColor: sid.usingBook ? 'rgba(166,227,161,0.35)' : 'rgba(249,226,175,0.45)' }} data-testid="asksid-status">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div>
                            <b style={{ color: '#fff' }}>Ask SID is reading: </b>
                            <b style={{ color: sid.usingBook ? '#a6e3a1' : '#f9e2af' }}>{sid.usingBook ? `your book (${sid.passages} passages)` : 'no book yet — it still uses the OLD built-in knowledge'}</b>
                            <div style={{ ...muted, marginTop: 4 }}>
                                {sid.books.length === 0 ? 'No book exists.' : sid.books.map((b) => `${b.title}: ${b.status === 'published' ? 'published' : 'NOT published'}, ${b.publishedChapters} of ${b.chapters} chapters published, ${b.passages} passages`).join(' · ')}
                            </div>
                            {!sid.usingBook && <div style={{ ...muted, marginTop: 4 }}>Ask SID switches to the book once the book AND at least one of its chapters are published.</div>}
                            {sid.otherPassages > 0 && <div style={{ ...muted, marginTop: 4, color: '#f9e2af' }}>{sid.otherPassages} older passages are not linked to any chapter (left from an earlier setup). Re-index removes none of them; ask the developer to clear them if answers show text that is not in your book.</div>}
                        </div>
                        <button className="btn btn--outline btn--sm" disabled={busy} onClick={reindexAll} data-testid="reindex-btn">Re-read all published chapters</button>
                    </div>
                </div>
            )}

            {books.length === 0 ? <div className="empty-state"><h3>No books yet</h3><p>Create your first book, then add chapters.</p></div> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 20, alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} data-testid="reading-left">
                    <aside style={card} aria-label="Books">
                        {books.map((b) => (
                            <button key={b.id} type="button" onClick={() => setBookId(b.id)} data-testid={`book-${b.slug}`}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: 10, marginBottom: 8, borderRadius: 8, cursor: 'pointer', color: '#fff', background: b.id === bookId ? 'rgba(212,175,55,0.15)' : 'transparent', border: `1px solid ${b.id === bookId ? '#d4af37' : 'rgba(255,255,255,0.08)'}` }}>
                                <div style={{ fontWeight: 600 }}>{b.title}</div>
                                <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}><Badge status={b.status} /><span style={muted}>{b.chapterCounts.published}/{b.chapterCounts.published + b.chapterCounts.draft + b.chapterCounts.unpublished} published</span></div>
                            </button>
                        ))}
                    </aside>
                    {book && (
<div style={card}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><b style={{ color: '#fff' }}>Chapters</b><button className="btn btn--primary btn--sm" onClick={addChapter} disabled={busy} data-testid="add-chapter"><HiOutlinePlus /> Add</button></div>
                                    <div style={{ maxHeight: 'calc(100vh - 330px)', minHeight: 140, overflowY: 'auto', paddingRight: 4 }} data-testid="chapter-list">
{chapters.length === 0 && <p style={muted}>No chapters yet.</p>}
                                    {chapters.map((c, i) => (
                                        <div key={c.id} data-testid={`chapter-row-${c.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 6px', borderRadius: 8, background: chapter && chapter.id === c.id ? 'rgba(212,175,55,0.12)' : 'transparent' }}>
                                            <span style={{ ...muted, width: 22 }}>{i + 1}</span>
                                            <button type="button" onClick={() => openChapter(c.id)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 0, color: '#fff', cursor: 'pointer' }}>{c.title}<div><Badge status={c.status} /></div></button>
                                            <button className="btn btn--ghost btn--sm" aria-label={`Move ${c.title} up`} disabled={busy || i === 0} onClick={() => move(i, -1)}><HiOutlineArrowUp /></button>
                                            <button className="btn btn--ghost btn--sm" aria-label={`Move ${c.title} down`} disabled={busy || i === chapters.length - 1} onClick={() => move(i, 1)}><HiOutlineArrowDown /></button>
                                        </div>
                                    ))}
</div>
                                </div>
                    )}
                </div>

                    {book && (
                        <section>
                            <div style={{ ...card, marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                                <div><h2 style={{ margin: 0, color: '#fff' }}>{book.title}</h2><div style={muted}>{book.subtitle || 'No subtitle'} · <Badge status={book.status} /></div></div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <input ref={docxInput} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={importWord} style={{ display: 'none' }} data-testid="docx-input" />
                                    <button className="btn btn--outline btn--sm" onClick={() => docxInput.current && docxInput.current.click()} disabled={busy} data-testid="import-docx">Import from Word</button>
                                    <button className="btn btn--outline btn--sm" onClick={repairHeadings} disabled={busy} data-testid="repair-headings" title="Turns paragraphs that were wrongly made into headings back into normal text">Fix headings</button>
                                    <button className="btn btn--outline btn--sm" onClick={undoRepairHeadings} disabled={busy} data-testid="undo-repair-headings" title="Puts the chapters back exactly as they were before the last Fix headings">Undo last fix</button>
                                    <button className="btn btn--outline btn--sm" onClick={editBook} disabled={busy}>Edit details</button>
                                    <button className="btn btn--outline btn--sm" onClick={toggleBook} disabled={busy} data-testid="toggle-book">{book.status === 'published' ? 'Unpublish book' : 'Publish book'}</button>
                                    <button className="btn btn--danger btn--sm" onClick={() => setDialog({ kind: 'deleteBook' })} disabled={busy || book.status === 'published'} title={book.status === 'published' ? 'Unpublish the book first' : ''}><HiOutlineTrash /> Delete</button>
                                </div>
                            </div>

                            <div>
                                <div style={card} className="reading-editor" data-testid="chapter-editor">
                                    {!chapter ? <p style={muted}>Select a chapter to edit it, or add a new one.</p> : (
                                        <>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                                                <input className="form-input" aria-label="Chapter title" value={draft.title} onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setDirty(true); }} style={{ flex: 1, fontSize: '1.1rem', fontWeight: 600 }} />
                                                <Badge status={chapter.status} />
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                                <button className="btn btn--ghost btn--sm" onClick={() => { if (htmlMode || window.confirm('The visual editor removes elements it does not support, such as tables. Switch to it only if the chapter has none. Continue?')) setHtmlMode(!htmlMode); }} data-testid="toggle-html">{htmlMode ? 'Back to visual editor' : 'Edit HTML (tables, advanced)'}</button>
                                            </div>
                                            {htmlMode
                                                ? <textarea className="form-textarea" aria-label="Chapter HTML" rows={30} value={draft.html} onChange={(e) => { setDraft({ ...draft, html: e.target.value }); setDirty(true); }} style={{ fontFamily: 'monospace', width: '100%' }} />
                                                : <RichTextEditor tables key={`${chapter.id}-${chapter.version}`} content={draft.html} placeholder="Write the chapter here…" onChange={(h) => { setDraft((d) => (d.html === h ? d : { ...d, html: h })); setDirty(true); }} />}
                                            <div className="form-actions" style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                <button className="btn btn--primary" onClick={saveChapter} disabled={busy || !dirty} data-testid="save-chapter"><HiOutlineSave /> Save draft</button>
                                                <button className="btn btn--outline" onClick={() => setPreview(true)} data-testid="preview-chapter"><HiOutlineEye /> Preview</button>
                                                {chapter.status === 'published'
                                                    ? <button className="btn btn--outline" onClick={() => setStatus(false)} disabled={busy} data-testid="unpublish-chapter">Unpublish</button>
                                                    : <button className="btn btn--primary" onClick={() => setStatus(true)} disabled={busy} data-testid="publish-chapter">Publish</button>}
                                                <button className="btn btn--danger" onClick={() => setDialog({ kind: 'deleteChapter' })} disabled={busy} data-testid="delete-chapter"><HiOutlineTrash /> Delete</button>
                                            </div>
                                            {dirty && <p style={{ color: '#f9e2af', fontSize: '0.8rem' }}>Unsaved changes</p>}
                                        </>
                                    )}
                                </div>
                            </div>
                        </section>
                    )}
                </div>
            )}

            {preview && chapter && <PreviewModal chapter={{ ...chapter, title: draft.title, content_html: draft.html }} onClose={() => setPreview(false)} />}
            {dialog && dialog.kind === 'deleteChapter' && chapter && (
                <ConfirmModal title="Delete this chapter?" body={`"${chapter.title}" will be permanently deleted. Readers lose it immediately. This cannot be undone.`} confirmLabel="Delete chapter" danger onCancel={() => setDialog(null)}
                    onConfirm={async () => { const r = await run(() => reading.deleteChapter(chapter.id), 'Chapter deleted'); setDialog(null); if (r) { setChapter(null); setDirty(false); loadChapters(bookId); loadBooks(bookId); } }} />
            )}
            {dialog && dialog.kind === 'deleteBook' && book && (
                <ConfirmModal title="Delete this book?" body="The book and ALL of its chapters will be permanently deleted." requireText={book.title} confirmLabel="Delete book" danger onCancel={() => setDialog(null)}
                    onConfirm={async () => { const r = await run(() => reading.deleteBook(book.id, book.title), 'Book deleted'); setDialog(null); if (r) { setBookId(null); loadBooks(); } }} />
            )}
        </div>
    );
}
