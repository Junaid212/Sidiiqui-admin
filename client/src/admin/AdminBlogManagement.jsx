import { useState, useEffect, useMemo } from 'react';
import { fetchBlogs, createBlog, updateBlog, deleteBlog, updateBlogStatus } from '../services/blogService';
import BlogList from '../components/Blog/BlogList';
import BlogForm from '../components/Blog/BlogForm';
import ZipImporterModal from '../components/Blog/ZipImporterModal';
import ErrorBoundary from '../components/Common/ErrorBoundary';
import toast from 'react-hot-toast';
import { renderEditorialBody, renderHighlightBox, renderPullQuote, renderAuthorBox } from '../utils/editorialRenderer';

export default function AdminBlogManagement() {
    const [blogs, setBlogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showZipImporter, setShowZipImporter] = useState(false);
    const [editingBlog, setEditingBlog] = useState(null);
    const [previewBlog, setPreviewBlog] = useState(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'published', 'draft', 'scheduled', 'featured'
    const [categoryFilter, setCategoryFilter] = useState('all');

    useEffect(() => {
        loadBlogs();
    }, []);

    async function loadBlogs() {
        try {
            const data = await fetchBlogs();
            setBlogs(data || []);
        } catch (err) {
            toast.error('Failed to load blogs');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate(formData) {
        try {
            const data = await createBlog(formData);
            setBlogs((prev) => [data, ...prev]);
            setShowForm(false);
            toast.success('Article created successfully');
        } catch (err) {
            toast.error(err.message || 'Failed to create article');
        }
    }

    async function handleUpdate(formData) {
        try {
            const data = await updateBlog(editingBlog.id, formData);
            setBlogs((prev) =>
                prev.map((b) => (b.id === editingBlog.id ? data : b))
            );
            setEditingBlog(null);
            setShowForm(false);
            toast.success('Article updated successfully');
        } catch (err) {
            toast.error(err.message || 'Failed to update article');
        }
    }

    async function handleStatusChange(id, updates) {
        try {
            const data = await updateBlogStatus(id, updates);
            setBlogs((prev) =>
                prev.map((b) => {
                    if (b.id === id) {
                        return { ...b, ...data };
                    }
                    // If newly featured, reset other blogs' is_featured
                    if (updates.is_featured) {
                        return { ...b, is_featured: false };
                    }
                    return b;
                })
            );
        } catch (err) {
            console.error('Failed to update status:', err);
            throw err;
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Are you sure you want to delete this article?')) return;

        try {
            await deleteBlog(id);
            setBlogs((prev) => prev.filter((b) => b.id !== id));
            toast.success('Article deleted successfully');
        } catch (err) {
            toast.error('Failed to delete article');
            console.error(err);
        }
    }

    function handleEdit(blog) {
        setEditingBlog(blog);
        setShowForm(true);
    }

    function handleCancel() {
        setShowForm(false);
        setEditingBlog(null);
    }

    // Extract categories
    const categories = useMemo(() => {
        const set = new Set();
        blogs.forEach(b => {
            if (b.topic) set.add(b.topic.trim());
            if (b.topic2) {
                const parts = typeof b.topic2 === 'string' ? b.topic2.split(',') : b.topic2;
                parts.forEach(p => {
                    if (p.trim()) set.add(p.trim());
                });
            }
        });
        return Array.from(set).sort();
    }, [blogs]);

    // Filtered blogs
    const filteredBlogs = useMemo(() => {
        return blogs.filter(b => {
            // Status filter
            const st = (b.status || 'published').toLowerCase();
            if (statusFilter === 'published' && st !== 'published') return false;
            if (statusFilter === 'draft' && st !== 'draft') return false;
            if (statusFilter === 'scheduled' && st !== 'scheduled') return false;
            if (statusFilter === 'featured' && !b.is_featured) return false;

            // Category filter
            if (categoryFilter !== 'all') {
                const bTopic = (b.topic || '').toLowerCase();
                const bTopic2 = (b.topic2 || '').toLowerCase();
                const target = categoryFilter.toLowerCase();
                if (!bTopic.includes(target) && !bTopic2.includes(target)) return false;
            }

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const titleMatch = (b.title || '').toLowerCase().includes(q);
                const contentMatch = (b.content || '').toLowerCase().includes(q);
                const catMatch = (b.topic || '').toLowerCase().includes(q);
                const slugMatch = (b.slug || '').toLowerCase().includes(q);
                if (!titleMatch && !contentMatch && !catMatch && !slugMatch) return false;
            }

            return true;
        });
    }, [blogs, statusFilter, categoryFilter, searchQuery]);

    // Statistics counts
    const publishedCount = blogs.filter(b => (b.status || 'published') === 'published').length;
    const draftCount = blogs.filter(b => b.status === 'draft').length;
    const scheduledCount = blogs.filter(b => b.status === 'scheduled').length;
    const featuredCount = blogs.filter(b => b.is_featured).length;

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner" />
                <p>Loading editorial articles...</p>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page__header" style={{ marginBottom: '20px' }}>
                <div>
                    <h1 className="page__title">Editorial Blog Management</h1>
                    <p className="page__subtitle">
                        {blogs.length} articles ({publishedCount} published, {draftCount} drafts, {scheduledCount} scheduled)
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        className="btn btn--outline"
                        onClick={() => setShowZipImporter(true)}
                        style={{
                            borderColor: 'var(--success, #10b981)',
                            color: 'var(--success, #10b981)',
                            fontWeight: '600',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                        title="Import articles and images from a ZIP archive"
                    >
                        <span>📦 Import ZIP (Bulk / Single)</span>
                    </button>
                    <button
                        className="btn btn--primary"
                        onClick={() => {
                            setEditingBlog(null);
                            setShowForm(true);
                        }}
                    >
                        + New Editorial Article
                    </button>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* Search Input */}
                <div style={{ flex: '1 1 260px' }}>
                    <input
                        type="text"
                        placeholder="🔍 Search articles by title, keywords, or slug..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '9px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
                    />
                </div>

                {/* Status Tabs */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', color: 'white' }}>
                    {[
                        { id: 'all', label: `All (${blogs.length})` },
                        { id: 'published', label: `Published (${publishedCount})` },
                        { id: 'draft', label: `Drafts (${draftCount})` },
                        { id: 'scheduled', label: `Scheduled (${scheduledCount})` },
                        { id: 'featured', label: `⭐ Featured (${featuredCount})` },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setStatusFilter(tab.id)}
                            style={{
                                background: statusFilter === tab.id ? 'var(--accent-primary, #A3192F)' : 'var(--bg-input)',
                                color: statusFilter === tab.id ? '#ffffff ' : 'var(--text-secondary)',
                                border: '1px solid var(--border-color)',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.82rem',
                                fontWeight: statusFilter === tab.id ? '700' : '500',
                                cursor: 'pointer'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Category Filter */}
                <div style={{ minWidth: '180px' }}>
                    <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'red' }}
                    >
                        <option value="all">All Topics & Categories</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            <BlogList
                blogs={filteredBlogs}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                onPreview={(b) => setPreviewBlog(b)}
            />

            {/* Create/Edit Form Modal */}
            {showForm && (
                <BlogForm
                    blog={editingBlog}
                    allBlogs={blogs}
                    onSubmit={editingBlog ? handleUpdate : handleCreate}
                    onCancel={handleCancel}
                />
            )}

            {/* ZIP Importer Modal */}
            {showZipImporter && (
                <ErrorBoundary onReset={() => setShowZipImporter(false)}>
                    <ZipImporterModal
                        isOpen={showZipImporter}
                        onClose={() => setShowZipImporter(false)}
                        onImportComplete={() => {
                            loadBlogs();
                        }}
                    />
                </ErrorBoundary>
            )}

            {/* Standalone Dashboard Preview Modal */}
            {previewBlog && (
                <div className="modal-overlay" onClick={() => setPreviewBlog(null)} style={{ zIndex: 1100 }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '820px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="modal__header" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', padding: '16px 20px' }}>
                            <h3 style={{ margin: 0 }}>Article Reader Preview</h3>
                            <button className="modal__close" onClick={() => setPreviewBlog(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'inherit' }}>×</button>
                        </div>
                        <div style={{ background: '#ffffff', color: '#1B1F2A', padding: '36px 24px', fontFamily: "'Source Sans 3', sans-serif" }}>
                            <div style={{ maxWidth: '720px', margin: '0 auto' }}>
                                <div style={{ fontSize: '14px', fontWeight: '700', color: '#8A1528', marginBottom: '8px' }}>
                                    {(previewBlog.topic || 'EDITORIAL').toUpperCase()}
                                </div>
                                <h1 style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: '36px', color: '#13294B', lineHeight: '1.2', margin: '0 0 16px' }}>
                                    {previewBlog.title}
                                </h1>
                                {previewBlog.standfirst && (
                                    <p style={{ fontSize: '20px', lineHeight: '1.5', color: '#3E4556', margin: '0 0 16px' }}>
                                        {previewBlog.standfirst}
                                    </p>
                                )}
                                <p style={{ fontSize: '15px', color: '#4A5163', marginBottom: '24px' }}>
                                    {previewBlog.author_byline || 'By M. Q. Siddiqui, Founder, Siddiqui.digital'}
                                </p>
                                {previewBlog.image_url && (
                                    <img src={previewBlog.image_url} alt="" style={{ width: '100%', borderRadius: '10px', marginBottom: '24px' }} />
                                )}
                                {(() => {
                                    const previewSubs = Array.isArray(previewBlog.sub_sections) && previewBlog.sub_sections.length > 0
                                        ? previewBlog.sub_sections
                                        : (previewBlog.title2 || previewBlog.content2
                                            ? [{ id: 'sub-legacy-1', heading: previewBlog.title2, body: previewBlog.content2, highlight_type: 'none', highlight_text: '' }]
                                            : []);
                                    const previewPullQuotePos = previewBlog.pull_quote_position !== undefined && previewBlog.pull_quote_position !== null
                                        ? Number(previewBlog.pull_quote_position)
                                        : 1;

                                    return (
                                        <>
                                            {/* 1. Full Article Body */}
                                            <div style={{ fontSize: '18px', lineHeight: '1.7', color: '#1B1F2A', marginBottom: '24px' }}>
                                                {renderEditorialBody(previewBlog.content)}
                                            </div>

                                            {/* Pull quote after full body if pos 0 */}
                                            {previewPullQuotePos === 0 && previewBlog.pull_quote && renderPullQuote(previewBlog.pull_quote, previewBlog.pull_quote_author)}

                                            {/* 2. Sub-sections in order */}
                                            {previewSubs.map((sub, idx) => (
                                                <div key={sub.id || idx}>
                                                    {sub.heading && (
                                                        <h2 style={{
                                                            margin: '36px 0 16px',
                                                            fontFamily: "'Source Serif 4', Georgia, serif",
                                                            fontSize: '28px',
                                                            lineHeight: 1.3,
                                                            color: '#13294B',
                                                            fontWeight: 700
                                                        }}>
                                                            {sub.heading}
                                                        </h2>
                                                    )}
                                                    {renderEditorialBody(sub.body)}
                                                    {renderHighlightBox(sub)}
                                                    {previewPullQuotePos === (idx + 1) && previewBlog.pull_quote && renderPullQuote(previewBlog.pull_quote, previewBlog.pull_quote_author)}
                                                </div>
                                            ))}

                                            {previewPullQuotePos > previewSubs.length && previewSubs.length > 0 && previewBlog.pull_quote && renderPullQuote(previewBlog.pull_quote, previewBlog.pull_quote_author)}

                                            {/* 3. Concluding Insight */}
                                            {previewBlog.concluding_insight && (
                                                <div style={{ background: '#F4F5F8', borderRadius: '10px', padding: '20px', marginTop: '32px' }}>
                                                    <p style={{ fontWeight: '700', fontSize: '13px', color: '#13294B', margin: '0 0 6px', letterSpacing: '2px' }}>CONCLUDING INSIGHT</p>
                                                    <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.6, color: '#1B1F2A' }}>{previewBlog.concluding_insight}</p>
                                                </div>
                                            )}

                                            {/* 4. Author Box */}
                                            {renderAuthorBox(previewBlog)}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
