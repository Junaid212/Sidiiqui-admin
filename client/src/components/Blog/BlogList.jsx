import BlogCard from './BlogCard';

export default function BlogList({ blogs, onEdit, onDelete }) {
    if (!blogs || blogs.length === 0) {
        return (
            <div className="empty-state">
                <span className="empty-state__icon">📝</span>
                <p>No blog posts yet. Create your first one!</p>
            </div>
        );
    }

    return (
        <div className="blog-grid">
            {blogs.map((blog) => (
                <BlogCard
                    key={blog.id}
                    blog={blog}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
}
