import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function BlogCard({ blog, onEdit, onDelete }) {
    function handleShare() {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const publicBase = isLocal ? 'http://localhost:5173' : 'https://siddiqui.digital';
        const shareUrl = `${publicBase}/blogs/${blog.id}`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl)
                .then(() => toast.success('Share link copied to clipboard!'))
                .catch(() => copyFallback(shareUrl));
        } else {
            copyFallback(shareUrl);
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
        toast.success('Share link copied to clipboard!');
    }

    return (
        <div className="blog-card">
            <div className="blog-card__image">
                {blog.image_url ? (
                    <img src={blog.image_url} alt={blog.title} />
                ) : (
                    <div className="blog-card__image-placeholder">
                        <span>📝</span>
                    </div>
                )}
            </div>
            <div className="blog-card__body">
                <div className="blog-card__pretitle" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.78rem', color: 'var(--primary-color)', fontWeight: '600', marginBottom: '6px' }}>
                    {blog.topic && (
                        <span style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                            {blog.topic.toUpperCase()}
                        </span>
                    )}
                    {blog.topic2 && (
                        <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '2px 8px', borderRadius: '4px' }}>
                            {blog.topic2.toUpperCase()}
                        </span>
                    )}
                </div>
                <h3 className="blog-card__title">{blog.title}</h3>
                <p className="blog-card__excerpt">
                    {blog.content?.substring(0, 120).replace(/<[^>]+>/g, '')}
                    {blog.content?.length > 120 ? '...' : ''}
                </p>
                <div className="blog-card__meta">
                    <span className="blog-card__date">
                        {new Date(blog.published_date || blog.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                        })}
                    </span>
                </div>
            </div>
            <div className="blog-card__actions">
                {/* <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={handleShare}
                    title="Copy public blog link for sharing"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                    🔗 Share
                </button> */}
                <Link to={`/blogs/${blog.id}/comments`} className="btn btn--outline btn--sm">
                    Comments
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
