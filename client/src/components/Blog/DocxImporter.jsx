import React, { useState, useRef } from 'react';
import mammoth from 'mammoth';
import DOMPurify from 'dompurify';
import { uploadBase64Image } from '../../services/blogService';
import toast from 'react-hot-toast';

export default function DocxImporter({ isOpen, onClose, onImportComplete, currentTitle = '' }) {
    const fileInputRef = useRef(null);
    const [file, setFile] = useState(null);
    const [parsing, setParsing] = useState(false);
    const [progressStatus, setProgressStatus] = useState('');
    const [parsedData, setParsedData] = useState(null);
    const [suggestedTitle, setSuggestedTitle] = useState('');
    const [useSuggestedTitle, setUseSuggestedTitle] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    if (!isOpen) return null;

    const handleFileSelect = (selectedFile) => {
        if (!selectedFile) return;

        // Validation
        const isDocx = selectedFile.name.toLowerCase().endsWith('.docx') ||
            selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        if (!isDocx) {
            toast.error('Please upload a Microsoft Word (.docx) document');
            return;
        }

        if (selectedFile.size > 25 * 1024 * 1024) {
            toast.error('File size exceeds the 25MB limit');
            return;
        }

        setFile(selectedFile);
        processDocxFile(selectedFile);
    };

    const processDocxFile = async (docFile) => {
        setParsing(true);
        setProgressStatus('Reading document...');
        setParsedData(null);

        try {
            const arrayBuffer = await docFile.arrayBuffer();

            let imageIndex = 0;
            const uploadedImages = [];

            // Configure mammoth options with image extraction handler
            const options = {
                convertImage: mammoth.images.imgElement(async (image) => {
                    imageIndex++;
                    setProgressStatus(`Uploading embedded image ${imageIndex}...`);

                    try {
                        const imageBuffer = await image.read('base64');
                        const contentType = image.contentType || 'image/png';
                        const ext = contentType.split('/')[1] || 'png';
                        const filename = `${docFile.name.replace(/\.[^/.]+$/, '')}-img-${imageIndex}.${ext}`;

                        const publicUrl = await uploadBase64Image({
                            base64: imageBuffer,
                            filename,
                            contentType,
                        });

                        uploadedImages.push(publicUrl);
                        return { src: publicUrl };
                    } catch (err) {
                        console.warn('Failed to upload docx inline image, skipping:', err);
                        // Fallback: don't break the entire document if one image fails
                        return { src: '' };
                    }
                }),
            };

            setProgressStatus('Converting document typography and structure...');
            const result = await mammoth.convertToHtml({ arrayBuffer }, options);
            let rawHtml = result.value || '';

            // Clean & sanitize HTML with DOMPurify
            const cleanHtml = DOMPurify.sanitize(rawHtml, {
                ADD_TAGS: ['iframe'],
                ADD_ATTR: ['target', 'rel', 'class', 'style', 'src', 'alt', 'width', 'height'],
            });

            // Extract document stats
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cleanHtml;

            // Extract potential document title from first H1, H2, or strong heading
            let extractedTitle = '';
            const firstHeading = tempDiv.querySelector('h1, h2');
            if (firstHeading && firstHeading.textContent.trim()) {
                extractedTitle = firstHeading.textContent.trim();
            } else {
                const firstP = tempDiv.querySelector('p');
                if (firstP && firstP.textContent.trim().length < 120) {
                    extractedTitle = firstP.textContent.trim();
                }
            }

            const textOnly = tempDiv.textContent || '';
            const words = textOnly.trim() ? textOnly.trim().split(/\s+/).length : 0;
            const paragraphs = tempDiv.querySelectorAll('p').length;
            const headingsCount = tempDiv.querySelectorAll('h1, h2, h3, h4').length;

            setSuggestedTitle(extractedTitle);
            setUseSuggestedTitle(!currentTitle && !!extractedTitle);

            setParsedData({
                html: cleanHtml,
                wordCount: words,
                paragraphCount: paragraphs,
                headingCount: headingsCount,
                imageCount: imageIndex,
                messages: result.messages || [],
            });

            setProgressStatus('');
            toast.success('Document parsed successfully');
        } catch (err) {
            console.error('Failed to import DOCX:', err);
            toast.error(err?.message || 'Failed to parse Word document. Please ensure it is a valid .docx file.');
            setProgressStatus('');
        } finally {
            setParsing(false);
        }
    };

    const handleConfirmImport = () => {
        if (!parsedData || !parsedData.html) return;

        onImportComplete({
            contentHtml: parsedData.html,
            title: useSuggestedTitle ? suggestedTitle : undefined,
            wordCount: parsedData.wordCount,
        });

        toast.success('Content loaded into editor for review');
        handleClose();
    };

    const handleClose = () => {
        setFile(null);
        setParsedData(null);
        setParsing(false);
        setProgressStatus('');
        setSuggestedTitle('');
        onClose();
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(5px)',
                zIndex: 999999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
            }}
            onClick={handleClose}
        >
            <div
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    width: '100%',
                    maxWidth: '680px',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                    overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* MODAL HEADER */}
                <div
                    style={{
                        padding: '20px 24px',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem' }}>📄</span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                                Import Word Document (.docx)
                            </h3>
                            <small style={{ color: 'var(--text-muted)' }}>
                                Convert Microsoft Word documents into rich editorial articles
                            </small>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            fontSize: '1.3rem',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: '4px',
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* MODAL BODY */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                    {/* DRAG AND DROP ZONE */}
                    {!parsedData && (
                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                style={{ display: 'none' }}
                                onChange={(e) => handleFileSelect(e.target.files?.[0])}
                            />

                            <div
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragOver(true);
                                }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragOver(false);
                                    handleFileSelect(e.dataTransfer.files?.[0]);
                                }}
                                onClick={() => !parsing && fileInputRef.current?.click()}
                                style={{
                                    border: `2px dashed ${dragOver ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.15)'}`,
                                    borderRadius: '12px',
                                    padding: '40px 24px',
                                    textAlign: 'center',
                                    backgroundColor: dragOver ? 'rgba(250, 139, 139, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                                    cursor: parsing ? 'wait' : 'pointer',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>
                                    {parsing ? '⏳' : '📁'}
                                </div>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                                    {parsing ? 'Processing Word Document...' : 'Click or drag .docx file here'}
                                </h4>
                                <p style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    {progressStatus || 'Supports Microsoft Word (.docx) files up to 25MB'}
                                </p>
                                {!parsing && (
                                    <button
                                        type="button"
                                        className="btn btn--outline btn--sm"
                                        style={{ pointerEvents: 'none' }}
                                    >
                                        Browse Computer
                                    </button>
                                )}
                            </div>

                            {/* FORMATTING & IMPORT GUIDELINES */}
                            <div
                                style={{
                                    marginTop: '20px',
                                    padding: '16px',
                                    borderRadius: '8px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid var(--border-color)',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary)',
                                }}
                            >
                                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                                    ✨ What happens during import:
                                </strong>
                                <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
                                    <li>Headings (Heading 1, 2, 3) are preserved as editorial sections.</li>
                                    <li>Bullet lists and numbered lists are cleanly converted.</li>
                                    <li>Bold, italic, links, and blockquotes are retained.</li>
                                    <li>Embedded images are automatically uploaded to Supabase Storage and linked.</li>
                                    <li>You can review and edit everything in the editor before publishing.</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* PARSED PREVIEW STATE */}
                    {parsedData && (
                        <div>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    marginBottom: '18px',
                                }}
                            >
                                <div>
                                    <span style={{ fontWeight: '600', color: '#10b981' }}>✓ Document Ready</span>
                                    <span style={{ marginLeft: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        {file?.name}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setParsedData(null);
                                        setFile(null);
                                    }}
                                    className="btn btn--ghost btn--sm"
                                    style={{ fontSize: '0.75rem' }}
                                >
                                    Choose different file
                                </button>
                            </div>

                            {/* STATS TILES */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '18px' }}>
                                <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                        {parsedData.wordCount}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Words</div>
                                </div>
                                <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                        {parsedData.paragraphCount}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Paragraphs</div>
                                </div>
                                <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                        {parsedData.headingCount}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Headings</div>
                                </div>
                                <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                        {parsedData.imageCount}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Images Extracted</div>
                                </div>
                            </div>

                            {/* SUGGESTED TITLE OPTION */}
                            {suggestedTitle && (
                                <div
                                    style={{
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        padding: '14px',
                                        marginBottom: '18px',
                                    }}
                                >
                                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={useSuggestedTitle}
                                            onChange={(e) => setUseSuggestedTitle(e.target.checked)}
                                            style={{ marginTop: '3px' }}
                                        />
                                        <div>
                                            <div style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                                                Set article title to detected document heading:
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-accent)', marginTop: '2px' }}>
                                                "{suggestedTitle}"
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            )}

                            {/* PREVIEW CONTAINER */}
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                                    Content Preview:
                                </label>
                                <div
                                    className="editorial-rendered-content"
                                    style={{
                                        maxHeight: '260px',
                                        overflowY: 'auto',
                                        padding: '16px',
                                        borderRadius: '8px',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '0.9rem',
                                    }}
                                    dangerouslySetInnerHTML={{ __html: parsedData.html }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* MODAL FOOTER */}
                <div
                    style={{
                        padding: '16px 24px',
                        borderTop: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '10px',
                    }}
                >
                    <button
                        type="button"
                        onClick={handleClose}
                        className="btn btn--ghost"
                    >
                        Cancel
                    </button>
                    {parsedData && (
                        <button
                            type="button"
                            onClick={handleConfirmImport}
                            className="btn btn--primary"
                        >
                            📥 Load into Editor
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
