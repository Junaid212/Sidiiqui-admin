import { Link } from 'react-router-dom';

export default function BlogCard({ blog, onEdit, onDelete }) {
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
                <div className="blog-card__pretitle" style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: '600', marginBottom: '4px' }}>
                    {blog.topic && <span>{blog.topic.toUpperCase()}</span>}
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
                <Link to={`/blogs/${blog.id}/comments`} className="btn btn--outline btn--sm">
                    Comments
                </Link>
                <button className="btn btn--outline btn--sm" onClick={() => onEdit(blog)}>
                    Edit
                </button>
                <button className="btn btn--danger btn--sm" onClick={() => onDelete(blog.id)}>
                    Delete
                </button>
            </div>
        </div>
    );
}
