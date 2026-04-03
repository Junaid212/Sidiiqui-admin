import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchBlogById } from '../services/blogService';

export default function BlogDetails() {
    const { id } = useParams();
    const [blog, setBlog] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchBlogById(id);
                setBlog(data);
            } catch (err) {
                console.error("Failed to load blog by id", err);
                setError('Sorry, this article could not be found or has been removed.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    if (loading) {
        return (
            <div className="page-loading" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" />
                <p>Loading article...</p>
            </div>
        );
    }

    if (error || !blog) {
        return (
            <div style={{ maxWidth: '800px', margin: '100px auto', textAlign: 'center', padding: '40px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
                <h1 style={{ color: 'var(--text-primary)', marginBottom: '20px' }}>Article Not Found</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>{error}</p>
                <Link to="/blog" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 'bold' }}>
                    ← Back to All Blogs
                </Link>
            </div>
        );
    }

    return (
        <article style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px', color: 'var(--text-primary)', minHeight: '100vh' }}>
            <Link to="/blog" style={{ display: 'inline-block', marginBottom: '40px', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: '600', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.target.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}>
                ← Back to Articles
            </Link>

            <header style={{ marginBottom: '40px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.95rem' }}>
                    <span style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>{blog.topic || 'General'}</span>
                    <span>•</span>
                    <span>{new Date(blog.published_date || blog.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <h1 style={{ fontSize: '3.5rem', fontWeight: '800', lineHeight: '1.2', marginBottom: '24px', letterSpacing: '-0.02em' }}>
                    {blog.title}
                </h1>
                {blog.title2 && (
                    <h2 style={{ fontSize: '1.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', maxWidth: '700px', margin: '0 auto' }}>
                        {blog.title2}
                    </h2>
                )}
            </header>

            {blog.image_url && (
                <div style={{ width: '100%', height: 'auto', maxHeight: '500px', overflow: 'hidden', borderRadius: 'var(--radius-lg)', marginBottom: '60px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                    <img
                        src={blog.image_url}
                        alt={blog.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                </div>
            )}

            <div className="blog-content-body" style={{ fontSize: '1.15rem', lineHeight: '1.8', color: 'var(--text-primary)', maxWidth: '800px', margin: '0 auto', paddingBottom: '60px' }}>
                {/* Parse newline characters into standard paragraph breaks if plain text is submitted without HTML */}
                {blog.content.split('\n').map((paragraph, index) => (
                    paragraph.trim() ? <p key={`p1-${index}`} style={{ marginBottom: '24px' }}>{paragraph}</p> : null
                ))}

                {blog.content2 && (
                    <div style={{ marginTop: '40px', paddingTop: '40px', borderTop: '1px solid var(--border-color)' }}>
                        {blog.content2.split('\n').map((paragraph, index) => (
                            paragraph.trim() ? <p key={`p2-${index}`} style={{ marginBottom: '24px' }}>{paragraph}</p> : null
                        ))}
                    </div>
                )}
            </div>
        </article>
    );
}
