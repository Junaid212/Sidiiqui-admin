import { useState, useEffect } from 'react';
import { fetchBlogs } from '../services/blogService';
import { Link } from 'react-router-dom';

export default function BlogList() {
    const [blogs, setBlogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchBlogs();
                setBlogs(data);
            } catch (err) {
                console.error("Failed to load public blogs", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) {
        return (
            <div className="page-loading" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" />
                <p>Loading latest articles...</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', minHeight: '100vh', color: 'var(--text-primary)' }}>
            <header style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h1 style={{ fontSize: '3rem', fontWeight: '800', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    The Latest Insights
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginTop: '10px' }}>
                    Discover our newest thoughts, tutorials, and announcements.
                </p>
            </header>

            {blogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
                    <h2>No articles published yet.</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Check back later for new content!</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '30px' }}>
                    {blogs.map(blog => (
                        <Link to={`/blog/${blog.id}`} key={blog.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <div style={{
                                background: 'var(--bg-card)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--border-color)',
                                overflow: 'hidden',
                                transition: 'transform 0.2s',
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <div style={{ height: '220px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', position: 'relative' }}>
                                    {blog.image_url ? (
                                        <img src={blog.image_url} alt={blog.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>
                                            📝
                                        </div>
                                    )}
                                </div>
                                <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        <span style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>{blog.topic || 'General'}</span>
                                        <span>{new Date(blog.published_date || blog.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '12px', lineHeight: '1.4' }}>{blog.title}</h3>
                                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem', flex: 1 }}>
                                        {blog.content?.substring(0, 140).replace(/<[^>]+>/g, '')}
                                        {blog.content?.length > 140 ? '...' : ''}
                                    </p>
                                    <div style={{ marginTop: '20px', fontWeight: '600', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        Read Article →
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
