import React from 'react';
import DOMPurify from 'dompurify';

/**
 * Checks if a string contains HTML markup
 */
export function isHtmlContent(str) {
    if (!str || typeof str !== 'string') return false;
    return /<\/?(p|h[1-6]|ul|ol|li|blockquote|strong|b|em|i|u|s|span|div|a|img|hr|br|table|pre|code)[^>]*>/i.test(str);
}

/**
 * Parses and renders editorial body text:
 * - If HTML, sanitizes with DOMPurify and renders dangerouslySetInnerHTML
 * - If legacy plain text, keeps blank lines and groups bullet lists
 */
export function renderEditorialBody(text) {
    if (!text || typeof text !== 'string') return null;

    if (isHtmlContent(text)) {
        const clean = DOMPurify.sanitize(text, {
            ADD_TAGS: ['iframe'],
            ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target', 'rel']
        });
        return (
            <div
                className="editorial-rendered-content"
                dangerouslySetInnerHTML={{ __html: clean }}
            />
        );
    }

    // Legacy plain-text fallback: Split on double newlines
    const blocks = text.split(/\n\s*\n/);


    return blocks.map((block, bIdx) => {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) return null;

        const lines = trimmedBlock.split('\n').map(l => l.trim()).filter(Boolean);

        // Check if all lines are bullets
        const allBullets = lines.length > 0 && lines.every(l => isBulletLine(l));
        if (allBullets) {
            return (
                <ul key={bIdx} style={{ margin: '0 0 24px 0', paddingLeft: '26px', listStyleType: 'disc' }}>
                    {lines.map((l, lIdx) => (
                        <li key={lIdx} style={{ marginBottom: '8px', lineHeight: '1.75' }}>
                            {cleanBulletText(l)}
                        </li>
                    ))}
                </ul>
            );
        }

        // Check if there are some bullets within the paragraph block
        const hasBullets = lines.some(l => isBulletLine(l));
        if (hasBullets) {
            const elements = [];
            let bulletGroup = [];

            lines.forEach((line, lIdx) => {
                if (isBulletLine(line)) {
                    bulletGroup.push(cleanBulletText(line));
                } else {
                    if (bulletGroup.length > 0) {
                        elements.push(
                            <ul key={`ul-${lIdx}`} style={{ margin: '0 0 16px 0', paddingLeft: '26px', listStyleType: 'disc' }}>
                                {bulletGroup.map((bText, bi) => (
                                    <li key={bi} style={{ marginBottom: '8px', lineHeight: '1.75' }}>{bText}</li>
                                ))}
                            </ul>
                        );
                        bulletGroup = [];
                    }
                    elements.push(
                        <p key={`p-${lIdx}`} style={{ margin: '0 0 16px 0', lineHeight: '1.75', whiteSpace: 'pre-wrap' }}>
                            {line}
                        </p>
                    );
                }
            });

            if (bulletGroup.length > 0) {
                elements.push(
                    <ul key="ul-end" style={{ margin: '0 0 16px 0', paddingLeft: '26px', listStyleType: 'disc' }}>
                        {bulletGroup.map((bText, bi) => (
                            <li key={bi} style={{ marginBottom: '8px', lineHeight: '1.75' }}>{bText}</li>
                        ))}
                    </ul>
                );
            }

            return <div key={bIdx} style={{ marginBottom: '24px' }}>{elements}</div>;
        }

        // Regular paragraph with space below
        return (
            <p key={bIdx} style={{ margin: '0 0 24px 0', lineHeight: '1.75', whiteSpace: 'pre-wrap' }}>
                {trimmedBlock}
            </p>
        );
    });
}

function isBulletLine(line) {
    if (!line) return false;
    const t = line.trim();
    return t.startsWith('•') || t.startsWith('·') || t.startsWith('- ') || t.startsWith('* ');
}

function cleanBulletText(line) {
    if (!line) return '';
    return line.trim().replace(/^[•·\-\*]\s*/, '').trim();
}

/**
 * Renders Quote box or Question box directly after a sub-section
 */
export function renderHighlightBox(sub) {
    if (!sub || !sub.highlight_type || sub.highlight_type === 'none' || !sub.highlight_text) {
        return null;
    }

    if (sub.highlight_type === 'quote') {
        return (
            <div style={{
                background: '#F7EEF0', // light maroon
                borderLeft: '4px solid #8A1528',
                borderRadius: '8px',
                padding: '18px 22px',
                margin: '24px 0 28px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px'
            }}>
                <span style={{ fontSize: '28px', lineHeight: 1, color: '#8A1528', fontFamily: 'Georgia, serif' }}>“</span>
                <p style={{
                    margin: 0,
                    fontFamily: "'Source Serif 4', Georgia, serif",
                    fontSize: '18px',
                    lineHeight: '1.5',
                    fontWeight: '600',
                    color: '#8A1528', // maroon text
                    fontStyle: 'italic'
                }}>
                    {sub.highlight_text}
                </p>
            </div>
        );
    }

    if (sub.highlight_type === 'question') {
        return (
            <div style={{
                background: '#F4F5F8', // light gray
                borderLeft: '4px solid #13294B',
                borderRadius: '8px',
                padding: '18px 22px',
                margin: '24px 0 28px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px'
            }}>
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#13294B',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: '700',
                    flexShrink: 0
                }}>
                    ?
                </span>
                <p style={{
                    margin: 0,
                    fontSize: '17px',
                    lineHeight: '1.55',
                    fontWeight: '600',
                    color: '#13294B' // navy text
                }}>
                    {sub.highlight_text}
                </p>
            </div>
        );
    }

    return null;
}

/**
 * Editorial Pull Quote block
 */
export function renderPullQuote(quote, author) {
    if (!quote) return null;
    return (
        <figure style={{
            margin: '32px 0',
            padding: '18px 0',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            borderTop: '1px solid #E3E6EC',
            borderBottom: '1px solid #E3E6EC'
        }}>
            <blockquote style={{
                margin: '12px 0 0',
                fontFamily: "'Source Serif 4', Georgia, serif",
                fontWeight: 600,
                fontSize: '26px',
                lineHeight: 1.4,
                color: '#A3192F',
                fontStyle: 'italic'
            }}>
                “{quote}”
            </blockquote>
            {author && (
                <figcaption style={{ marginBottom: '10px', fontSize: '15px', color: '#4A5163', fontWeight: 600 }}>
                    — {author}
                </figcaption>
            )}
        </figure>
    );
}

/**
 * Author Box shown directly after Concluding Insight
 */
export function renderAuthorBox(blog = {}) {
    const rawByline = blog.author_byline || 'By M. Q. Siddiqui, Founder, Siddiqui.digital';
    const authorName = rawByline.replace(/^By\s+/i, '').split(',')[0].trim() || 'M. Q. Siddiqui';
    const rolePart = rawByline.includes(',') ? rawByline.substring(rawByline.indexOf(',') + 1).trim() : 'Founder, Siddiqui.digital';

    return (
        <div style={{
            marginTop: '36px',
            padding: '24px 28px',
            borderRadius: '12px',
            background: '#FAFBFD',
            border: '1px solid #E3E6EC',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '18px',
            alignItems: 'center'
        }}>
            <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#13294B',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '2px solid #8A1528'
            }}>
                MQS
            </div>
            <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', color: '#8A1528', textTransform: 'uppercase' }}>
                    Author
                </span>
                <h4 style={{
                    margin: 0,
                    fontFamily: "'Source Serif 4', Georgia, serif",
                    fontSize: '19px',
                    color: '#13294B',
                    fontWeight: 700
                }}>
                    {authorName}
                </h4>
                <p style={{ margin: 0, fontSize: '14px', color: '#4A5163' }}>
                    {rolePart}
                </p>
            </div>
            {(blog.linkedin_url || blog.instagram_url || blog.facebook_url) && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                    {blog.linkedin_url && (
                        <a href={blog.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: '6px', background: '#0A66C2', color: '#ffffff', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
                            LinkedIn
                        </a>
                    )}
                    {blog.instagram_url && (
                        <a href={blog.instagram_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: '6px', background: '#C13584', color: '#ffffff', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
                            Instagram
                        </a>
                    )}
                    {blog.facebook_url && (
                        <a href={blog.facebook_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: '6px', background: '#1877F2', color: '#ffffff', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
                            Facebook
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}
