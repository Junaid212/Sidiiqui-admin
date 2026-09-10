import { useState, useEffect, useRef } from 'react';

const SUGGESTED_CATEGORIES = [
    'SID Philosophy',
    'Marketing Reclassified',
    'Business Strategy',
    'Leadership',
    'Artificial Intelligence',
    'Higher Education',
    'Business Insights',
    'Professional Journey',
    'Books & Publications',
    'News & Updates',
];

export default function BlogForm({ blog, onSubmit, onCancel }) {
    const [title, setTitle] = useState('');
    const [topic, setTopic] = useState('');
    const [secondaryCategories, setSecondaryCategories] = useState([]);
    const [catSearch, setCatSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [published_date, setPublishedDate] = useState('');
    const [content, setContent] = useState('');
    const [title2, setTitle2] = useState('');
    const [content2, setContent2] = useState('');
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

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

    useEffect(() => {
        if (blog) {
            setTitle(blog.title || '');

            // Handle primary topic
            if (blog.topic && blog.topic.includes(',') && !blog.topic2) {
                const parts = blog.topic.split(',');
                setTopic(parts[0]?.trim() || '');
                const rest = parts.slice(1).map(p => p.trim()).filter(Boolean);
                setSecondaryCategories(rest);
            } else {
                setTopic(blog.topic || '');

                // Parse topic2 into array
                if (Array.isArray(blog.topic2)) {
                    setSecondaryCategories(blog.topic2.map(s => String(s).trim()).filter(Boolean));
                } else if (typeof blog.topic2 === 'string' && blog.topic2.trim()) {
                    setSecondaryCategories(blog.topic2.split(',').map(s => s.trim()).filter(Boolean));
                } else {
                    setSecondaryCategories([]);
                }
            }

            setPublishedDate(blog.published_date ? new Date(blog.published_date).toISOString().split('T')[0] : '');
            setContent(blog.content || '');
            setTitle2(blog.title2 || '');
            setContent2(blog.content2 || '');
            setPreview(blog.image_url || null);
        }
    }, [blog]);

    function handleImageChange(e) {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setPreview(URL.createObjectURL(file));
        }
    }

    function toggleCategory(cat) {
        const trimmed = cat.trim();
        if (!trimmed) return;

        setSecondaryCategories(prev => {
            const exists = prev.some(c => c.toLowerCase() === trimmed.toLowerCase());
            if (exists) {
                return prev.filter(c => c.toLowerCase() !== trimmed.toLowerCase());
            } else {
                return [...prev, trimmed];
            }
        });
        setCatSearch('');
    }

    function addCustomCategory() {
        const trimmed = catSearch.trim();
        if (!trimmed) return;

        setSecondaryCategories(prev => {
            const exists = prev.some(c => c.toLowerCase() === trimmed.toLowerCase());
            if (exists) return prev;
            return [...prev, trimmed];
        });
        setCatSearch('');
    }

    function removeCategory(catToRemove) {
        setSecondaryCategories(prev => prev.filter(c => c.toLowerCase() !== catToRemove.toLowerCase()));
    }

    function handleInputKeyDown(e) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            if (catSearch.trim()) {
                addCustomCategory();
            }
        } else if (e.key === 'Backspace' && !catSearch && secondaryCategories.length > 0) {
            // Remove last category on backspace when input is empty
            removeCategory(secondaryCategories[secondaryCategories.length - 1]);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return;

        setSubmitting(true);
        try {
            // Format secondary categories as clean comma-separated string for backend
            const topic2String = secondaryCategories.map(c => c.trim()).filter(Boolean).join(', ');

            const formData = {
                title,
                topic,
                topic2: topic2String,
                published_date,
                content,
                title2,
                content2,
                imageFile: image,
                image_url: preview,
                image_path: blog ? blog.image_path : null
            };
            await onSubmit(formData);
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    }

    // Dynamic list of categories: merges predefined + any already selected
    const allAvailableCategories = Array.from(
        new Set([...SUGGESTED_CATEGORIES, ...secondaryCategories])
    );

    const filteredCategories = allAvailableCategories.filter(cat =>
        cat.toLowerCase().includes(catSearch.toLowerCase().trim())
    );

    const canAddCustom =
        catSearch.trim().length > 0 &&
        !allAvailableCategories.some(c => c.toLowerCase() === catSearch.trim().toLowerCase());

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal__header">
                    <h2>{blog ? 'Edit Blog' : 'Create New Blog'}</h2>
                    <button className="modal__close" onClick={onCancel}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="blog-form">
                    <div className="form-group">
                        <label htmlFor="blog-title">Title</label>
                        <input
                            id="blog-title"
                            type="text"
                            className="form-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Enter blog title..."
                            required
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                        <div className="form-group">
                            <label htmlFor="blog-topic">Primary Category</label>
                            <input
                                id="blog-topic"
                                type="text"
                                className="form-input"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="e.g. Leadership"
                                list="category-suggestions"
                            />
                            <datalist id="category-suggestions">
                                {allAvailableCategories.map((c, idx) => (
                                    <option key={idx} value={c} />
                                ))}
                            </datalist>
                        </div>

                        {/* Multiple Select for Secondary Categories */}
                        <div className="form-group" ref={dropdownRef} style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <label style={{ marginBottom: 0 }}>
                                    Secondary Categories {secondaryCategories.length > 0 && `(${secondaryCategories.length})`}
                                </label>
                                {secondaryCategories.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setSecondaryCategories([])}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-secondary, #8b8ba7)',
                                            fontSize: '0.75rem',
                                            cursor: 'pointer',
                                            padding: '0 4px',
                                            textDecoration: 'underline'
                                        }}
                                    >
                                        Clear all
                                    </button>
                                )}
                            </div>

                            {/* Multi-select Input Box */}
                            <div
                                onClick={() => {
                                    setIsDropdownOpen(true);
                                    inputRef.current?.focus();
                                }}
                                style={{
                                    minHeight: '44px',
                                    padding: '6px 10px',
                                    borderRadius: 'var(--radius-md, 10px)',
                                    background: 'var(--bg-input, rgba(255,255,255,0.05))',
                                    border: isDropdownOpen
                                        ? '1px solid var(--border-active, #a78bfa)'
                                        : '1px solid var(--border-color, rgba(255,255,255,0.1))',
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: 'text',
                                    transition: 'border-color 0.2s, box-shadow 0.2s',
                                    boxShadow: isDropdownOpen ? '0 0 0 3px rgba(167, 139, 250, 0.15)' : 'none'
                                }}
                            >
                                {/* Selected tags */}
                                {secondaryCategories.map((cat) => (
                                    <span
                                        key={cat}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            background: 'rgba(59, 130, 246, 0.15)',
                                            color: '#60a5fa',
                                            border: '1px solid rgba(59, 130, 246, 0.3)',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.82rem',
                                            fontWeight: '500',
                                            lineHeight: 1.4
                                        }}
                                    >
                                        {cat}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeCategory(cat);
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#93c5fd',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                lineHeight: 1,
                                                padding: '0 2px',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                            title={`Remove ${cat}`}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}

                                {/* Search / Add input */}
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={catSearch}
                                    onChange={(e) => {
                                        setCatSearch(e.target.value);
                                        if (!isDropdownOpen) setIsDropdownOpen(true);
                                    }}
                                    onFocus={() => setIsDropdownOpen(true)}
                                    onKeyDown={handleInputKeyDown}
                                    placeholder={secondaryCategories.length === 0 ? "Select or type categories..." : "Add more..."}
                                    style={{
                                        border: 'none',
                                        background: 'transparent',
                                        color: 'var(--text-primary, #fff)',
                                        outline: 'none',
                                        fontSize: '0.88rem',
                                        flex: 1,
                                        minWidth: '120px',
                                        padding: '4px 2px'
                                    }}
                                />

                                <span
                                    style={{
                                        color: 'var(--text-secondary, #888)',
                                        fontSize: '0.75rem',
                                        pointerEvents: 'none',
                                        marginLeft: 'auto'
                                    }}
                                >
                                    {isDropdownOpen ? '▲' : '▼'}
                                </span>
                            </div>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 'calc(100% + 4px)',
                                        left: 0,
                                        right: 0,
                                        zIndex: 100,
                                        background: '#1a1a2e',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        borderRadius: '10px',
                                        boxShadow: '0 12px 28px rgba(0,0,0,0.5)',
                                        maxHeight: '220px',
                                        overflowY: 'auto',
                                        padding: '6px'
                                    }}
                                >
                                    {/* Option to create custom typed category */}
                                    {canAddCustom && (
                                        <div
                                            onClick={addCustomCategory}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                background: 'rgba(99, 102, 241, 0.15)',
                                                color: '#a5b4fc',
                                                fontSize: '0.86rem',
                                                fontWeight: '600',
                                                marginBottom: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <span>＋</span> Add "{catSearch.trim()}"
                                        </div>
                                    )}

                                    {/* Filtered suggestions list with checkboxes */}
                                    {filteredCategories.length === 0 && !canAddCustom ? (
                                        <div style={{ padding: '10px 12px', color: 'var(--text-secondary, #888)', fontSize: '0.85rem' }}>
                                            No categories match "{catSearch}"
                                        </div>
                                    ) : (
                                        filteredCategories.map((cat) => {
                                            const isSelected = secondaryCategories.some(
                                                c => c.toLowerCase() === cat.toLowerCase()
                                            );
                                            return (
                                                <div
                                                    key={cat}
                                                    onClick={() => toggleCategory(cat)}
                                                    style={{
                                                        padding: '7px 10px',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        fontSize: '0.86rem',
                                                        background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                                        color: isSelected ? '#93c5fd' : 'var(--text-primary, #e4e4ef)',
                                                        transition: 'background 0.15s'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span
                                                            style={{
                                                                width: '16px',
                                                                height: '16px',
                                                                borderRadius: '4px',
                                                                border: isSelected ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.3)',
                                                                background: isSelected ? '#3b82f6' : 'transparent',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '0.7rem',
                                                                color: '#fff'
                                                            }}
                                                        >
                                                            {isSelected && '✓'}
                                                        </span>
                                                        {cat}
                                                    </span>
                                                    {isSelected && (
                                                        <span style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: '500' }}>
                                                            Selected
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <small style={{ color: 'var(--text-secondary, #888)', fontSize: '0.8rem', marginTop: '-8px', marginBottom: '16px', display: 'block' }}>
                        💡 Select multiple secondary categories to interlink this blog so readers can find it under any of these categories on the website.
                    </small>

                    <div className="form-group">
                        <label htmlFor="blog-date">Publish Date</label>
                        <input
                            id="blog-date"
                            type="date"
                            className="form-input"
                            value={published_date}
                            onChange={(e) => setPublishedDate(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="blog-content">Primary Content</label>
                        <textarea
                            id="blog-content"
                            className="form-input form-textarea"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Write your main blog content here..."
                            rows="6"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="blog-title2">Secondary Title (Title 2)</label>
                        <input
                            id="blog-title2"
                            type="text"
                            className="form-input"
                            value={title2}
                            onChange={(e) => setTitle2(e.target.value)}
                            placeholder="Optional secondary heading..."
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="blog-content2">Secondary Content (Content 2)</label>
                        <textarea
                            id="blog-content2"
                            className="form-input form-textarea"
                            value={content2}
                            onChange={(e) => setContent2(e.target.value)}
                            placeholder="Write additional content here..."
                            rows="6"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="blog-image">Cover Image</label>
                        <div className="image-upload">
                            <input
                                id="blog-image"
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                onChange={handleImageChange}
                                className="image-upload__input"
                            />
                            <div className="image-upload__area">
                                {preview ? (
                                    <img src={preview} alt="Preview" className="image-upload__preview" />
                                ) : (
                                    <div className="image-upload__placeholder">
                                        <span>📷</span>
                                        <p>Click to upload image</p>
                                        <small>JPEG, PNG, WebP, GIF (max 5MB)</small>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="form-actions">
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
                        >
                            {submitting ? 'Saving...' : blog ? 'Update Blog' : 'Create Blog'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
