import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { uploadEditorImage } from '../../services/blogService';
import toast from 'react-hot-toast';

export default function RichTextEditor({ content, onChange, placeholder = 'Write your editorial article here...' }) {
    const fileInputRef = useRef(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [2, 3, 4],
                },
            }),
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    class: 'editorial-link',
                },
            }),
            Image.configure({
                HTMLAttributes: {
                    class: 'editorial-image',
                },
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Placeholder.configure({
                placeholder,
            }),
        ],
        content: content || '',
        onUpdate: ({ editor: ed }) => {
            const html = ed.getHTML();
            if (onChange) {
                onChange(html);
            }
        },
    });

    // Synchronize editor content when external content changes (e.g. DOCX import or blog switch)
    useEffect(() => {
        if (!editor) return;
        const currentHtml = editor.getHTML();
        if (content !== undefined && content !== currentHtml) {
            // Check if content is plain text vs HTML
            const isHtml = /<\/?(p|h[1-6]|ul|ol|li|blockquote|strong|b|em|i|u|s|span|div|a|img|hr)[^>]*>/i.test(content || '');
            if (!isHtml && content) {
                // Convert plain text paragraphs into HTML paragraphs for TipTap
                const converted = content
                    .split(/\n\s*\n/)
                    .map(p => `<p>${p.trim().replace(/\n/g, '<br />')}</p>`)
                    .join('');
                editor.commands.setContent(converted, false);
            } else {
                editor.commands.setContent(content || '', false);
            }
        }
    }, [content, editor]);

    // File image upload handler
    const handleImageFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please select a valid image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size must be under 5MB');
            return;
        }

        try {
            setUploadingImage(true);
            const loadingToast = toast.loading('Uploading inline image...');
            const publicUrl = await uploadEditorImage(file);
            toast.dismiss(loadingToast);

            if (publicUrl && editor) {
                editor.chain().focus().setImage({ src: publicUrl, alt: file.name }).run();
                toast.success('Image inserted');
            }
        } catch (err) {
            console.error('Failed to upload editor image:', err);
            toast.error(err?.message || 'Failed to upload image');
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Link modal handlers
    const openLinkModal = () => {
        if (!editor) return;
        const previousUrl = editor.getAttributes('link').href || '';
        setLinkUrl(previousUrl);
        setLinkModalOpen(true);
    };

    const applyLink = () => {
        if (!editor) return;
        if (linkUrl.trim() === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
            let formattedUrl = linkUrl.trim();
            if (!/^https?:\/\//i.test(formattedUrl) && !formattedUrl.startsWith('/') && !formattedUrl.startsWith('#')) {
                formattedUrl = 'https://' + formattedUrl;
            }
            editor.chain().focus().extendMarkRange('link').setLink({ href: formattedUrl }).run();
        }
        setLinkModalOpen(false);
        setLinkUrl('');
    };

    const removeLink = () => {
        if (!editor) return;
        editor.chain().focus().unsetLink().run();
        setLinkModalOpen(false);
        setLinkUrl('');
    };

    if (!editor) {
        return (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading editor...
            </div>
        );
    }

    // Word count calculation
    const textContent = editor.getText();
    const words = textContent.trim() ? textContent.trim().split(/\s+/).length : 0;
    const chars = textContent.length;

    return (
        <div className="tiptap-editor-wrapper">
            {/* HIDDEN FILE INPUT FOR IMAGE INSERT */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handleImageFileChange}
            />

            {/* TOOLBAR */}
            <div className="tiptap-toolbar" role="toolbar" aria-label="Editor Formatting Options">
                {/* HEADINGS / PARAGRAPH */}
                <div className="tiptap-toolbar-group">
                    <button
                        type="button"
                        className={`tiptap-toolbar-btn ${editor.isActive('paragraph') ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().setParagraph().run()}
                        title="Normal Paragraph"
                    >
                        P
                    </button>
                    <button
                        type="button"
                        className={`tiptap-toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        title="Heading 2"
                    >
                        H2
                    </button>
                    <button
                        type="button"
                        className={`tiptap-toolbar-btn ${editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        title="Heading 3"
                    >
                        H3
                    </button>
                    <button
                        type="button"
                        className={`tiptap-toolbar-btn ${editor.isActive('heading', { level: 4 }) ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                        title="Heading 4"
                    >
                        H4
                    </button>
                </div>

                <div className="tiptap-toolbar-divider" />

                {/* TEXT STYLES */}
                <div className="tiptap-toolbar-group">
                    <button
                        type="button"
                        className={`tiptap-toolbar-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        title="Bold (Ctrl+B)"
                    >
                        <strong>B</strong>
                    </button>
                    <button
                        type="button"
                        className={`tiptap-toolbar-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        title="Italic (Ctrl+I)"
                    >
                        <em>I</em>
                    </button>
                    <button
                        type="button"
                        className={`tiptap-toolbar-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        title="Underline (Ctrl+U)"
                    >
                        <u>U</u>
                    </button>
                    <button
                        type="button"
                        className={`tiptap-toolbar-btn ${editor.isActive('strike') ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        title="Strikethrough"
                    >
                        <s>S</s>
                    </button>
                </div>

                <div className="tiptap-toolbar-divider" />

                {/* LISTS */}
                <div className="tiptap-toolbar-group">
                    <button
                        type="button"
                        className={`tiptap-toolbar-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        title="Bullet List"
                    >
                        • List
                    </button>
                    <button
                        type="button"
                        className={`tiptap-toolbar-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        title="Numbered List"
                    >
                        1. List
                    </button>
                    <button
                        type="button"
                        className={`tiptap-toolbar-btn ${editor.isActive('blockquote') ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        title="Blockquote"
                    >
                        ❝ Quote
                    </button>
                    <button
                        type="button"
                        className="tiptap-toolbar-btn"
                        onClick={() => editor.chain().focus().setHorizontalRule().run()}
                        title="Divider Line"
                    >
                        ― HR
                    </button>
                </div>

                <div className="tiptap-toolbar-divider" />

                {/* ALIGNMENT */}
                <div className="tiptap-toolbar-group">
                    <button
                        type="button"
                        className={`tiptap-toolbar-btn ${editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().setTextAlign('left').run()}
                        title="Align Left"
                    >
                        ⯈ Left
                    </button>
                    <button
                        type="button"
                        className={`tiptap-toolbar-btn ${editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().setTextAlign('center').run()}
                        title="Align Center"
                    >
                        ≡ Center
                    </button>
                    <button
                        type="button"
                        className={`tiptap-toolbar-btn ${editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}`}
                        onClick={() => editor.chain().focus().setTextAlign('right').run()}
                        title="Align Right"
                    >
                        ⯇ Right
                    </button>
                </div>

                <div className="tiptap-toolbar-divider" />

                {/* INSERTS: LINK & IMAGE */}
                <div className="tiptap-toolbar-group">
                    <button
                        type="button"
                        className={`tiptap-toolbar-btn ${editor.isActive('link') ? 'is-active' : ''}`}
                        onClick={openLinkModal}
                        title="Insert / Edit Link"
                    >
                        🔗 Link
                    </button>
                    <button
                        type="button"
                        className="tiptap-toolbar-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        title="Upload & Insert Inline Image"
                    >
                        {uploadingImage ? '⏳ Uploading...' : '🖼️ Image'}
                    </button>
                </div>

                <div className="tiptap-toolbar-divider" />

                {/* UNDO / REDO */}
                <div className="tiptap-toolbar-group">
                    <button
                        type="button"
                        className="tiptap-toolbar-btn"
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().undo()}
                        title="Undo (Ctrl+Z)"
                    >
                        ↶
                    </button>
                    <button
                        type="button"
                        className="tiptap-toolbar-btn"
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().redo()}
                        title="Redo (Ctrl+Y)"
                    >
                        ↷
                    </button>
                </div>
            </div>

            {/* LINK POPUP MODAL */}
            {linkModalOpen && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        backdropFilter: 'blur(3px)',
                        zIndex: 99999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px'
                    }}
                    onClick={() => setLinkModalOpen(false)}
                >
                    <div
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '24px',
                            width: '100%',
                            maxWidth: '440px',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                            Insert / Edit Link
                        </h4>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                URL Address
                            </label>
                            <input
                                type="url"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                placeholder="https://example.com"
                                autoFocus
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-primary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem'
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        applyLink();
                                    }
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {editor.isActive('link') ? (
                                <button
                                    type="button"
                                    onClick={removeLink}
                                    className="btn btn--outline btn--sm"
                                    style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                                >
                                    Remove Link
                                </button>
                            ) : <span />}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setLinkModalOpen(false)}
                                    className="btn btn--ghost btn--sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={applyLink}
                                    className="btn btn--primary btn--sm"
                                >
                                    Apply
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* EDITOR CONTENT AREA */}
            <div className="tiptap-content-container">
                <EditorContent editor={editor} className="tiptap-content" />
            </div>

            {/* STATUS / STATS FOOTER */}
            <div className="tiptap-footer">
                <span>{words} {words === 1 ? 'word' : 'words'}</span>
                <span>•</span>
                <span>{chars} characters</span>
                <span>•</span>
                <span style={{ color: 'var(--text-muted)' }}>Tip: Press Enter for new paragraph, Shift+Enter for line break</span>
            </div>
        </div>
    );
}
