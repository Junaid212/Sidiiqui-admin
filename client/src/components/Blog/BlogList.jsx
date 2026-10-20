import BlogCard from './BlogCard';

export default function BlogList({ blogs, onEdit, onDelete, onStatusChange, onPreview }) {
    if (!blogs || blogs.length === 0) {
        return (
            <div className="empty-state" style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <span className="empty-state__icon" style={{ fontSize: '3rem', display: 'block', marginBottom: '12px' }}>📝</span>
                <h3 style={{ margin: '0 0 8px' }}>No matching articles</h3>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Create a new article or adjust your search and filters.</p>
            </div>
        );
    }

    return (
        <div className="blog-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {blogs.map((blog) => (
                <BlogCard
                    key={blog.id}
                    blog={blog}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onStatusChange={onStatusChange}
                    onPreview={onPreview}
                />
            ))}
        </div>
    );
}
