import { useState, useEffect, useRef } from 'react';

const REFERENCE_CATEGORIES = [
    'SID Philosophy',
    'Marketing Reclassified',
    'Business Strategy & Growth',
    'Leadership & Governance',
    'AI & Human Thinking',
    'Higher Education & Learning',
    'Innovation & Entrepreneurship',
    'Business Insights',
    'Books & Publications'
];

export default function BlogForm({ blog, allBlogs = [], onSubmit, onCancel }) {
    // Core fields
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [topic, setTopic] = useState('SID Philosophy');
    const [secondaryCategories, setSecondaryCategories] = useState([]);
    const [catSearch, setCatSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [published_date, setPublishedDate] = useState('');
    const [reading_time, setReadingTime] = useState('');
    const [author_byline, setAuthorByline] = useState('By M. Q. Siddiqui, Founder, Siddiqui.digital');

    // Editorial text & lead
    const [standfirst, setStandfirst] = useState('');
    const [summary, setSummary] = useState('');
    const [content, setContent] = useState('');
    const [title2, setTitle2] = useState('');
    const [content2, setContent2] = useState('');

    // Editorial callouts
    const [pull_quote, setPullQuote] = useState('');
    const [pull_quote_author, setPullQuoteAuthor] = useState('');
    const [concluding_insight, setConcludingInsight] = useState('');

    // Media
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState(null);
    const [image_caption, setImageCaption] = useState('');
    const [image_alt, setImageAlt] = useState('');

    // Marketing Reclassified relationship
    const [related_to_book, setRelatedToBook] = useState(false);
    const [book_concept, setBookConcept] = useState('');

    // Related articles (up to 3)
    const [selectedRelatedIds, setSelectedRelatedIds] = useState([]);

    // Publishing & Scheduling
    const [status, setStatus] = useState('published');
    const [scheduled_for, setScheduledFor] = useState('');
    const [is_featured, setIsFeatured] = useState(false);

    // SEO
    const [seo_title, setSeoTitle] = useState('');
    const [seo_description, setSeoDescription] = useState('');

    // UI state
    const [activeTab, setActiveTab] = useState('edit'); // 'edit' or 'preview'
    const [submitting, setSubmitting] = useState(false);

    const dropdownRef = useRef(null);

    // Auto-derive slug from title if user hasn't typed a custom slug
    function handleTitleChange(val) {
        setTitle(val);
        if (!blog || !slug || slug === deriveSlug(title)) {
            setSlug(deriveSlug(val));
        }
        updateAutoReadingTime(content, val);
    }

    function deriveSlug(text) {
        return (text || '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    function updateAutoReadingTime(bodyText, headline) {
        const words = `${headline || ''} ${standfirst || ''} ${bodyText || ''}`.trim().split(/\s+/).filter(Boolean).length;
        const minutes = Math.max(1, Math.ceil(words / 200));
        setReadingTime(`${minutes} min read`);
    }

    // Populate data on mount/edit
    useEffect(() => {
        if (blog) {
            setTitle(blog.title || '');
            setSlug(blog.slug || deriveSlug(blog.title || ''));
            setTopic(blog.topic || 'SID Philosophy');

            // Secondary categories
            if (Array.isArray(blog.topic2)) {
                setSecondaryCategories(blog.topic2.map(s => String(s).trim()).filter(Boolean));
            } else if (typeof blog.topic2 === 'string' && blog.topic2.trim()) {
                setSecondaryCategories(blog.topic2.split(',').map(s => s.trim()).filter(Boolean));
            } else {
                setSecondaryCategories([]);
            }

            setPublishedDate(blog.published_date ? new Date(blog.published_date).toISOString().split('T')[0] : '');
            setReadingTime(blog.reading_time || '4 min read');
            setAuthorByline(blog.author_byline || 'By M. Q. Siddiqui, Founder, Siddiqui.digital');

            setStandfirst(blog.standfirst || '');
            setSummary(blog.summary || '');
            setContent(blog.content || '');
            setTitle2(blog.title2 || '');
            setContent2(blog.content2 || '');

            setPullQuote(blog.pull_quote || '');
            setPullQuoteAuthor(blog.pull_quote_author || '');
            setConcludingInsight(blog.concluding_insight || '');

            setPreview(blog.image_url || null);
            setImageCaption(blog.image_caption || '');
            setImageAlt(blog.image_alt || '');

            setRelatedToBook(!!blog.related_to_book);
            setBookConcept(blog.book_concept || '');

            // Related articles
            if (Array.isArray(blog.related_blog_ids)) {
                setSelectedRelatedIds(blog.related_blog_ids.map(String));
            } else if (typeof blog.related_blog_ids === 'string') {
                try {
                    setSelectedRelatedIds(JSON.parse(blog.related_blog_ids).map(String));
                } catch (_) {
                    setSelectedRelatedIds([]);
                }
            } else {
                setSelectedRelatedIds([]);
            }

            setStatus(blog.status || 'published');
            setScheduledFor(blog.scheduled_for ? new Date(blog.scheduled_for).toISOString().slice(0, 16) : '');
            setIsFeatured(!!blog.is_featured);

            setSeoTitle(blog.seo_title || '');
            setSeoDescription(blog.seo_description || '');
        } else {
            setPublishedDate(new Date().toISOString().split('T')[0]);
            setReadingTime('3 min read');
        }
    }, [blog]);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    function handleImageChange(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('Image file is too large. Please select an image under 5MB.');
                e.target.value = '';
                return;
            }
            setImage(file);
            setPreview(URL.createObjectURL(file));
        }
    }

    function toggleCategory(cat) {
        const trimmed = cat.trim();
        if (!trimmed) return;
        setSecondaryCategories(prev => {
            const exists = prev.some(c => c.toLowerCase() === trimmed.toLowerCase());
            if (exists) return prev.filter(c => c.toLowerCase() !== trimmed.toLowerCase());
            return [...prev, trimmed];
        });
        setCatSearch('');
    }

    function removeCategory(catToRemove) {
        setSecondaryCategories(prev => prev.filter(c => c.toLowerCase() !== catToRemove.toLowerCase()));
    }

    function toggleRelatedBlog(relId) {
        const idStr = String(relId);
        setSelectedRelatedIds(prev => {
            if (prev.includes(idStr)) {
                return prev.filter(i => i !== idStr);
            }
            if (prev.length >= 3) {
                alert('You can select a maximum of 3 related articles.');
                return prev;
            }
            return [...prev, idStr];
        });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!title.trim() || !content.trim()) {
            alert('Title and Article Content are required.');
            return;
        }

        if (status === 'scheduled' && !scheduled_for) {
            alert('Please specify a scheduled publication date and time.');
            return;
        }

        setSubmitting(true);
        try {
            const topic2String = secondaryCategories.map(c => c.trim()).filter(Boolean).join(', ');

            const formData = {
                title: title.trim(),
                slug: deriveSlug(slug || title),
                topic,
                topic2: topic2String,
                published_date: published_date || new Date().toISOString().split('T')[0],
                reading_time: reading_time || '4 min read',
                author_byline: author_byline.trim(),

                standfirst: standfirst.trim(),
                summary: summary.trim(),
                content,
                title2: title2.trim(),
                content2,

                pull_quote: pull_quote.trim(),
                pull_quote_author: pull_quote_author.trim(),
                concluding_insight: concluding_insight.trim(),

                imageFile: image,
                image_url: preview,
                image_path: blog ? blog.image_path : null,
                image_caption: image_caption.trim(),
                image_alt: image_alt.trim(),

                related_to_book,
                book_concept: book_concept.trim(),
                related_blog_ids: selectedRelatedIds,

                status,
                scheduled_for: status === 'scheduled' ? scheduled_for : null,
                is_featured,

                seo_title: seo_title.trim(),
                seo_description: seo_description.trim(),
            };

            await onSubmit(formData);
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    }

    // Filterable other blogs for related articles
    const otherBlogs = (allBlogs || []).filter(b => !blog || String(b.id) !== String(blog.id));

    return (
        <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 1050 }}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '920px', width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <h2 style={{ margin: 0, fontSize: '1.35rem' }}>{blog ? 'Edit Article' : 'Create Editorial Article'}</h2>
                        <div style={{ display: 'inline-flex', background: 'var(--bg-card)', borderRadius: '6px', padding: '3px', border: '1px solid var(--border-color)' }}>
                            <button
                                type="button"
                                onClick={() => setActiveTab('edit')}
                                style={{
                                    border: 'none',
                                    background: activeTab === 'edit' ? 'var(--accent-primary, #A3192F)' : 'transparent',
                                    color: activeTab === 'edit' ? '#fff' : 'inherit',
                                    padding: '5px 14px',
                                    borderRadius: '4px',
                                    fontSize: '0.82rem',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                ✏️ Editor
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('preview')}
                                style={{
                                    border: 'none',
                                    background: activeTab === 'preview' ? 'var(--accent-primary, #A3192F)' : 'transparent',
                                    color: activeTab === 'preview' ? '#fff' : 'inherit',
                                    padding: '5px 14px',
                                    borderRadius: '4px',
                                    fontSize: '0.82rem',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                👁️ Live Editorial Preview
                            </button>
                        </div>
                    </div>
                    <button className="modal__close" onClick={onCancel} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>×</button>
                </div>

                <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '24px' }}>
                    {activeTab === 'preview' ? (
                        /* LIVE EDITORIAL PREVIEW MATCHING SID_Insights_Article_Template.html */
                        <div style={{ background: '#ffffff', color: '#1B1F2A', padding: '36px 24px', borderRadius: '12px', fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif" }}>
                            <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', fontSize: '14px', fontWeight: '700', letterSpacing: '1px', color: '#4A5163' }}>
                                    <span style={{ background: '#F7EEF0', color: '#8A1528', padding: '4px 12px', borderRadius: '999px' }}>
                                        {topic.toUpperCase()}
                                    </span>
                                    <span>{new Date(published_date || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                    <span>·</span>
                                    <span>{reading_time || '4 min read'}</span>
                                    {is_featured && <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px' }}>⭐ FEATURED</span>}
                                    <span style={{ marginLeft: 'auto', textTransform: 'capitalize', color: status === 'published' ? '#10b981' : '#f59e0b' }}>
                                        ● {status}
                                    </span>
                                </div>

                                <h1 style={{ margin: '8px 0', fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: '700', fontSize: '38px', lineHeight: '1.2', color: '#13294B' }}>
                                    {title || '[Article headline]'}
                                </h1>

                                {standfirst && (
                                    <p style={{ margin: 0, fontSize: '20px', lineHeight: '1.5', color: '#3E4556', fontStyle: 'normal' }}>
                                        {standfirst}
                                    </p>
                                )}

                                <p style={{ margin: 0, fontSize: '15px', color: '#4A5163' }}>
                                    {author_byline}
                                </p>
                            </div>

                            {preview && (
                                <div style={{ maxWidth: '820px', margin: '24px auto', textAlign: 'center' }}>
                                    <img src={preview} alt={image_alt || title} style={{ width: '100%', maxHeight: '420px', objectFit: 'cover', borderRadius: '12px' }} />
                                    {image_caption && (
                                        <p style={{ fontSize: '13px', color: '#4A5163', marginTop: '8px', fontStyle: 'italic' }}>{image_caption}</p>
                                    )}
                                </div>
                            )}

                            <div style={{ maxWidth: '720px', margin: '24px auto', fontSize: '18px', lineHeight: '1.7', color: '#1B1F2A' }}>
                                <div style={{ whiteSpace: 'pre-wrap', marginBottom: '20px' }}>
                                    {content || '[Article body paragraphs will appear here...]'}
                                </div>

                                {pull_quote && (
                                    <figure style={{ margin: '32px 0', padding: '16px 0', textAlign: 'center', borderTop: '1px solid #E3E6EC', borderBottom: '1px solid #E3E6EC' }}>
                                        <blockquote style={{ margin: 0, fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: '600', fontSize: '26px', lineHeight: '1.4', color: '#A3192F' }}>
                                            "{pull_quote}"
                                        </blockquote>
                                        {pull_quote_author && (
                                            <figcaption style={{ marginTop: '8px', fontSize: '14px', color: '#4A5163' }}>
                                                — {pull_quote_author}
                                            </figcaption>
                                        )}
                                    </figure>
                                )}

                                {title2 && (
                                    <h2 style={{ margin: '28px 0 12px', fontFamily: "'Source Serif 4', Georgia, serif", fontSize: '28px', color: '#13294B' }}>
                                        {title2}
                                    </h2>
                                )}
                                {content2 && (
                                    <div style={{ whiteSpace: 'pre-wrap', marginBottom: '20px' }}>
                                        {content2}
                                    </div>
                                )}

                                {concluding_insight && (
                                    <div style={{ background: '#F4F5F8', borderRadius: '12px', padding: '24px 28px', marginTop: '32px' }}>
                                        <p style={{ margin: '0 0 8px', fontSize: '13px', letterSpacing: '3px', fontWeight: '700', color: '#13294B' }}>
                                            CONCLUDING INSIGHT
                                        </p>
                                        <p style={{ margin: 0, color: '#1B1F2A', fontSize: '17px', lineHeight: '1.6' }}>
                                            {concluding_insight}
                                        </p>
                                    </div>
                                )}

                                {related_to_book && (
                                    <div style={{ background: '#13294B', color: '#ffffff', borderRadius: '14px', padding: '24px', marginTop: '36px', display: 'flex', gap: '20px', alignItems: 'center' }}>
                                        <div style={{ fontSize: '32px' }}>📖</div>
                                        <div>
                                            <h4 style={{ margin: '0 0 6px', color: '#ffffff' }}>From Marketing Reclassified</h4>
                                            <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#E4E8F0' }}>
                                                {book_concept || 'This article connects with core strategic intelligence principles from Marketing Reclassified.'}
                                            </p>
                                            <span style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff', textDecoration: 'underline' }}>
                                                Explore the Book →
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* EDIT FORM */
                        <form onSubmit={handleSubmit} className="blog-form" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                            {/* SECTION 1: CORE ARTICLE DETAILS */}
                            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
                                    📰 1. Core Article Information
                                </h3>

                                <div className="form-group" style={{ marginBottom: '14px' }}>
                                    <label htmlFor="blog-title">Article Headline / Title *</label>
                                    <input
                                        id="blog-title"
                                        type="text"
                                        value={title}
                                        onChange={(e) => handleTitleChange(e.target.value)}
                                        placeholder="e.g. Why Strategic Marketing Must Challenge Assumptions"
                                        required
                                        style={{ fontSize: '1rem', fontWeight: '600' }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '14px' }}>
                                    <div className="form-group">
                                        <label htmlFor="blog-slug">URL Slug</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <input
                                                id="blog-slug"
                                                type="text"
                                                value={slug}
                                                onChange={(e) => setSlug(deriveSlug(e.target.value))}
                                                placeholder="e.g. why-strategic-marketing-must-challenge-assumptions"
                                            />
                                            <button
                                                type="button"
                                                className="btn btn--outline btn--sm"
                                                onClick={() => setSlug(deriveSlug(title))}
                                                title="Re-generate slug from headline"
                                            >
                                                Auto
                                            </button>
                                        </div>
                                        <small style={{ color: 'var(--text-muted)' }}>Public link: /blogs/{slug || 'slug'}</small>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="blog-topic">Primary Category *</label>
                                        <select
                                            id="blog-topic"
                                            value={topic}
                                            onChange={(e) => setTopic(e.target.value)}
                                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
                                        >
                                            {REFERENCE_CATEGORIES.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Secondary Categories Pills */}
                                <div className="form-group" style={{ marginBottom: '14px' }}>
                                    <label>Secondary Categories / Topics</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                        {secondaryCategories.map(cat => (
                                            <span key={cat} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '4px 10px', borderRadius: '16px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                {cat}
                                                <button type="button" onClick={() => removeCategory(cat)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}>×</button>
                                            </span>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="text"
                                            value={catSearch}
                                            onChange={e => setCatSearch(e.target.value)}
                                            placeholder="Type and select from suggestions below..."
                                        />
                                        {catSearch.trim() && (
                                            <button type="button" className="btn btn--outline btn--sm" onClick={() => toggleCategory(catSearch)}>
                                                + Add Tag
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                        {REFERENCE_CATEGORIES.filter(c => c !== topic && !secondaryCategories.includes(c)).map(cat => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => toggleCategory(cat)}
                                                style={{ background: 'var(--bg-input)', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                                            >
                                                + {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '14px' }}>
                                    <div className="form-group">
                                        <label htmlFor="blog-byline">Author Byline</label>
                                        <input
                                            id="blog-byline"
                                            type="text"
                                            value={author_byline}
                                            onChange={(e) => setAuthorByline(e.target.value)}
                                            placeholder="By M. Q. Siddiqui, Founder, Siddiqui.digital"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="blog-reading-time">Reading Time</label>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <input
                                                id="blog-reading-time"
                                                type="text"
                                                value={reading_time}
                                                onChange={(e) => setReadingTime(e.target.value)}
                                                placeholder="e.g. 5 min read"
                                            />
                                            <button
                                                type="button"
                                                className="btn btn--outline btn--sm"
                                                onClick={() => updateAutoReadingTime(content, title)}
                                                title="Calculate reading time from body"
                                            >
                                                Recalc
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '14px' }}>
                                    <label htmlFor="blog-standfirst">Standfirst / Short Introduction (1–2 sentences setting up the argument)</label>
                                    <textarea
                                        id="blog-standfirst"
                                        rows={2}
                                        value={standfirst}
                                        onChange={(e) => setStandfirst(e.target.value)}
                                        placeholder="One or two sentences displayed prominently below headline..."
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="blog-summary">Card Excerpt / Search Summary</label>
                                    <textarea
                                        id="blog-summary"
                                        rows={2}
                                        value={summary}
                                        onChange={(e) => setSummary(e.target.value)}
                                        placeholder="Concise summary displayed on the blog archive grid and search results..."
                                    />
                                </div>
                            </div>

                            {/* SECTION 2: EDITORIAL CONTENT & CALLOUTS */}
                            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
                                    ✍️ 2. Editorial Body & Structure
                                </h3>

                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label htmlFor="blog-content">Full Article Body *</label>
                                    <textarea
                                        id="blog-content"
                                        rows={12}
                                        value={content}
                                        onChange={(e) => {
                                            setContent(e.target.value);
                                            updateAutoReadingTime(e.target.value, title);
                                        }}
                                        placeholder="Write the full article text. Paragraphs and subheadings can be added here..."
                                        required
                                        style={{ fontFamily: 'inherit', fontSize: '0.95rem', lineHeight: '1.6' }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                                    <div className="form-group">
                                        <label htmlFor="blog-pull-quote">Optional Pull Quote</label>
                                        <textarea
                                            id="blog-pull-quote"
                                            rows={2}
                                            value={pull_quote}
                                            onChange={(e) => setPullQuote(e.target.value)}
                                            placeholder="Prominent quote highlighted in editorial serif font..."
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="blog-quote-author">Pull Quote Attribution</label>
                                        <input
                                            id="blog-quote-author"
                                            type="text"
                                            value={pull_quote_author}
                                            onChange={(e) => setPullQuoteAuthor(e.target.value)}
                                            placeholder="e.g. M. Q. Siddiqui, Marketing Reclassified"
                                        />
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label htmlFor="blog-concluding-insight">Concluding Insight (The single core idea reader takes away)</label>
                                    <textarea
                                        id="blog-concluding-insight"
                                        rows={2}
                                        value={concluding_insight}
                                        onChange={(e) => setConcludingInsight(e.target.value)}
                                        placeholder="Highlight panel summarizing the concluding perspective..."
                                    />
                                </div>

                                {/* Backward compatibility: Subheading 2 & Content 2 */}
                                <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '14px' }}>
                                    <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                                        Optional Additional Sub-Section (Legacy compatibility)
                                    </small>
                                    <div className="form-group" style={{ marginBottom: '10px' }}>
                                        <input
                                            type="text"
                                            value={title2}
                                            onChange={(e) => setTitle2(e.target.value)}
                                            placeholder="Second Subheading (optional)"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <textarea
                                            rows={4}
                                            value={content2}
                                            onChange={(e) => setContent2(e.target.value)}
                                            placeholder="Content under second subheading (optional)..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 3: FEATURED IMAGE & ACCESSIBILITY */}
                            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
                                    🖼️ 3. Featured Image & Captions
                                </h3>

                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label>Article Cover Image</label>
                                    <div className="image-upload">
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                            onChange={handleImageChange}
                                            className="image-upload__input"
                                        />
                                        <div className="image-upload__area" style={{ maxHeight: '220px', overflow: 'hidden' }}>
                                            {preview ? (
                                                <img src={preview} alt="Preview" className="image-upload__preview" style={{ maxHeight: '200px', objectFit: 'contain' }} />
                                            ) : (
                                                <div className="image-upload__placeholder">
                                                    <span>📷</span>
                                                    <p>Click or drag to upload article cover image</p>
                                                    <small>JPEG, PNG, WebP, GIF (max 5MB)</small>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                                    <div className="form-group">
                                        <label htmlFor="blog-img-alt">Image Alt Text (for accessibility)</label>
                                        <input
                                            id="blog-img-alt"
                                            type="text"
                                            value={image_alt}
                                            onChange={(e) => setImageAlt(e.target.value)}
                                            placeholder="Descriptive text for screen readers..."
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="blog-img-caption">Image Caption (displayed under image)</label>
                                        <input
                                            id="blog-img-caption"
                                            type="text"
                                            value={image_caption}
                                            onChange={(e) => setImageCaption(e.target.value)}
                                            placeholder="Optional caption..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 4: MARKETING RECLASSIFIED PANEL & RELATED ARTICLES */}
                            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
                                    🔗 4. Marketing Reclassified & Related Articles
                                </h3>

                                <div style={{ marginBottom: '20px', padding: '14px', background: 'rgba(19, 41, 75, 0.08)', borderRadius: '8px', border: '1px solid rgba(19, 41, 75, 0.2)' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '700', color: '#13294B' }}>
                                        <input
                                            type="checkbox"
                                            checked={related_to_book}
                                            onChange={(e) => setRelatedToBook(e.target.checked)}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        Display "From Marketing Reclassified" Panel on this Article
                                    </label>
                                    <p style={{ margin: '6px 0 10px 28px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                        When checked, a dedicated book concept panel linking to Marketing Reclassified will render on this article.
                                    </p>

                                    {related_to_book && (
                                        <div style={{ marginLeft: '28px' }}>
                                            <label htmlFor="blog-book-concept">Book Concept / Note</label>
                                            <textarea
                                                id="blog-book-concept"
                                                rows={2}
                                                value={book_concept}
                                                onChange={(e) => setBookConcept(e.target.value)}
                                                placeholder="Explain how this article relates to the frameworks in Marketing Reclassified..."
                                            />
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                                        Select up to 3 Related Published Articles
                                    </label>
                                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', background: 'var(--bg-input)' }}>
                                        {otherBlogs.length === 0 ? (
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No other articles available.</p>
                                        ) : (
                                            otherBlogs.map(b => (
                                                <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', fontSize: '0.85rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRelatedIds.includes(String(b.id))}
                                                        onChange={() => toggleRelatedBlog(b.id)}
                                                    />
                                                    <span style={{ fontWeight: '600' }}>{b.title}</span>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({b.topic || 'General'})</span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                    <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                        {selectedRelatedIds.length} of 3 articles selected. If none selected, the 3 newest articles in the same topic will display automatically.
                                    </small>
                                </div>
                            </div>

                            {/* SECTION 5: PUBLISHING & SCHEDULING */}
                            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
                                    🚀 5. Publishing Status & Scheduling
                                </h3>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                                    <div className="form-group">
                                        <label htmlFor="blog-status">Publication Status *</label>
                                        <select
                                            id="blog-status"
                                            value={status}
                                            onChange={(e) => setStatus(e.target.value)}
                                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
                                        >
                                            <option value="published">Published (Visible immediately)</option>
                                            <option value="draft">Draft (Private, not public)</option>
                                            <option value="scheduled">Scheduled (Publishes at future date)</option>
                                            <option value="unpublished">Unpublished (Archived from public)</option>
                                        </select>
                                    </div>

                                    {status === 'scheduled' && (
                                        <div className="form-group">
                                            <label htmlFor="blog-scheduled-for">Schedule Publication Date & Time *</label>
                                            <input
                                                id="blog-scheduled-for"
                                                type="datetime-local"
                                                value={scheduled_for}
                                                onChange={(e) => setScheduledFor(e.target.value)}
                                                required={status === 'scheduled'}
                                            />
                                        </div>
                                    )}

                                    <div className="form-group">
                                        <label htmlFor="blog-published-date">Display Publication Date</label>
                                        <input
                                            id="blog-published-date"
                                            type="date"
                                            value={published_date}
                                            onChange={(e) => setPublishedDate(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div style={{ padding: '10px 14px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', color: '#f59e0b' }}>
                                        <input
                                            type="checkbox"
                                            checked={is_featured}
                                            onChange={(e) => setIsFeatured(e.target.checked)}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        Feature this article prominently on Blog Homepage
                                    </label>
                                    <small style={{ color: 'var(--text-muted)', display: 'block', marginLeft: '26px' }}>
                                        Only published articles can be featured publicly.
                                    </small>
                                </div>
                            </div>

                            {/* SECTION 6: SEO METADATA */}
                            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
                                    🔍 6. Search Engine Optimization (SEO)
                                </h3>

                                <div className="form-group" style={{ marginBottom: '14px' }}>
                                    <label htmlFor="blog-seo-title">SEO Title (Browser & Search Snippet)</label>
                                    <input
                                        id="blog-seo-title"
                                        type="text"
                                        value={seo_title}
                                        onChange={(e) => setSeoTitle(e.target.value)}
                                        placeholder={title || 'e.g. Why Strategic Marketing Must Challenge Assumptions | Siddiqui.digital'}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="blog-seo-desc">Meta Description (150–160 characters recommended)</label>
                                    <textarea
                                        id="blog-seo-desc"
                                        rows={2}
                                        value={seo_description}
                                        onChange={(e) => setSeoDescription(e.target.value)}
                                        placeholder={summary || 'A compelling summary for search results...'}
                                    />
                                    <small style={{ color: 'var(--text-muted)' }}>{seo_description.length} characters</small>
                                </div>
                            </div>

                            {/* FORM ACTIONS */}
                            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                                <button
                                    type="button"
                                    className="btn btn--ghost"
                                    onClick={onCancel}
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn--primary"
                                    disabled={submitting}
                                    style={{ minWidth: '150px' }}
                                >
                                    {submitting ? 'Saving...' : blog ? 'Update Article' : (status === 'draft' ? 'Save Draft' : 'Publish Article')}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
