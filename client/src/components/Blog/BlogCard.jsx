import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function BlogCard({ blog, onEdit, onDelete, onStatusChange, onPreview }) {
    const [updating, setUpdating] = useState(false);

    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const publicBase = isLocal ? 'http://localhost:5173' : 'https://siddiqui.digital';
    const publicUrl = `${publicBase}/blogs/${blog.slug || blog.id}`;

    function handleShare() {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(publicUrl)
                .then(() => toast.success('Public article link copied to clipboard!'))
                .catch(() => copyFallback(publicUrl));
        } else {
            copyFallback(publicUrl);
        }
    }

    function copyFallback(text) {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        toast.success('Public article link copied to clipboard!');
    }

    async function handleToggleStatus() {
        if (!onStatusChange) return;
        setUpdating(true);
        try {
            const nextStatus = blog.status === 'published' ? 'unpublished' : 'published';
            await onStatusChange(blog.id, { status: nextStatus });
            toast.success(nextStatus === 'published' ? 'Article published' : 'Article unpublished');
        } catch (err) {
            toast.error('Failed to change status');
        } finally {
            setUpdating(false);
        }
    }

    async function handleToggleFeatured() {
        if (!onStatusChange) return;
        setUpdating(true);
        try {
            await onStatusChange(blog.id, { is_featured: !blog.is_featured });
            toast.success(!blog.is_featured ? 'Marked as Featured Article' : 'Removed from Featured');
        } catch (err) {
            toast.error('Failed to update featured status');
        } finally {
            setUpdating(false);
        }
    }

    // Status styling
    const status = (blog.status || 'published').toLowerCase();
    let statusLabel = 'Published';
    let statusBg = 'rgba(16, 185, 129, 0.15)';
    let statusColor = '#10b981';

    if (status === 'draft') {
        statusLabel = 'Draft';
        statusBg = 'rgba(245, 158, 11, 0.15)';
        statusColor = '#f59e0b';
    } else if (status === 'scheduled') {
        statusLabel = `Scheduled (${blog.scheduled_for ? new Date(blog.scheduled_for).toLocaleDateString() : 'Pending'})`;
        statusBg = 'rgba(99, 102, 241, 0.15)';
        statusColor = '#818cf8';
    } else if (status === 'unpublished') {
        statusLabel = 'Unpublished';
        statusBg = 'rgba(239, 68, 68, 0.15)';
        statusColor = '#ef4444';
    }

    return (
        <div className="blog-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="blog-card__image" style={{ position: 'relative' }}>
                {blog.image_url ? (
                    <img src={blog.image_url} alt={blog.image_alt || blog.title} />
                ) : (
                    <div className="blog-card__image-placeholder">
                        <span>📝</span>
                    </div>
                )}

                {/* Status Badge */}
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    display: 'flex',
                    gap: '6px',
                    flexWrap: 'wrap',
                }}>
                    <span style={{
                        background: statusBg,
                        color: statusColor,
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        backdropFilter: 'blur(4px)',
                        border: `1px solid ${statusColor}40`
                    }}>
                        ● {statusLabel}
                    </span>

                    {blog.is_featured && (
                        <span style={{
                            background: 'rgba(245, 158, 11, 0.9)',
                            color: '#000',
                            padding: '4px 8px',
                            borderRadius: '20px',
                            fontSize: '0.72rem',
                            fontWeight: '800',
                        }}>
                            ⭐ Featured
                        </span>
                    )}
                </div>

                {/* Book Related Badge */}
                {blog.related_to_book && (
                    <div style={{
                        position: 'absolute',
                        bottom: '8px',
                        left: '10px',
                        background: '#13294B',
                        color: '#fff',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        fontWeight: '700',
                    }}>
                        📖 Marketing Reclassified
                    </div>
                )}
            </div>

            <div className="blog-card__body" style={{ flex: '1 1 auto' }}>
                <div className="blog-card__pretitle" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.75rem', fontWeight: '700', marginBottom: '8px' }}>
                    {blog.topic && (
                        <span style={{ background: 'rgba(163, 25, 47, 0.1)', color: '#A3192F', padding: '2px 8px', borderRadius: '4px' }}>
                            {blog.topic.toUpperCase()}
                        </span>
                    )}
                    {blog.topic2 && (typeof blog.topic2 === 'string' ? blog.topic2.split(',') : blog.topic2)
                        .map(s => String(s).trim())
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((t, idx) => (
                            <span key={idx} style={{ background: 'rgba(19, 41, 75, 0.08)', color: '#13294B', padding: '2px 8px', borderRadius: '4px' }}>
                                {t.toUpperCase()}
                            </span>
                        ))}
                </div>

                <h3 className="blog-card__title" style={{ fontSize: '1.15rem', lineHeight: '1.3', marginBottom: '8px' }}>
                    {blog.title}
                </h3>

                <p className="blog-card__excerpt" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    {blog.summary || blog.standfirst || blog.content?.substring(0, 110).replace(/<[^>]+>/g, '') + '...'}
                </p>

                <div className="blog-card__meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span>
                        {new Date(blog.published_date || blog.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                        })}
                    </span>
                    {blog.reading_time && (
                        <span>⏳ {blog.reading_time}</span>
                    )}
                </div>
            </div>

            <div className="blog-card__actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
                {onPreview && (
                    <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => onPreview(blog)}
                        title="Preview article as it appears to readers"
                    >
                        👁️ Preview
                    </button>
                )}

                <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={handleShare}
                    title="Copy public link"
                >
                    🔗 Link
                </button>

                <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={handleToggleFeatured}
                    disabled={updating}
                    title={blog.is_featured ? 'Remove from Featured' : 'Set as Featured Article'}
                    style={{ color: blog.is_featured ? '#f59e0b' : 'inherit' }}
                >
                    {blog.is_featured ? '★ Featured' : '☆ Feature'}
                </button>

                <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={handleToggleStatus}
                    disabled={updating}
                    title={blog.status === 'published' ? 'Unpublish article' : 'Publish article'}
                >
                    {blog.status === 'published' ? 'Unpublish' : 'Publish'}
                </button>

                <Link to={`/blogs/${blog.id}/comments`} className="btn btn--outline btn--sm">
                    💬 Comments
                </Link>

                <button type="button" className="btn btn--outline btn--sm" onClick={() => onEdit(blog)}>
                    Edit
                </button>

                <button type="button" className="btn btn--danger btn--sm" onClick={() => onDelete(blog.id)}>
                    Delete
                </button>
            </div>
        </div>
    );
}
