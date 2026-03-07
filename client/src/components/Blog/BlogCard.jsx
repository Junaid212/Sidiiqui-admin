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
                    {blog.topic && blog.published_date && <span>•</span>}
                    {blog.published_date && <span>{new Date(blog.published_date).toLocaleDateString()}</span>}
                </div>
                <h3 className="blog-card__title">{blog.title}</h3>
                <p className="blog-card__excerpt">
                    {blog.content?.substring(0, 120)}
                    {blog.content?.length > 120 ? '...' : ''}
                </p>
                {blog.title2 && (
                    <h4 style={{ fontSize: '1rem', marginTop: '12px', color: 'var(--text-primary)' }}>
                        {blog.title2}
                    </h4>
                )}
                {blog.content2 && (
                    <p className="blog-card__excerpt" style={{ marginTop: '4px', fontSize: '0.85rem' }}>
                        {blog.content2?.substring(0, 80)}
                        {blog.content2?.length > 80 ? '...' : ''}
                    </p>
                )}
                <div className="blog-card__meta">
                    <span className="blog-card__date">
                        {new Date(blog.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                        })}
                    </span>
                </div>
            </div>
            <div className="blog-card__actions">
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
