import { useState, useEffect } from 'react';

export default function BlogForm({ blog, onSubmit, onCancel }) {
    const [title, setTitle] = useState('');
    const [topic, setTopic] = useState('');
    const [published_date, setPublishedDate] = useState('');
    const [content, setContent] = useState('');
    const [title2, setTitle2] = useState('');
    const [content2, setContent2] = useState('');
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (blog) {
            setTitle(blog.title || '');
            setTopic(blog.topic || '');
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

    async function handleSubmit(e) {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return;

        setSubmitting(true);
        try {
            const formData = {
                title,
                topic,
                published_date,
                content,
                title2,
                content2,
                imageFile: image,
                image_url: preview, // pass the old one if unedited
                image_path: blog ? blog.image_path : null
            };
            await onSubmit(formData);
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    }

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

                    <div className="form-group">
                        <label htmlFor="blog-topic">Topic</label>
                        <input
                            id="blog-topic"
                            type="text"
                            className="form-input"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g. Technology, Health"
                        />
                    </div>

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
