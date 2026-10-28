import React, { useState, useRef } from 'react';
import { inspectZipArchive, commitZipImportBatch } from '../../services/blogService';
import RichTextEditor from './RichTextEditor';
import toast from 'react-hot-toast';

const REFERENCE_CATEGORIES = [
    'SID Philosophy',
    'Marketing Reclassified',
    'Business Strategy & Growth',
    'Leadership & Governance',
    'AI & Human Thinking',
    'Higher Education & Learning',
    'Innovation & Entrepreneurship',
    'Business Insights',
    'Books & Publications'
];

export default function ZipImporterModal({
    isOpen,
    onClose,
    onImportComplete,
    onLoadIntoEditor, // optional: if provided, allows loading an article into current BlogForm
    isInsideEditor = false
}) {
    const fileInputRef = useRef(null);
    const [file, setFile] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progressStatus, setProgressStatus] = useState('');

    // Staged articles from inspection
    const [summary, setSummary] = useState(null);
    const [articles, setArticles] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Filters
    const [filterTab, setFilterTab] = useState('all'); // 'all', 'ready', 'conflicts', 'missing-images', 'selected'
    const [searchQuery, setSearchQuery] = useState('');

    // In-modal editor for a specific staged article
    const [editingArticleIndex, setEditingArticleIndex] = useState(null);
    const [articleInEditor, setArticleInEditor] = useState(null);

    // Committing / Batch Import State
    const [committing, setCommitting] = useState(false);
    const [commitProgress, setCommitProgress] = useState({ currentBatch: 0, totalBatches: 0, percent: 0, processedCount: 0 });
    const [importReport, setImportReport] = useState(null);

    const handleFileSelect = (selectedFile) => {
        if (!selectedFile) return;

        const isZip = selectedFile.name.toLowerCase().endsWith('.zip') ||
            selectedFile.type === 'application/zip' ||
            selectedFile.type === 'application/x-zip-compressed';

        if (!isZip) {
            toast.error('Please upload a valid ZIP archive (.zip)');
            return;
        }

        if (selectedFile.size > 60 * 1024 * 1024) {
            toast.error('ZIP file size exceeds 60MB limit');
            return;
        }

        setFile(selectedFile);
        processZipInspection(selectedFile);
    };

    const processZipInspection = async (zipFile) => {
        setUploading(true);
        setProgressStatus('Uploading archive and inspecting documents & images on server...');
        setSummary(null);
        setArticles([]);
        setImportReport(null);

        try {
            const data = await inspectZipArchive(zipFile);
            if (!data.success) {
                throw new Error(data.error || 'Inspection failed');
            }

            setSummary(data.summary);
            setArticles(data.articles || []);

            // By default, select all non-conflicting articles or all articles
            const initSelected = new Set();
            (data.articles || []).forEach((art, idx) => {
                // If it's not a collision, select by default
                if (!art.hasConflict) {
                    initSelected.add(art.tempId || idx);
                }
            });
            setSelectedIds(initSelected);

            toast.success(`Detected ${data.articles?.length || 0} articles in ZIP!`);
        } catch (err) {
            console.error('ZIP inspection error:', err);
            toast.error(err.message || 'Failed to inspect ZIP archive');
        } finally {
            setUploading(false);
            setProgressStatus('');
        }
    };

    const handleClose = () => {
        if (committing) {
            if (!window.confirm('Import is currently processing. Are you sure you want to close?')) {
                return;
            }
        }
        setFile(null);
        setSummary(null);
        setArticles([]);
        setSelectedIds(new Set());
        setImportReport(null);
        setEditingArticleIndex(null);
        setArticleInEditor(null);
        onClose();
    };

    // Article selection toggles
    const toggleSelectArticle = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredArticles.length && filteredArticles.length > 0) {
            setSelectedIds(new Set());
        } else {
            const next = new Set();
            filteredArticles.forEach(a => next.add(a.tempId));
            setSelectedIds(next);
        }
    };

    // Bulk action: Set status for all selected
    const handleBulkStatusChange = (newStatus) => {
        setArticles(prev => prev.map(art => {
            if (selectedIds.has(art.tempId)) {
                return { ...art, status: newStatus };
            }
            return art;
        }));
        toast.success(`Updated status to "${newStatus}" for selected articles`);
    };

    // Bulk action: Set category for all selected
    const handleBulkCategoryChange = (newCat) => {
        if (!newCat) return;
        setArticles(prev => prev.map(art => {
            if (selectedIds.has(art.tempId)) {
                return { ...art, topic: newCat };
            }
            return art;
        }));
        toast.success(`Updated category to "${newCat}" for selected articles`);
    };

    // Update single article field inline
    const updateArticleField = (tempId, field, value) => {
        setArticles(prev => prev.map(art => {
            if (art.tempId === tempId) {
                return { ...art, [field]: value };
            }
            return art;
        }));
    };

    // Open article in in-modal rich text editor
    const handleOpenEditor = (article, index) => {
        setEditingArticleIndex(index);
        setArticleInEditor({ ...article });
    };

    // Save changes from in-modal editor back to staging list
    const handleSaveEditorChanges = () => {
        if (!articleInEditor) return;
        setArticles(prev => prev.map((art, idx) => {
            if (idx === editingArticleIndex) {
                return { ...articleInEditor };
            }
            return art;
        }));
        toast.success('Staged article updated');
        setEditingArticleIndex(null);
        setArticleInEditor(null);
    };

    // Load single article into parent BlogForm editor (if launched from inside BlogForm)
    const handleLoadArticleIntoParentForm = (article) => {
        if (onLoadIntoEditor) {
            onLoadIntoEditor(article);
            toast.success(`"${article.title}" loaded into editor`);
            handleClose();
        }
    };

    // Filtered articles computed directly on each render (avoids hook ordering issues and memoization overhead on small list)
    const filteredArticles = (articles || []).filter(art => {
        // Tab filter
        if (filterTab === 'ready' && art.hasConflict) return false;
        if (filterTab === 'conflicts' && !art.hasConflict) return false;
        if (filterTab === 'missing-images' && art.image_status !== 'missing') return false;
        if (filterTab === 'selected' && !selectedIds.has(art.tempId)) return false;

        // Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const titleMatch = (art.title || '').toLowerCase().includes(q);
            const slugMatch = (art.slug || '').toLowerCase().includes(q);
            const catMatch = (art.topic || '').toLowerCase().includes(q);
            if (!titleMatch && !slugMatch && !catMatch) return false;
        }

        return true;
    });

    // Batch commit workflow
    const handleCommitImport = async () => {
        const articlesToCommit = articles.filter(art => selectedIds.has(art.tempId));

        if (articlesToCommit.length === 0) {
            toast.error('Please select at least one article to import');
            return;
        }

        // Safety check for conflicts with overwrite
        const unconfirmedOverwrites = articlesToCommit.filter(
            art => art.hasConflict && art.conflictAction === 'overwrite' && !art.overwriteConfirmed
        );
        if (unconfirmedOverwrites.length > 0) {
            toast.error(`Please check the confirmation box for article "${unconfirmedOverwrites[0].title}" or choose to Skip / Rename.`);
            return;
        }

        setCommitting(true);
        const BATCH_SIZE = 8; // Process 8 articles per batch to prevent timeouts
        const totalBatches = Math.ceil(articlesToCommit.length / BATCH_SIZE);

        let allSaved = [];
        let allSkipped = [];
        let allFailed = [];

        try {
            for (let b = 0; b < totalBatches; b++) {
                const start = b * BATCH_SIZE;
                const end = Math.min(start + BATCH_SIZE, articlesToCommit.length);
                const batchChunk = articlesToCommit.slice(start, end);

                setCommitProgress({
                    currentBatch: b + 1,
                    totalBatches,
                    percent: Math.round(((b) / totalBatches) * 100),
                    processedCount: start
                });

                const res = await commitZipImportBatch(batchChunk);

                if (res.batchResults) {
                    allSaved = allSaved.concat(res.batchResults.saved || []);
                    allSkipped = allSkipped.concat(res.batchResults.skipped || []);
                    allFailed = allFailed.concat(res.batchResults.failed || []);
                }
            }

            setCommitProgress({
                currentBatch: totalBatches,
                totalBatches,
                percent: 100,
                processedCount: articlesToCommit.length
            });

            const finalReport = {
                totalRequested: articlesToCommit.length,
                savedCount: allSaved.length,
                skippedCount: allSkipped.length,
                failedCount: allFailed.length,
                saved: allSaved,
                skipped: allSkipped,
                failed: allFailed,
            };

            setImportReport(finalReport);
            toast.success(`Import complete! ${allSaved.length} saved, ${allSkipped.length} skipped, ${allFailed.length} failed.`);

            if (onImportComplete) {
                onImportComplete(finalReport);
            }
        } catch (err) {
            console.error('Batch commit error:', err);
            toast.error(err.message || 'Batch commit failed');
        } finally {
            setCommitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(8px)',
                zIndex: 999999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
            }}
            onClick={handleClose}
        >
            <div
                style={{
                    background: 'var(--bg-secondary, #161625)',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                    borderRadius: '16px',
                    width: '100%',
                    maxWidth: editingArticleIndex !== null ? '1080px' : '1180px',
                    maxHeight: '94vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
                    overflow: 'hidden',
                    color: 'var(--text-primary, #e4e4ef)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* MODAL HEADER */}
                <div
                    style={{
                        padding: '18px 24px',
                        borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.02)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.6rem' }}>📦</span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#ffffff', fontWeight: '700' }}>
                                Import Articles from ZIP Archive
                            </h3>
                            <small style={{ color: 'var(--text-secondary, #8b8ba7)', fontSize: '0.85rem' }}>
                                Support for DOCX, HTML, TXT, Markdown, JSON & matched cover/inline images (Up to 35+ articles)
                            </small>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary, #8b8ba7)',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            padding: '4px 10px',
                            borderRadius: '6px',
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* MODAL BODY */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

                    {/* VIEW 1: UPLOAD & DROP ZONE (If no articles inspected yet) */}
                    {!summary && !uploading && !importReport && (
                        <div>
                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragOver(false);
                                    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
                                }}
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    border: `2px dashed ${dragOver ? 'var(--accent-primary, #fa8b8b)' : 'rgba(255,255,255,0.15)'}`,
                                    borderRadius: '14px',
                                    padding: '50px 20px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    background: dragOver ? 'rgba(250, 139, 139, 0.05)' : 'rgba(255,255,255,0.02)',
                                    transition: 'all 0.2s ease',
                                    marginBottom: '20px'
                                }}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept=".zip,application/zip,application/x-zip-compressed"
                                    onChange={(e) => handleFileSelect(e.target.files?.[0])}
                                />
                                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🗂️</div>
                                <h4 style={{ margin: '0 0 8px', fontSize: '1.15rem', color: '#ffffff' }}>
                                    Select or Drag & Drop a ZIP Archive
                                </h4>
                                <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Upload single or bulk article collections (DOCX, HTML, TXT, JSON with images)
                                </p>
                                <span
                                    className="btn btn--primary"
                                    style={{ display: 'inline-block', padding: '8px 20px', pointerEvents: 'none' }}
                                >
                                    Browse ZIP File
                                </span>
                            </div>

                            {/* Format Guide */}
                            <div style={{ background: 'var(--bg-card, rgba(22,22,37,0.8))', padding: '16px 20px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                <h5 style={{ margin: '0 0 10px', color: 'var(--accent-primary, #fa8b8b)', fontSize: '0.95rem' }}>
                                    💡 Supported ZIP Formats:
                                </h5>
                                <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                                    <li><strong>Manifest-driven:</strong> A <code>manifest.json</code> listing articles, documents, cover images, titles, and SEO metadata.</li>
                                    <li><strong>Folder per Article:</strong> Subfolders containing the article document (<code>.docx</code>, <code>.html</code>, <code>.txt</code>) and associated <code>cover.jpg</code> or inline images.</li>
                                    <li><strong>Consistent Filename Pairing:</strong> e.g., <code>01-future-of-marketing.docx</code> and <code>01-future-of-marketing.jpg</code>.</li>
                                    <li><strong>Safe & Preserved:</strong> Existing database articles (such as manually added posts) are checked and protected by default.</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* VIEW 2: LOADING / EXTRACTING STATE */}
                    {uploading && (
                        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <div className="spinner" style={{ margin: '0 auto 20px', width: '40px', height: '40px' }} />
                            <h4 style={{ margin: '0 0 8px', color: '#ffffff' }}>Processing ZIP Archive...</h4>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                {progressStatus || 'Validating archive, extracting documents, uploading images to Supabase storage...'}
                            </p>
                        </div>
                    )}

                    {/* VIEW 3: IN-MODAL RICH TEXT EDITOR (When admin clicks "Edit" on a specific article) */}
                    {editingArticleIndex !== null && articleInEditor && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                                <div>
                                    <h4 style={{ margin: 0, color: 'var(--accent-primary, #fa8b8b)' }}>
                                        ✏️ Edit Staged Article #{editingArticleIndex + 1}
                                    </h4>
                                    <small style={{ color: 'var(--text-secondary)' }}>
                                        Source: {articleInEditor.sourceFile}
                                    </small>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {isInsideEditor && onLoadIntoEditor && (
                                        <button
                                            type="button"
                                            className="btn btn--outline btn--sm"
                                            onClick={() => handleLoadArticleIntoParentForm(articleInEditor)}
                                            style={{ borderColor: 'var(--info, #3b82f6)', color: 'var(--info, #3b82f6)' }}
                                        >
                                            📥 Load Into Main Form
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="btn btn--secondary btn--sm"
                                        onClick={() => { setEditingArticleIndex(null); setArticleInEditor(null); }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn--primary btn--sm"
                                        onClick={handleSaveEditorChanges}
                                    >
                                        💾 Apply Changes to Staging
                                    </button>
                                </div>
                            </div>

                            {/* Headline & Slug */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                                        Article Title / Headline *
                                    </label>
                                    <input
                                        type="text"
                                        value={articleInEditor.title}
                                        onChange={(e) => setArticleInEditor({ ...articleInEditor, title: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                                        URL Slug *
                                    </label>
                                    <input
                                        type="text"
                                        value={articleInEditor.slug}
                                        onChange={(e) => setArticleInEditor({ ...articleInEditor, slug: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }}
                                    />
                                </div>
                            </div>

                            {/* Category & Status */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                                        Category / Topic
                                    </label>
                                    <select
                                        value={articleInEditor.topic || 'SID Philosophy'}
                                        onChange={(e) => setArticleInEditor({ ...articleInEditor, topic: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }}
                                    >
                                        {REFERENCE_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                                        Publication Status
                                    </label>
                                    <select
                                        value={articleInEditor.status || 'draft'}
                                        onChange={(e) => setArticleInEditor({ ...articleInEditor, status: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }}
                                    >
                                        <option value="draft">Draft (Private)</option>
                                        <option value="scheduled">Scheduled</option>
                                        <option value="published">Published (Live)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                                        Cover Image
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {articleInEditor.image_url ? (
                                            <img
                                                src={articleInEditor.image_url}
                                                alt="Cover"
                                                style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                                            />
                                        ) : (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--warning, #f59e0b)' }}>⚠️ No cover image</span>
                                        )}
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                            {articleInEditor.image_status === 'matched' ? '✓ Image Matched' : 'Missing'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Standfirst / Summary */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                                    Standfirst / Editorial Summary
                                </label>
                                <textarea
                                    rows={2}
                                    value={articleInEditor.standfirst || articleInEditor.summary || ''}
                                    onChange={(e) => setArticleInEditor({ ...articleInEditor, standfirst: e.target.value, summary: e.target.value })}
                                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }}
                                />
                            </div>

                            {/* Rich Text Editor */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                                    Full Editorial Content (TipTap Editor)
                                </label>
                                <RichTextEditor
                                    content={articleInEditor.content}
                                    onChange={(html) => setArticleInEditor({ ...articleInEditor, content: html })}
                                    placeholder="Edit article text and formatting..."
                                />
                            </div>
                        </div>
                    )}

                    {/* VIEW 4: STAGING & REVIEW SCREEN (The main review screen) */}
                    {summary && editingArticleIndex === null && !importReport && (
                        <div>
                            {/* Top Summary Metrics Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                                <div style={{ background: 'var(--bg-card)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Detected</div>
                                    <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#ffffff' }}>{summary.totalArticles}</div>
                                </div>
                                <div style={{ background: 'var(--bg-card)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ready to Import</div>
                                    <div style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--success, #10b981)' }}>{summary.readyToImport}</div>
                                </div>
                                <div style={{ background: 'var(--bg-card)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Existing Conflicts</div>
                                    <div style={{ fontSize: '1.6rem', fontWeight: '700', color: summary.conflicts > 0 ? 'var(--warning, #f59e0b)' : 'var(--text-muted)' }}>
                                        {summary.conflicts}
                                    </div>
                                </div>
                                <div style={{ background: 'var(--bg-card)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Missing Cover Images</div>
                                    <div style={{ fontSize: '1.6rem', fontWeight: '700', color: summary.missingImages > 0 ? 'var(--warning, #f59e0b)' : 'var(--text-muted)' }}>
                                        {summary.missingImages}
                                    </div>
                                </div>
                            </div>

                            {/* Validation Warnings Alert (if any) */}
                            {summary.validationErrors && summary.validationErrors.length > 0 && (
                                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#fca5a5', fontSize: '0.85rem' }}>
                                    <strong>⚠️ Archive Validation Notices:</strong>
                                    <ul style={{ margin: '6px 0 0', paddingLeft: '20px' }}>
                                        {summary.validationErrors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Toolbar: Search, Filters & Bulk Operations */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                                {/* Filter Tabs */}
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {[
                                        { id: 'all', label: `All (${articles.length})` },
                                        { id: 'ready', label: `Ready (${articles.filter(a => !a.hasConflict).length})` },
                                        { id: 'conflicts', label: `Conflicts (${articles.filter(a => a.hasConflict).length})` },
                                        { id: 'missing-images', label: `No Cover (${articles.filter(a => a.image_status === 'missing').length})` },
                                        { id: 'selected', label: `Selected (${selectedIds.size})` },
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setFilterTab(tab.id)}
                                            style={{
                                                background: filterTab === tab.id ? 'var(--accent-primary, #fa8b8b)' : 'var(--bg-input)',
                                                color: filterTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
                                                border: '1px solid var(--border-color)',
                                                padding: '5px 12px',
                                                borderRadius: '6px',
                                                fontSize: '0.8rem',
                                                fontWeight: filterTab === tab.id ? '700' : '500',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Search Input */}
                                <div style={{ flex: '1 1 200px', maxWidth: '280px' }}>
                                    <input
                                        type="text"
                                        placeholder="🔍 Search detected articles..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{ width: '100%', padding: '7px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: '#fff', fontSize: '0.85rem' }}
                                    />
                                </div>
                            </div>

                            {/* Bulk Operations Bar */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px', marginBottom: '12px', fontSize: '0.85rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="checkbox"
                                        id="select-all-cb"
                                        checked={selectedIds.size > 0 && selectedIds.size === filteredArticles.length}
                                        onChange={toggleSelectAll}
                                        style={{ cursor: 'pointer' }}
                                    />
                                    <label htmlFor="select-all-cb" style={{ cursor: 'pointer', fontWeight: '600' }}>
                                        {selectedIds.size === filteredArticles.length ? 'Deselect All' : `Select All (${filteredArticles.length})`}
                                    </label>
                                    <span style={{ color: 'var(--text-muted)' }}>|</span>
                                    <span style={{ color: 'var(--accent-primary, #fa8b8b)', fontWeight: '600' }}>
                                        {selectedIds.size} selected
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Bulk Set Status:</span>
                                    <button
                                        type="button"
                                        className="btn btn--sm"
                                        onClick={() => handleBulkStatusChange('draft')}
                                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '4px 8px', fontSize: '0.78rem' }}
                                    >
                                        Draft
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn--sm"
                                        onClick={() => handleBulkStatusChange('scheduled')}
                                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '4px 8px', fontSize: '0.78rem' }}
                                    >
                                        Scheduled
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn--sm"
                                        onClick={() => handleBulkStatusChange('published')}
                                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '4px 8px', fontSize: '0.78rem' }}
                                    >
                                        Published
                                    </button>

                                    <select
                                        onChange={(e) => handleBulkCategoryChange(e.target.value)}
                                        defaultValue=""
                                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.78rem' }}
                                    >
                                        <option value="" disabled>Set Category...</option>
                                        {REFERENCE_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Articles Staging List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {filteredArticles.map((art, idx) => {
                                    const isSelected = selectedIds.has(art.tempId);

                                    return (
                                        <div
                                            key={art.tempId || idx}
                                            style={{
                                                background: art.hasConflict ? 'rgba(245, 158, 11, 0.05)' : 'var(--bg-card)',
                                                border: `1px solid ${art.hasConflict ? 'rgba(245, 158, 11, 0.3)' : isSelected ? 'var(--border-active)' : 'var(--border-color)'}`,
                                                borderRadius: '10px',
                                                padding: '14px 18px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '10px',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            {/* Upper row: Checkbox, Cover, Title, Status, Action */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                                {/* Checkbox */}
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectArticle(art.tempId)}
                                                    style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                                                />

                                                {/* Cover Image Thumbnail */}
                                                <div style={{ width: '50px', height: '50px', borderRadius: '8px', overflow: 'hidden', background: '#000', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                                                    {art.image_url ? (
                                                        <img
                                                            src={art.image_url}
                                                            alt=""
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        />
                                                    ) : (
                                                        <span style={{ fontSize: '1.2rem' }} title="No cover image matched">🖼️</span>
                                                    )}
                                                </div>

                                                {/* Title & Slug (Editable) */}
                                                <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
                                                    <input
                                                        type="text"
                                                        value={art.title}
                                                        onChange={(e) => updateArticleField(art.tempId, 'title', e.target.value)}
                                                        style={{ width: '100%', padding: '4px 8px', fontWeight: '700', fontSize: '0.95rem', background: 'transparent', border: '1px solid transparent', borderRadius: '4px', color: '#ffffff', marginBottom: '2px' }}
                                                        onFocus={(e) => e.target.style.background = 'var(--bg-input)'}
                                                        onBlur={(e) => e.target.style.background = 'transparent'}
                                                    />
                                                    <div style={{ display: 'flex', gap: '10px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                        <span><strong>Slug:</strong> <code>{art.slug}</code></span>
                                                        <span>•</span>
                                                        <span>{art.reading_time}</span>
                                                        <span>•</span>
                                                        <span style={{ color: art.image_status === 'matched' ? 'var(--success)' : 'var(--warning)' }}>
                                                            {art.image_status === 'matched' ? '✓ Cover Matched' : '⚠️ No Cover'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Category Selector */}
                                                <div style={{ width: '170px' }}>
                                                    <select
                                                        value={art.topic || 'SID Philosophy'}
                                                        onChange={(e) => updateArticleField(art.tempId, 'topic', e.target.value)}
                                                        style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.82rem' }}
                                                    >
                                                        {REFERENCE_CATEGORIES.map(cat => (
                                                            <option key={cat} value={cat}>{cat}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Status Selector (Default: Draft) */}
                                                <div style={{ width: '130px' }}>
                                                    <select
                                                        value={art.status || 'draft'}
                                                        onChange={(e) => updateArticleField(art.tempId, 'status', e.target.value)}
                                                        style={{
                                                            width: '100%',
                                                            padding: '6px 8px',
                                                            background: art.status === 'published' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-input)',
                                                            border: `1px solid ${art.status === 'published' ? 'var(--success)' : 'var(--border-color)'}`,
                                                            borderRadius: '6px',
                                                            color: art.status === 'published' ? 'var(--success)' : '#fff',
                                                            fontWeight: '600',
                                                            fontSize: '0.82rem'
                                                        }}
                                                    >
                                                        <option value="draft">Draft</option>
                                                        <option value="scheduled">Scheduled</option>
                                                        <option value="published">Published</option>
                                                    </select>
                                                </div>

                                                {/* Action Buttons */}
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        type="button"
                                                        className="btn btn--outline btn--sm"
                                                        onClick={() => handleOpenEditor(art, idx)}
                                                        style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', padding: '5px 10px', fontSize: '0.8rem' }}
                                                        title="Open in Rich Text Editor"
                                                    >
                                                        ✏️ Edit Content
                                                    </button>

                                                    {isInsideEditor && onLoadIntoEditor && (
                                                        <button
                                                            type="button"
                                                            className="btn btn--primary btn--sm"
                                                            onClick={() => handleLoadArticleIntoParentForm(art)}
                                                            style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                                                            title="Load into current open article editor"
                                                        >
                                                            📥 Load
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Collision / Existing Record Warning Banner */}
                                            {art.hasConflict && art.existingMatch && (
                                                <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.83rem', color: '#fbbf24' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                                        <div>
                                                            <strong>⚠️ Matches existing database article:</strong> "{art.existingMatch.title}" (slug: <code>{art.existingMatch.slug}</code>)
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <span>Action:</span>
                                                            <select
                                                                value={art.conflictAction || 'skip'}
                                                                onChange={(e) => updateArticleField(art.tempId, 'conflictAction', e.target.value)}
                                                                style={{ padding: '4px 8px', background: '#000', border: '1px solid rgba(245, 158, 11, 0.6)', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }}
                                                            >
                                                                <option value="skip">Skip (Keep existing intact)</option>
                                                                <option value="rename_slug">Auto-rename Slug (Create new)</option>
                                                                <option value="overwrite">Overwrite existing record</option>
                                                            </select>

                                                            {art.conflictAction === 'overwrite' && (
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontWeight: '700', cursor: 'pointer' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={!!art.overwriteConfirmed}
                                                                        onChange={(e) => updateArticleField(art.tempId, 'overwriteConfirmed', e.target.checked)}
                                                                    />
                                                                    Confirm Overwrite
                                                                </label>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {filteredArticles.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                                        No articles matching current filter or search criteria.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* VIEW 5: IMPORT COMPLETION REPORT */}
                    {importReport && (
                        <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎉</div>
                            <h3 style={{ margin: '0 0 10px', color: '#ffffff' }}>Batch Import Complete!</h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                                All articles have been processed according to your review selections.
                            </p>

                            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '30px' }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', borderRadius: '10px', padding: '16px 24px', minWidth: '130px' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--success)' }}>{importReport.savedCount}</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Successfully Saved</div>
                                </div>
                                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--warning)', borderRadius: '10px', padding: '16px 24px', minWidth: '130px' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--warning)' }}>{importReport.skippedCount}</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Preserved / Skipped</div>
                                </div>
                                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '10px', padding: '16px 24px', minWidth: '130px' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--danger)' }}>{importReport.failedCount}</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Failed</div>
                                </div>
                            </div>

                            {/* Details of skipped or failed */}
                            {importReport.skipped?.length > 0 && (
                                <div style={{ textAlign: 'left', background: 'var(--bg-card)', padding: '14px 18px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                                    <h5 style={{ margin: '0 0 8px', color: 'var(--warning)' }}>Preserved / Skipped Records:</h5>
                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        {importReport.skipped.map((s, idx) => (
                                            <li key={idx}><strong>{s.title}</strong> — {s.reason}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {importReport.failed?.length > 0 && (
                                <div style={{ textAlign: 'left', background: 'rgba(239, 68, 68, 0.1)', padding: '14px 18px', borderRadius: '8px', border: '1px solid var(--danger)', marginBottom: '16px' }}>
                                    <h5 style={{ margin: '0 0 8px', color: 'var(--danger)' }}>Failed Items:</h5>
                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#fca5a5' }}>
                                        {importReport.failed.map((f, idx) => (
                                            <li key={idx}><strong>{f.title}</strong>: {f.error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <button
                                type="button"
                                className="btn btn--primary"
                                onClick={handleClose}
                                style={{ padding: '10px 28px', fontSize: '1rem' }}
                            >
                                Done & Return to Articles
                            </button>
                        </div>
                    )}
                </div>

                {/* MODAL FOOTER */}
                {summary && editingArticleIndex === null && !importReport && (
                    <div
                        style={{
                            padding: '16px 24px',
                            borderTop: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(255,255,255,0.02)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button
                                type="button"
                                className="btn btn--secondary btn--sm"
                                onClick={() => { setSummary(null); setArticles([]); setFile(null); }}
                                disabled={committing}
                            >
                                ← Choose Another ZIP
                            </button>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {committing ? `Saving batch ${commitProgress.currentBatch} of ${commitProgress.totalBatches} (${commitProgress.percent}%)...` : `${selectedIds.size} of ${articles.length} articles selected for import`}
                            </span>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="button"
                                className="btn btn--secondary"
                                onClick={handleClose}
                                disabled={committing}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="btn btn--primary"
                                onClick={handleCommitImport}
                                disabled={committing || selectedIds.size === 0}
                                style={{
                                    background: 'var(--success, #10b981)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontWeight: '700',
                                    minWidth: '180px',
                                    justifyContent: 'center'
                                }}
                            >
                                {committing ? (
                                    <>
                                        <div className="spinner" style={{ width: '16px', height: '16px' }} />
                                        <span>Importing ({commitProgress.percent}%)...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>🚀 Confirm & Import ({selectedIds.size})</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
