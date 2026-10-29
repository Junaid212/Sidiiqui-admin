import { useState, useEffect, useRef } from 'react';
import { renderEditorialBody, renderHighlightBox, renderPullQuote, renderAuthorBox } from '../../utils/editorialRenderer';
import RichTextEditor from './RichTextEditor';
import DocxImporter from './DocxImporter';
import ZipImporterModal from './ZipImporterModal';
import ErrorBoundary from '../Common/ErrorBoundary';
import toast from 'react-hot-toast';

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
    // Word Document & ZIP Importers
    const [showDocxImporter, setShowDocxImporter] = useState(false);
    const [showZipImporter, setShowZipImporter] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

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

    // Repeatable sub-sections (up to 8 per article)
    const [subSections, setSubSections] = useState([]);

    // Editorial callouts
    const [pull_quote, setPullQuote] = useState('');
    const [pull_quote_author, setPullQuoteAuthor] = useState('');
    const [pullQuotePosition, setPullQuotePosition] = useState(1);
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

    // Social Links
    const [linkedin_url, setLinkedinUrl] = useState('');
    const [instagram_url, setInstagramUrl] = useState('');
    const [facebook_url, setFacebookUrl] = useState('');

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

    const MAX_SUB_SECTIONS = 8;

    function handleAddSubSection() {
        if (subSections.length >= MAX_SUB_SECTIONS) return;
        setSubSections(prev => [
            ...prev,
            {
                id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                heading: '',
                body: '',
                highlight_type: 'none',
                highlight_text: ''
            }
        ]);
    }

    function handleRemoveSubSection(index) {
        setSubSections(prev => {
            const next = prev.filter((_, i) => i !== index);
            if (pullQuotePosition > next.length && next.length > 0) {
                setPullQuotePosition(next.length);
            }
            return next;
        });
    }

    function handleMoveSubSection(index, direction) {
        const target = index + direction;
        if (target < 0 || target >= subSections.length) return;
        setSubSections(prev => {
            const copy = [...prev];
            const [item] = copy.splice(index, 1);
            copy.splice(target, 0, item);
            return copy;
        });
    }

    function handleUpdateSubSection(index, field, value) {
        setSubSections(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [field]: value };
            return copy;
        });
    }

    function insertBulletIntoSubSection(index) {
        setSubSections(prev => {
            const copy = [...prev];
            const currentBody = copy[index]?.body || '';
            const needsNewline = currentBody && !currentBody.endsWith('\n');
            copy[index] = {
                ...copy[index],
                body: `${currentBody}${needsNewline ? '\n' : ''}• `
            };
            return copy;
        });
    }

    function updateAutoReadingTime(bodyText, headline, subs = subSections) {
        const subsText = Array.isArray(subs) ? subs.map(s => `${s.heading || ''} ${s.body || ''}`).join(' ') : '';
        const words = `${headline || ''} ${standfirst || ''} ${bodyText || ''} ${subsText}`.trim().split(/\s+/).filter(Boolean).length;
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

            // Populate repeatable sub-sections with automatic legacy migration
            let initialSubs = [];
            if (Array.isArray(blog.sub_sections) && blog.sub_sections.length > 0) {
                initialSubs = blog.sub_sections;
            } else if (typeof blog.sub_sections === 'string') {
                try {
                    const parsed = JSON.parse(blog.sub_sections);
                    if (Array.isArray(parsed) && parsed.length > 0) initialSubs = parsed;
                } catch (_) {}
            }

            // Move legacy Additional Sub-Section (title2 / content2) into Sub-section 1
            if (initialSubs.length === 0 && (blog.title2 || blog.content2)) {
                initialSubs = [
                    {
                        id: 'sub-legacy-1',
                        heading: blog.title2 || '',
                        body: blog.content2 || '',
                        highlight_type: 'none',
                        highlight_text: ''
                    }
                ];
            }

            setSubSections(initialSubs);
            setPullQuotePosition(blog.pull_quote_position !== undefined && blog.pull_quote_position !== null ? Number(blog.pull_quote_position) : 1);

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

            setLinkedinUrl(blog.linkedin_url || '');
            setInstagramUrl(blog.instagram_url || '');
            setFacebookUrl(blog.facebook_url || '');
        } else {
            setPublishedDate(new Date().toISOString().split('T')[0]);
            setReadingTime('3 min read');
            setSubSections([]);
            setPullQuotePosition(1);
            setLinkedinUrl('');
            setInstagramUrl('');
            setFacebookUrl('');
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
            return prev.filter(id => id !== idStr);
        }

        return [...prev, idStr];
    });
}

    // Handle Word Document Import result
    function handleDocxImportComplete({ contentHtml, title: docTitle, wordCount }) {
        if (contentHtml) {
            setContent(contentHtml);
            updateAutoReadingTime(contentHtml, title || docTitle || '');
            setIsDirty(true);
        }
        if (docTitle) {
            setTitle(docTitle);
            if (!slug || slug === deriveSlug(title)) {
                setSlug(deriveSlug(docTitle));
            }
        }
    }

    // Handle loading a selected article from ZIP import into the current form
    function handleLoadZipArticle(article) {
        if (!article) return;
        if (article.title) setTitle(article.title);
        if (article.slug) setSlug(article.slug);
        if (article.topic) setTopic(article.topic);
        if (Array.isArray(article.topic2)) setSecondaryCategories(article.topic2);
        if (article.published_date) setPublishedDate(article.published_date);
        if (article.reading_time) setReadingTime(article.reading_time);
        if (article.author_byline) setAuthorByline(article.author_byline);
        if (article.summary) setSummary(article.summary);
        if (article.standfirst) setStandfirst(article.standfirst);
        if (article.content) setContent(article.content);
        if (Array.isArray(article.sub_sections)) setSubSections(article.sub_sections);
        if (article.pull_quote) setPullQuote(article.pull_quote);
        if (article.pull_quote_author) setPullQuoteAuthor(article.pull_quote_author);
        if (article.pull_quote_position !== undefined) setPullQuotePosition(Number(article.pull_quote_position));
        if (article.concluding_insight) setConcludingInsight(article.concluding_insight);
        if (article.image_url) {
            setPreview(article.image_url);
        }
        if (article.status) setStatus(article.status);
        if (article.scheduled_for) setScheduledFor(article.scheduled_for);
        if (article.seo_title) setSeoTitle(article.seo_title);
        if (article.seo_description) setSeoDescription(article.seo_description);
        setIsDirty(true);
    }

    // Unsaved changes confirmation check on cancel
    function safeCancel() {
        if (isDirty) {
            if (!window.confirm('You have unsaved changes in this article. Are you sure you want to discard them and exit?')) {
                return;
            }
        }
        onCancel();
    }

    // Handles form actions (Draft, Scheduled, Published, or Save Changes)
    async function handleActionSubmit(targetStatus) {
        const effectiveStatus = targetStatus || status;
        const trimmedTitle = title.trim();
        const trimmedContent = (content || '').trim();

        if (!trimmedTitle) {
            toast.error('Article Headline / Title is required.');
            return;
        }

        const strippedText = trimmedContent.replace(/<[^>]*>/g, '').trim();
        if (!strippedText && !trimmedContent) {
            toast.error('Article Content cannot be empty.');
            return;
        }

        const derivedSlugVal = deriveSlug(slug || trimmedTitle);
        if (!derivedSlugVal) {
            toast.error('URL slug could not be generated.');
            return;
        }

        // Slug uniqueness check against allBlogs
        const duplicateSlug = (allBlogs || []).find(b =>
            (!blog || String(b.id) !== String(blog.id)) &&
            b.slug && b.slug.toLowerCase() === derivedSlugVal.toLowerCase()
        );
        if (duplicateSlug) {
            toast.error(`The slug "${derivedSlugVal}" is already in use by another article. Please use a unique title or slug.`);
            return;
        }

        if (effectiveStatus === 'scheduled' && !scheduled_for) {
            toast.error('Please specify a scheduled publication date and time.');
        }

        setSubmitting(true);
        try {
            const topic2String = secondaryCategories.map(c => c.trim()).filter(Boolean).join(', ');

            const formData = {
                title: trimmedTitle,
                slug: derivedSlugVal,
                topic,
                topic2: topic2String,
                published_date: published_date || new Date().toISOString().split('T')[0],
                reading_time: reading_time || '4 min read',
                author_byline: author_byline.trim(),

                standfirst: standfirst.trim(),
                summary: summary.trim(),
                content,
                sub_sections: subSections,
                pull_quote_position: pullQuotePosition,
                title2: subSections[0]?.heading ? subSections[0].heading.trim() : '',
                content2: subSections[0]?.body || '',

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

                status: effectiveStatus,
                scheduled_for: effectiveStatus === 'scheduled' ? scheduled_for : null,
                is_featured,

                seo_title: seo_title.trim(),
                seo_description: seo_description.trim(),

                linkedin_url: linkedin_url.trim(),
                instagram_url: instagram_url.trim(),
                facebook_url: facebook_url.trim(),
            };

            await onSubmit(formData);
            setIsDirty(false);
        } catch (err) {
            console.error('Submit error:', err);
            toast.error(err?.message || 'Failed to save article');
        } finally {
            setSubmitting(false);
        }
    }

    function handleSubmit(e) {
        if (e?.preventDefault) e.preventDefault();
        handleActionSubmit(status);
    }

    const inputStyle = {
    // width: '100%',
    padding: '8px 10px',
    background: '#141420',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#f3f4f6',
    fontSize: '0.85rem',
    outline: 'none',
    boxSizing: 'border-box'
};

    // Filterable other blogs for related articles
    const otherBlogs = (allBlogs || []).filter(b => !blog || String(b.id) !== String(blog.id));

    return (
        <div className="modal-overlay" onClick={safeCancel} style={{ zIndex: 1050 }}>
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
                    <button className="modal__close" onClick={safeCancel} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>×</button>
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
                                {/* 1. Full Article Body */}
                                <div style={{ marginBottom: '24px' }}>
                                    {renderEditorialBody(content || '[Article body paragraphs will appear here...]')}
                                </div>

                                {/* Pull quote if placed after Full Article Body (position 0) */}
                                {pullQuotePosition === 0 && pull_quote && renderPullQuote(pull_quote, pull_quote_author)}

                                {/* 2. Sub-sections in order set */}
                                {subSections.map((sub, idx) => (
                                    <div key={sub.id || idx}>
                                        {sub.heading && (
                                            <h2 style={{
                                                margin: '38px 0 16px',
                                                fontFamily: "'Source Serif 4', Georgia, serif",
                                                fontSize: '28px',
                                                lineHeight: 1.3,
                                                color: '#13294B',
                                                fontWeight: 700
                                            }}>
                                                {sub.heading}
                                            </h2>
                                        )}
                                        {renderEditorialBody(sub.body)}
                                        {renderHighlightBox(sub)}
                                        {pullQuotePosition === (idx + 1) && pull_quote && renderPullQuote(pull_quote, pull_quote_author)}
                                    </div>
                                ))}

                                {/* Fallback pull quote if placed beyond subSections length */}
                                {pullQuotePosition > subSections.length && subSections.length > 0 && pull_quote && renderPullQuote(pull_quote, pull_quote_author)}

                                {/* 3. Concluding Insight */}
                                {concluding_insight && (
                                    <div style={{ background: '#F4F5F8', borderRadius: '12px', padding: '24px 28px', marginTop: '36px' }}>
                                        <p style={{ margin: '0 0 8px', fontSize: '13px', letterSpacing: '3px', fontWeight: '700', color: '#13294B' }}>
                                            CONCLUDING INSIGHT
                                        </p>
                                        <p style={{ margin: 0, color: '#1B1F2A', fontSize: '17px', lineHeight: '1.6' }}>
                                            {concluding_insight}
                                        </p>
                                    </div>
                                )}

                                {/* 4. Author Box */}
                                {renderAuthorBox({ author_byline, linkedin_url, instagram_url, facebook_url })}

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
                                        style={inputStyle}
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
                                                style={inputStyle}
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
                                        <label htmlFor="blog-topic " >Primary Category *</label>
                                        <select
                                            id="blog-topic"
                                            value={topic}
                                            onChange={(e) => setTopic(e.target.value)}
                                            style={{ width: '100%', padding: '10px',color:"red", borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
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
                                            style={inputStyle}
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
                                            style={inputStyle}
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
                                                style={inputStyle}
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
                                        style={inputStyle}
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
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            {/* SECTION 2: EDITORIAL CONTENT & CALLOUTS */}
                            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                                    <h3 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
                                        ✍️ 2. Editorial Body & Structure
                                    </h3>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowZipImporter(true)}
                                            className="btn btn--outline btn--sm"
                                            style={{
                                                borderColor: 'var(--success, #10b981)',
                                                color: 'var(--success, #10b981)',
                                                fontWeight: '600',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '6px 14px',
                                                borderRadius: '6px'
                                            }}
                                            title="Import articles and images from ZIP archive"
                                        >
                                            <span>📦 Import ZIP</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowDocxImporter(true)}
                                            className="btn btn--outline btn--sm"
                                            style={{
                                                borderColor: 'var(--accent-primary)',
                                                color: 'var(--accent-primary)',
                                                fontWeight: '600',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '6px 14px',
                                                borderRadius: '6px'
                                            }}
                                            title="Import article structure, headings, text, and images from Microsoft Word document"
                                        >
                                            <span>📄 Import Word (.docx)</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <label style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
                                            Full Article Body *
                                        </label>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            Rich text with headings, bold/italic, lists, links & inline images
                                        </span>
                                    </div>
                                    <RichTextEditor
                                        content={content}
                                        onChange={(html) => {
                                            setContent(html);
                                            updateAutoReadingTime(html, title);
                                            setIsDirty(true);
                                        }}
                                        placeholder="Write your article body here, or use 'Import Word Document' above to import an existing .docx file..."
                                    />
                                </div>


                                {/* REPEATABLE SUB-SECTIONS (Up to 8) */}
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '18px', marginBottom: '22px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                                        <div>
                                            <label style={{ fontSize: '0.95rem', fontWeight: '700', display: 'block', margin: 0 }}>
                                                Sub-Sections ({subSections.length}/{MAX_SUB_SECTIONS})
                                            </label>
                                            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                                                Add repeatable editorial sections with subheadings, body paragraphs, and highlight boxes.
                                            </small>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleAddSubSection}
                                            disabled={subSections.length >= MAX_SUB_SECTIONS}
                                            className="btn btn--outline btn--sm"
                                            style={{
                                                borderColor: subSections.length >= MAX_SUB_SECTIONS ? 'var(--border-color)' : 'var(--accent-primary)',
                                                color: subSections.length >= MAX_SUB_SECTIONS ? 'var(--text-muted)' : 'var(--accent-primary)',
                                                fontWeight: '600',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <span>+ Add sub-section</span>
                                            {subSections.length >= MAX_SUB_SECTIONS && <small>(Max 8)</small>}
                                        </button>
                                    </div>

                                    {subSections.length === 0 ? (
                                        <div style={{
                                            border: '1px dashed var(--border-color)',
                                            borderRadius: '8px',
                                            padding: '24px',
                                            textAlign: 'center',
                                            color: 'var(--text-muted)',
                                            background: 'rgba(255, 255, 255, 0.01)'
                                        }}>
                                            <p style={{ margin: '0 0 10px', fontSize: '0.9rem' }}>No sub-sections added yet.</p>
                                            <button
                                                type="button"
                                                onClick={handleAddSubSection}
                                                className="btn btn--outline btn--sm"
                                            >
                                                + Add sub-section 1
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {subSections.map((sub, index) => (
                                                <div
                                                    key={sub.id || index}
                                                    style={{
                                                        background: 'var(--bg-card-secondary, rgba(255, 255, 255, 0.03))',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: '8px',
                                                        padding: '16px',
                                                        position: 'relative'
                                                    }}
                                                >
                                                    {/* Card Header with controls */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                                                        <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                            <span>📑 Sub-Section {index + 1}</span>
                                                            {sub.heading && (
                                                                <span style={{ fontWeight: 'normal', color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    — {sub.heading}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMoveSubSection(index, -1)}
                                                                disabled={index === 0}
                                                                className="btn btn--outline btn--sm"
                                                                style={{ padding: '3px 8px', fontSize: '0.78rem', opacity: index === 0 ? 0.4 : 1 }}
                                                                title="Move this sub-section up"
                                                            >
                                                                ▲ Move up
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMoveSubSection(index, 1)}
                                                                disabled={index === subSections.length - 1}
                                                                className="btn btn--outline btn--sm"
                                                                style={{ padding: '3px 8px', fontSize: '0.78rem', opacity: index === subSections.length - 1 ? 0.4 : 1 }}
                                                                title="Move this sub-section down"
                                                            >
                                                                ▼ Move down
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveSubSection(index)}
                                                                className="btn btn--outline btn--sm"
                                                                style={{ padding: '3px 8px', fontSize: '0.78rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                                                                title="Remove sub-section"
                                                            >
                                                                ✕ Remove
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Heading (one line) */}
                                                    <div className="form-group" style={{ marginBottom: '12px' }}>
                                                        <label style={{ fontSize: '0.82rem' }}>Subheading (H2, one line)</label>
                                                        <input
                                                            type="text"
                                                            value={sub.heading || ''}
                                                            onChange={(e) => handleUpdateSubSection(index, 'heading', e.target.value)}
                                                            placeholder={`e.g. Subheading for Section ${index + 1}`}
                                                            style={inputStyle}
                                                        />
                                                    </div>

                                                    {/* Body (multi-line, blank lines, bullets) */}
                                                    <div className="form-group" style={{ marginBottom: '14px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                            <label style={{ fontSize: '0.82rem', margin: 0 }}>
                                                                Body Content (keeps blank lines between paragraphs, • starts bullets)
                                                            </label>
                                                            <button
                                                                type="button"
                                                                onClick={() => insertBulletIntoSubSection(index)}
                                                                style={{
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    color: 'var(--accent-primary)',
                                                                    fontSize: '0.78rem',
                                                                    fontWeight: '600',
                                                                    cursor: 'pointer',
                                                                    padding: 0
                                                                }}
                                                                title="Insert a bullet point symbol at cursor"
                                                            >
                                                                + Insert Bullet (•)
                                                            </button>
                                                        </div>
                                                        <textarea
                                                            rows={5}
                                                            value={sub.body || ''}
                                                            onChange={(e) => {
                                                                handleUpdateSubSection(index, 'body', e.target.value);
                                                                updateAutoReadingTime(content, title);
                                                            }}
                                                            placeholder="Write sub-section body. Blank lines create paragraph breaks. Lines starting with • will render as styled bullet lists..."
                                                            style={{ fontFamily: 'inherit', fontSize: '0.9rem', lineHeight: '1.6', backgroundColor: '#141420', color: 'white', padding: '10px' }}
                                                        />
                                                    </div>

                                                    {/* Highlight (optional): None, Quote box or Question box, plus one line of text */}
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label style={{ fontSize: '0.8rem' }}>Highlight Box (optional)</label>
                                                            <select
                                                                value={sub.highlight_type || 'none'}
                                                                onChange={(e) => handleUpdateSubSection(index, 'highlight_type', e.target.value)}
                                                                style={{ width: '100%', padding: '8px 10px', color: "red", borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', fontSize: '0.85rem' }}
                                                            >
                                                                <option value="none">None</option>
                                                                <option value="quote">Quote box (light maroon)</option>
                                                                <option value="question">Question box (light gray)</option>
                                                            </select>
                                                        </div>

                                                        <div className="form-group" style={{ margin: 0 }}>
                                                            <label style={{ fontSize: '0.8rem' }}>Highlight Text (one line)</label>
                                                            <input
                                                                type="text"
                                                                value={sub.highlight_text || ''}
                                                                onChange={(e) => handleUpdateSubSection(index, 'highlight_text', e.target.value)}
                                                                disabled={!sub.highlight_type || sub.highlight_type === 'none'}
                                                                placeholder={
                                                                    sub.highlight_type === 'quote'
                                                                        ? "Enter quote text to highlight..."
                                                                        : sub.highlight_type === 'question'
                                                                        ? "Enter question to highlight..."
                                                                        : "Select Quote box or Question box to add text"
                                                                }
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* PULL QUOTE WITH PLACEMENT DROPDOWN */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label htmlFor="blog-pull-quote">Optional Pull Quote</label>
                                        <textarea
                                            id="blog-pull-quote"
                                            rows={2}
                                            value={pull_quote}
                                            onChange={(e) => setPullQuote(e.target.value)}
                                            placeholder="Prominent quote highlighted in editorial serif font..."
                                            style={inputStyle}
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
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="blog-pull-quote-pos">Pull Quote Placement</label>
                                        <select
                                            id="blog-pull-quote-pos"
                                            value={pullQuotePosition}
                                            onChange={(e) => setPullQuotePosition(Number(e.target.value))}
                                            style={{ width: '100%', padding: '10px', color: "#919191ff", borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
                                        >
                                            <option value={0}>After Full Article Body</option>
                                            {subSections.map((s, idx) => (
                                                <option key={idx} value={idx + 1}>
                                                    After Sub-section {idx + 1}{idx === 0 ? ' (Default)' : ''}{s.heading ? `: ${s.heading.length > 25 ? s.heading.substring(0, 25) + '…' : s.heading}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                                            Choose which sub-section this pull quote appears directly after (default: after sub-section 1).
                                        </small>
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
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            {/* SECTION 3: FEATURED IMAGE & ACCESSIBILITY */}
                            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
                                    🖼️ 3. Featured Image & Captions
                                </h3>

                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <label style={{ margin: 0 }}>Article Cover Image</label>
                                        {preview && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setImage(null);
                                                    setPreview(null);
                                                    setIsDirty(true);
                                                }}
                                                className="btn btn--ghost btn--sm"
                                                style={{ color: '#ef4444', fontSize: '0.78rem', padding: '2px 8px' }}
                                            >
                                                ✕ Remove Cover Image
                                            </button>
                                        )}
                                    </div>
                                    <div className="image-upload">
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                            onChange={(e) => {
                                                handleImageChange(e);
                                                setIsDirty(true);
                                            }}
                                            className="image-upload__input"
                                        />
                                        <div className="image-upload__area" style={{ maxHeight: '220px', overflow: 'hidden' }}>
                                            {preview ? (
                                                <div style={{ width: '100%', textAlign: 'center', padding: '10px' }}>
                                                    <img src={preview} alt="Preview" className="image-upload__preview" style={{ maxHeight: '180px', objectFit: 'contain' }} />
                                                    <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                        Click or drop new image to replace
                                                    </div>
                                                </div>
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
                                            style={inputStyle}
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
                                            style={inputStyle}
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
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '700', color: '#ffffffff' }}>
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
                                                style={inputStyle}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                                        Select Related Published Articles
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
                                        {selectedRelatedIds.length} articles selected. If none are selected, the 3 newest articles in the same topic will display automatically.
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
                                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: '#9f9f9fff' }}
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
                                            style={inputStyle}
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
                                        style={inputStyle}
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
                                        style={inputStyle}
                                    />
                                    <small style={{ color: 'var(--text-muted)' }}>{seo_description.length} characters</small>
                                </div>
                            </div>

                            {/* SECTION 7: SOCIAL MEDIA LINKS */}
                            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <h3 style={{ fontSize: '1.05rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
                                    🌐 7. Social Media Links (Optional)
                                </h3>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                    Add links to display on the blog card and blog post. If you leave a platform empty, its icon will NOT be shown on the blog card or main page.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div className="form-group">
                                        <label htmlFor="blog-linkedin-url" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ color: '#0A66C2', fontWeight: 'bold' }}>in</span> LinkedIn URL
                                        </label>
                                        <input
                                            id="blog-linkedin-url"
                                            type="url"
                                            value={linkedin_url}
                                            onChange={(e) => setLinkedinUrl(e.target.value)}
                                            placeholder="https://linkedin.com/in/username or post URL (leave blank to omit)"
                                            style={inputStyle}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="blog-instagram-url" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ color: '#E4405F', fontWeight: 'bold' }}>📷</span> Instagram URL
                                        </label>
                                        <input
                                            id="blog-instagram-url"
                                            type="url"
                                            value={instagram_url}
                                            onChange={(e) => setInstagramUrl(e.target.value)}
                                            placeholder="https://instagram.com/username or post URL (leave blank to omit)"
                                            style={inputStyle}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="blog-facebook-url" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ color: '#1877F2', fontWeight: 'bold' }}>f</span> Facebook URL
                                        </label>
                                        <input
                                            id="blog-facebook-url"
                                            type="url"
                                            value={facebook_url}
                                            onChange={(e) => setFacebookUrl(e.target.value)}
                                            placeholder="https://facebook.com/username or post URL (leave blank to omit)"
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* FORM ACTIONS */}
                            <div className="form-actions" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        type="button"
                                        className="btn btn--ghost"
                                        onClick={safeCancel}
                                        disabled={submitting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn--outline"
                                        onClick={() => setActiveTab('preview')}
                                    >
                                        👁️ Preview Article
                                    </button>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                                    {/* Save as Draft (private) */}
                                    <button
                                        type="button"
                                        className="btn btn--outline"
                                        onClick={() => handleActionSubmit('draft')}
                                        disabled={submitting}
                                        style={{ borderColor: '#64748b', color: '#cbd5e1' }}
                                        title="Save as private draft (hidden from public website)"
                                    >
                                        {submitting ? 'Saving...' : '💾 Save Draft'}
                                    </button>

                                    {/* Schedule button */}
                                    {status === 'scheduled' && (
                                        <button
                                            type="button"
                                            className="btn btn--primary"
                                            onClick={() => handleActionSubmit('scheduled')}
                                            disabled={submitting}
                                            style={{ background: '#3b82f6' }}
                                        >
                                            {submitting ? 'Scheduling...' : '⏰ Schedule Publication'}
                                        </button>
                                    )}

                                    {/* Action buttons depending on edit vs create and current status */}
                                    {blog ? (
                                        <>
                                            {status !== 'published' ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="btn btn--outline"
                                                        onClick={() => handleActionSubmit(status)}
                                                        disabled={submitting}
                                                        style={{ minWidth: '130px' }}
                                                        title="Save changes while keeping article unpublished/draft"
                                                    >
                                                        {submitting ? 'Saving...' : 'Save (Keep Unpublished)'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn--primary"
                                                        onClick={() => handleActionSubmit('published')}
                                                        disabled={submitting}
                                                        style={{ background: '#10b981', minWidth: '150px' }}
                                                        title="Publish this article immediately to the public website"
                                                    >
                                                        {submitting ? 'Publishing...' : '🚀 Publish to Website'}
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="btn btn--primary"
                                                    onClick={() => handleActionSubmit('published')}
                                                    disabled={submitting}
                                                    style={{ background: '#10b981', minWidth: '150px' }}
                                                    title="Save changes to the live published article"
                                                >
                                                    {submitting ? 'Updating...' : '💾 Update Live Article'}
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        status !== 'scheduled' && (
                                            <button
                                                type="button"
                                                className="btn btn--primary"
                                                onClick={() => handleActionSubmit('published')}
                                                disabled={submitting}
                                                style={{ background: '#10b981', minWidth: '160px' }}
                                                title="Publish this new article to the public website"
                                            >
                                                {submitting ? 'Publishing...' : '🚀 Publish Article'}
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        </form>
                    )}
                </div>

                {/* Word Document Importer Modal */}
                <DocxImporter
                    isOpen={showDocxImporter}
                    onClose={() => setShowDocxImporter(false)}
                    onImportComplete={handleDocxImportComplete}
                    currentTitle={title}
                />

                {/* ZIP Archive Importer Modal */}
                {showZipImporter && (
                    <ErrorBoundary onReset={() => setShowZipImporter(false)}>
                        <ZipImporterModal
                            isOpen={showZipImporter}
                            onClose={() => setShowZipImporter(false)}
                            onImportComplete={() => {
                                setShowZipImporter(false);
                                if (onCancel) onCancel();
                            }}
                            onLoadIntoEditor={handleLoadZipArticle}
                            isInsideEditor={true}
                        />
                    </ErrorBoundary>
                )}
            </div>
        </div>
    );
}
