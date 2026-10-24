import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchBlogById } from '../services/blogService';
import { renderEditorialBody, renderHighlightBox, renderPullQuote, renderAuthorBox } from '../utils/editorialRenderer';

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

    const subSections = Array.isArray(blog.sub_sections) && blog.sub_sections.length > 0
        ? blog.sub_sections
        : (blog.title2 || blog.content2
            ? [{ id: 'sub-legacy-1', heading: blog.title2, body: blog.content2, highlight_type: 'none', highlight_text: '' }]
            : []);

    const pullQuotePos = blog.pull_quote_position !== undefined && blog.pull_quote_position !== null
        ? Number(blog.pull_quote_position)
        : 1;

    return (
        <article style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px', color: 'var(--text-primary)', minHeight: '100vh' }}>
            <Link to="/blog" style={{ display: 'inline-block', marginBottom: '40px', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: '600', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.target.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}>
                ← Back to Articles
            </Link>

            <header style={{ marginBottom: '40px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.95rem' }}>
                    <span style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>
                        {[
                            blog.topic,
                            ...(blog.topic2 ? (typeof blog.topic2 === 'string' ? blog.topic2.split(',') : blog.topic2) : [])
                        ]
                            .map(s => String(s).trim())
                            .filter(Boolean)
                            .join(' • ') || 'General'}
                    </span>
                    <span>•</span>
                    <span>{new Date(blog.published_date || blog.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <h1 style={{ fontSize: '3.5rem', fontWeight: '800', lineHeight: '1.2', marginBottom: '24px', letterSpacing: '-0.02em' }}>
                    {blog.title}
                </h1>
                {blog.standfirst && (
                    <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', lineHeight: '1.5', maxWidth: '750px', margin: '0 auto 16px' }}>
                        {blog.standfirst}
                    </p>
                )}
            </header>

            {blog.image_url && (
                <div style={{ width: '100%', height: 'auto', maxHeight: '500px', overflow: 'hidden', borderRadius: 'var(--radius-lg)', marginBottom: '50px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                    <img
                        src={blog.image_url}
                        alt={blog.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                </div>
            )}

            <div className="blog-content-body" style={{ fontSize: '1.15rem', lineHeight: '1.8', color: 'var(--text-primary)', maxWidth: '800px', margin: '0 auto', paddingBottom: '60px' }}>
                {/* 1. Full Article Body */}
                <div style={{ marginBottom: '28px' }}>
                    {renderEditorialBody(blog.content)}
                </div>

                {pullQuotePos === 0 && blog.pull_quote && renderPullQuote(blog.pull_quote, blog.pull_quote_author)}

                {/* 2. Sub-sections in order set */}
                {subSections.map((sub, idx) => (
                    <div key={sub.id || idx} style={{ marginTop: '20px' }}>
                        {sub.heading && (
                            <h2 style={{
                                margin: '38px 0 16px',
                                fontSize: '2rem',
                                color: 'var(--accent-primary, #13294B)',
                                fontWeight: '700',
                                lineHeight: '1.3'
                            }}>
                                {sub.heading}
                            </h2>
                        )}
                        {renderEditorialBody(sub.body)}
                        {renderHighlightBox(sub)}
                        {pullQuotePos === (idx + 1) && blog.pull_quote && renderPullQuote(blog.pull_quote, blog.pull_quote_author)}
                    </div>
                ))}

                {pullQuotePos > subSections.length && subSections.length > 0 && blog.pull_quote && renderPullQuote(blog.pull_quote, blog.pull_quote_author)}

                {/* 3. Concluding Insight */}
                {blog.concluding_insight && (
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px 28px', marginTop: '36px' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '13px', letterSpacing: '3px', fontWeight: '700', color: 'var(--accent-primary)' }}>
                            CONCLUDING INSIGHT
                        </p>
                        <p style={{ margin: 0, fontSize: '1.1rem', lineHeight: '1.6' }}>
                            {blog.concluding_insight}
                        </p>
                    </div>
                )}

                {/* 4. Author Box */}
                {renderAuthorBox(blog)}
            </div>
        </article>
    );
}
