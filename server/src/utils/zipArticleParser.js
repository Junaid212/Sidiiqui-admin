/**
 * zipArticleParser.js
 * Secure ZIP decompression, file validation, document conversion (DOCX, HTML, TXT, JSON),
 * image matching, and collision detection against existing blog records.
 */

const path = require('path');
const AdmZip = require('adm-zip');
const mammoth = require('mammoth');
const sanitizeHtml = require('sanitize-html');
const { supabaseAdmin } = require('../config/supabase');

// Security limits
const MAX_ZIP_BYTES = 60 * 1024 * 1024;       // 60 MB compressed
const MAX_TOTAL_UNCOMPRESSED = 300 * 1024 * 1024; // 300 MB total uncompressed
const MAX_SINGLE_FILE = 40 * 1024 * 1024;      // 40 MB single uncompressed
const MAX_FILE_COUNT = 600;                     // Max 600 files
const MAX_RATIO = 50;                           // Max compression ratio 50:1

const ALLOWED_DOC_EXTS = ['.docx', '.html', '.htm', '.txt', '.md', '.json'];
const ALLOWED_IMG_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const DANGEROUS_EXTS = ['.exe', '.bat', '.cmd', '.sh', '.py', '.php', '.js', '.mjs', '.vbs', '.ps1', '.jar', '.dll'];

// Helper to sanitize HTML content for Rich Text Editor (TipTap)
function sanitizeArticleHtml(rawHtml) {
    if (!rawHtml) return '';
    return sanitizeHtml(rawHtml, {
        allowedTags: [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
            'strong', 'b', 'em', 'i', 'u', 's', 'strike',
            'ul', 'ol', 'li', 'blockquote',
            'a', 'img', 'figure', 'figcaption',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'span', 'div', 'code', 'pre'
        ],
        allowedAttributes: {
            '*': ['class', 'id', 'style'],
            'a': ['href', 'target', 'rel', 'title'],
            'img': ['src', 'alt', 'title', 'width', 'height', 'loading'],
            'th': ['colspan', 'rowspan', 'style'],
            'td': ['colspan', 'rowspan', 'style']
        },
        allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
        transformTags: {
            'a': sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' })
        }
    });
}

// Helper to slugify text
function generateSlug(text) {
    if (!text) return `article-${Date.now()}`;
    return String(text)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

// Helper to calculate reading time
function calculateReadingTime(text) {
    if (!text) return '3 min read';
    const plain = text.replace(/<[^>]+>/g, ' ');
    const words = plain.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return `${minutes} min read`;
}

// Upload buffer directly to Supabase Storage 'blogs' bucket
async function uploadBufferToStorage(buffer, originalName, folder = 'blog-images', mimeType = 'image/png') {
    const ext = (path.extname(originalName) || '.png').toLowerCase();
    const baseName = path.basename(originalName, ext)
        .normalize('NFKD')
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '') || 'image';

    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${baseName}${ext}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
        .from('blogs')
        .upload(filePath, buffer, {
            contentType: mimeType,
            upsert: false
        });

    if (uploadError) {
        console.error('Storage upload error for', filePath, uploadError.message);
        throw uploadError;
    }

    const { data: urlData } = supabaseAdmin.storage
        .from('blogs')
        .getPublicUrl(filePath);

    return { path: filePath, url: urlData.publicUrl };
}

// Detect MIME type from extension
function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.png': return 'image/png';
        case '.webp': return 'image/webp';
        case '.gif': return 'image/gif';
        case '.html':
        case '.htm': return 'text/html';
        case '.txt': return 'text/plain';
        case '.json': return 'application/json';
        default: return 'application/octet-stream';
    }
}

// Security: Check for path traversal / zip slip
function isSafeEntryPath(entryPath) {
    if (!entryPath) return false;
    if (entryPath.includes('..')) {
        return false;
    }
    const normalized = path.normalize(entryPath).replace(/\\/g, '/');
    if (normalized.startsWith('../') || normalized.includes('/../') || normalized === '..') {
        return false;
    }
    if (path.isAbsolute(entryPath) || entryPath.startsWith('/') || entryPath.startsWith('\\')) {
        return false;
    }
    if (/^[a-zA-Z]:/.test(entryPath)) {
        return false;
    }
    // Check for null bytes or control characters
    if (/[\x00-\x1f\x7f]/.test(entryPath)) {
        return false;
    }
    return true;
}

/**
 * Validate and unpack ZIP entries into memory
 */
function extractAndValidateZip(zipBuffer) {
    if (!zipBuffer || !Buffer.isBuffer(zipBuffer)) {
        throw new Error('Invalid upload: file buffer is missing');
    }

    if (zipBuffer.length > MAX_ZIP_BYTES) {
        throw new Error(`ZIP file exceeds the maximum allowed size of ${MAX_ZIP_BYTES / (1024 * 1024)}MB`);
    }

    let zip;
    try {
        zip = new AdmZip(zipBuffer);
    } catch (err) {
        throw new Error('Failed to open ZIP archive. File may be corrupted or not a valid ZIP.');
    }

    const entries = zip.getEntries();

    if (entries.length === 0) {
        throw new Error('ZIP archive is empty');
    }

    if (entries.length > MAX_FILE_COUNT) {
        throw new Error(`ZIP contains too many files (${entries.length}). Maximum allowed is ${MAX_FILE_COUNT}`);
    }

    let totalUncompressedSize = 0;
    const safeEntries = [];
    const validationErrors = [];
    const unsupportedFiles = [];

    for (const entry of entries) {
        if (entry.isDirectory) continue;

        const entryPath = entry.entryName;

        // Path traversal / Zip Slip check
        if (!isSafeEntryPath(entryPath)) {
            validationErrors.push(`Rejected unsafe file path in archive: "${entryPath}"`);
            continue;
        }

        const uncompressedSize = entry.header.size;
        totalUncompressedSize += uncompressedSize;

        if (uncompressedSize > MAX_SINGLE_FILE) {
            validationErrors.push(`File "${entryPath}" exceeds single file limit (${MAX_SINGLE_FILE / (1024 * 1024)}MB)`);
            continue;
        }

        const ext = path.extname(entryPath).toLowerCase();

        // Reject dangerous executables
        if (DANGEROUS_EXTS.includes(ext)) {
            validationErrors.push(`Prohibited file type rejected: "${entryPath}"`);
            continue;
        }

        const isDoc = ALLOWED_DOC_EXTS.includes(ext);
        const isImg = ALLOWED_IMG_EXTS.includes(ext);

        if (!isDoc && !isImg) {
            unsupportedFiles.push(entryPath);
            continue;
        }

        safeEntries.push({
            entryName: entryPath,
            ext,
            isDoc,
            isImg,
            getData: () => entry.getData(),
            size: uncompressedSize
        });
    }

    // Zip bomb total size and ratio checks
    if (totalUncompressedSize > MAX_TOTAL_UNCOMPRESSED) {
        throw new Error(`Total uncompressed size (${Math.round(totalUncompressedSize / 1024 / 1024)}MB) exceeds maximum safe limit of ${MAX_TOTAL_UNCOMPRESSED / 1024 / 1024}MB`);
    }

    const ratio = totalUncompressedSize / Math.max(1, zipBuffer.length);
    if (ratio > MAX_RATIO) {
        throw new Error(`Suspicious compression ratio (${ratio.toFixed(1)}:1). Archive rejected for security reasons.`);
    }

    return { safeEntries, validationErrors, unsupportedFiles };
}

/**
 * Convert Plain Text / Markdown to HTML
 */
function convertTextToHtml(text) {
    if (!text) return '';
    const lines = text.split(/\r?\n/);
    let html = '';
    let inList = false;
    let listType = 'ul';

    for (let rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
            if (inList) {
                html += `</${listType}>`;
                inList = false;
            }
            continue;
        }

        // Headings: #, ##, ###
        if (line.startsWith('### ')) {
            if (inList) { html += `</${listType}>`; inList = false; }
            html += `<h4>${line.slice(4).trim()}</h4>`;
            continue;
        }
        if (line.startsWith('## ')) {
            if (inList) { html += `</${listType}>`; inList = false; }
            html += `<h3>${line.slice(3).trim()}</h3>`;
            continue;
        }
        if (line.startsWith('# ')) {
            if (inList) { html += `</${listType}>`; inList = false; }
            html += `<h2>${line.slice(2).trim()}</h2>`;
            continue;
        }

        // Bullet lists
        if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
            if (!inList || listType !== 'ul') {
                if (inList) html += `</${listType}>`;
                inList = true;
                listType = 'ul';
                html += '<ul>';
            }
            const itemText = line.replace(/^[-*•]\s+/, '');
            html += `<li>${formatInlineText(itemText)}</li>`;
            continue;
        }

        // Numbered lists
        const numMatch = line.match(/^\d+\.\s+(.*)/);
        if (numMatch) {
            if (!inList || listType !== 'ol') {
                if (inList) html += `</${listType}>`;
                inList = true;
                listType = 'ol';
                html += '<ol>';
            }
            html += `<li>${formatInlineText(numMatch[1])}</li>`;
            continue;
        }

        // Regular paragraph
        if (inList) {
            html += `</${listType}>`;
            inList = false;
        }
        html += `<p>${formatInlineText(line)}</p>`;
    }

    if (inList) {
        html += `</${listType}>`;
    }

    return sanitizeArticleHtml(html);
}

function formatInlineText(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\[(.*?)\]\((https?:\/\/.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

/**
 * Convert DOCX buffer to HTML with embedded images extracted & uploaded to Supabase Storage
 */
async function convertDocxBufferToHtml(buffer, docFilename) {
    const uploadedInlineImages = [];
    let imageCounter = 0;

    const options = {
        convertImage: mammoth.images.imgElement(async (image) => {
            imageCounter++;
            try {
                const imgBuffer = await image.read();
                const contentType = image.contentType || 'image/png';
                const ext = contentType.split('/')[1] || 'png';
                const safeDocBase = path.basename(docFilename, path.extname(docFilename))
                    .replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 30);
                const imageName = `${safeDocBase}-inline-${imageCounter}.${ext}`;

                const result = await uploadBufferToStorage(imgBuffer, imageName, 'blog-images', contentType);
                uploadedInlineImages.push(result.url);
                return { src: result.url };
            } catch (err) {
                console.warn('Failed to upload inline docx image:', err.message);
                return { src: '' };
            }
        })
    };

    const result = await mammoth.convertToHtml({ buffer }, options);
    const sanitized = sanitizeArticleHtml(result.value || '');
    return { html: sanitized, inlineImages: uploadedInlineImages };
}

/**
 * Process HTML document: sanitize and upload any inline Base64 or local images
 */
async function processHtmlDocument(rawHtml, imageEntriesMap, docPath) {
    let content = rawHtml;
    const docDir = path.dirname(docPath);

    // 1. Detect base64 data URIs: src="data:image/png;base64,..."
    const base64Regex = /src=["'](data:image\/([a-zA-Z0-9+]+);base64,([^"']+))["']/g;
    let b64Match;
    const base64Replacements = [];

    while ((b64Match = base64Regex.exec(content)) !== null) {
        const fullDataUri = b64Match[1];
        const ext = b64Match[2].toLowerCase();
        const b64Data = b64Match[3];
        base64Replacements.push({ fullDataUri, ext, b64Data });
    }

    for (const item of base64Replacements) {
        try {
            const buf = Buffer.from(item.b64Data, 'base64');
            const mime = `image/${item.ext === 'jpg' ? 'jpeg' : item.ext}`;
            const uploaded = await uploadBufferToStorage(buf, `inline-${Date.now()}.${item.ext}`, 'blog-images', mime);
            content = content.replace(item.fullDataUri, uploaded.url);
        } catch (e) {
            console.warn('Failed to upload base64 image from HTML:', e.message);
        }
    }

    // 2. Detect local image references: src="images/photo.jpg" or src="./cover.png"
    const localImgRegex = /src=["']([^"':]+?\.(png|jpe?g|webp|gif))["']/gi;
    let localMatch;
    const localMatches = [];

    while ((localMatch = localImgRegex.exec(content)) !== null) {
        const refSrc = localMatch[1];
        if (!refSrc.startsWith('http://') && !refSrc.startsWith('https://') && !refSrc.startsWith('data:')) {
            localMatches.push(refSrc);
        }
    }

    for (const refSrc of localMatches) {
        // Resolve relative to document directory
        const resolvedPath = path.normalize(path.join(docDir, refSrc)).replace(/\\/g, '/');
        const entry = imageEntriesMap.get(resolvedPath) || imageEntriesMap.get(refSrc) || imageEntriesMap.get(path.basename(refSrc));

        if (entry && !entry.uploadedUrl) {
            try {
                const buf = entry.getData();
                const mime = getMimeType(entry.entryName);
                const uploaded = await uploadBufferToStorage(buf, path.basename(entry.entryName), 'blog-images', mime);
                entry.uploadedUrl = uploaded.url;
                content = content.split(`src="${refSrc}"`).join(`src="${uploaded.url}"`);
                content = content.split(`src='${refSrc}'`).join(`src='${uploaded.url}'`);
            } catch (e) {
                console.warn('Failed to upload local image ref from HTML:', e.message);
            }
        } else if (entry && entry.uploadedUrl) {
            content = content.split(`src="${refSrc}"`).join(`src="${entry.uploadedUrl}"`);
            content = content.split(`src='${refSrc}'`).join(`src='${entry.uploadedUrl}'`);
        }
    }

    return sanitizeArticleHtml(content);
}

/**
 * Extract Title from content or filename
 */
function extractTitleFromContent(html, filename) {
    // Check for <h1>
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (h1Match && h1Match[1].replace(/<[^>]+>/g, '').trim()) {
        return h1Match[1].replace(/<[^>]+>/g, '').trim();
    }
    // Check for <h2>
    const h2Match = html.match(/<h2[^>]*>(.*?)<\/h2>/i);
    if (h2Match && h2Match[1].replace(/<[^>]+>/g, '').trim()) {
        return h2Match[1].replace(/<[^>]+>/g, '').trim();
    }
    // Derive from filename
    const base = path.basename(filename, path.extname(filename));
    return base
        .replace(/^[\d_-]+/, '') // remove leading 01-, 02_
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim() || 'Untitled Article';
}

/**
 * Extract first paragraph for standfirst/summary if missing
 */
function extractSummary(html) {
    const pMatch = html.match(/<p[^>]*>(.*?)<\/p>/i);
    if (pMatch) {
        const plain = pMatch[1].replace(/<[^>]+>/g, '').trim();
        if (plain.length > 20) {
            return plain.slice(0, 240);
        }
    }
    return '';
}

/**
 * Parse entire ZIP and produce structured article previews with collision detection
 */
async function parseZipArticles(zipBuffer, existingBlogs = []) {
    const { safeEntries, validationErrors, unsupportedFiles } = extractAndValidateZip(zipBuffer);

    // Create maps for quick lookup
    const docEntries = safeEntries.filter(e => e.isDoc);
    const imgEntries = safeEntries.filter(e => e.isImg);

    const imgMapByPath = new Map();
    const imgMapByBase = new Map(); // basename -> array of entries

    for (const img of imgEntries) {
        const normPath = img.entryName.replace(/\\/g, '/');
        imgMapByPath.set(normPath, img);

        const base = path.basename(normPath, img.ext).toLowerCase();
        if (!imgMapByBase.has(base)) imgMapByBase.set(base, []);
        imgMapByBase.get(base).push(img);
    }

    // Helper to upload image entry if not already uploaded
    async function ensureImageUploaded(imgEntry, folder = 'blog-covers') {
        if (!imgEntry) return null;
        if (imgEntry.uploadedUrl) {
            return { url: imgEntry.uploadedUrl, path: imgEntry.uploadedPath };
        }
        const buf = imgEntry.getData();
        const mime = getMimeType(imgEntry.entryName);
        const result = await uploadBufferToStorage(buf, path.basename(imgEntry.entryName), folder, mime);
        imgEntry.uploadedUrl = result.url;
        imgEntry.uploadedPath = result.path;
        return result;
    }

    // Check for manifest (e.g. articles.json, manifest.json)
    let manifestEntry = docEntries.find(e => {
        const base = path.basename(e.entryName).toLowerCase();
        return base === 'articles.json' || base === 'manifest.json' || base === 'metadata.json' || base === 'index.json';
    });

    let manifestData = null;
    if (manifestEntry) {
        try {
            const rawJson = manifestEntry.getData().toString('utf8');
            const parsed = JSON.parse(rawJson);
            manifestData = Array.isArray(parsed) ? parsed : (parsed.articles || parsed.data || null);
        } catch (e) {
            validationErrors.push(`Failed to parse manifest JSON in ${manifestEntry.entryName}: ${e.message}`);
        }
    }

    const detectedArticles = [];
    const usedDocPaths = new Set();
    if (manifestEntry) usedDocPaths.add(manifestEntry.entryName);

    // --- STRATEGY 1: Manifest-driven articles (authoritative articles.json) ---
    if (manifestData && Array.isArray(manifestData)) {
        for (let i = 0; i < manifestData.length; i++) {
            const m = manifestData[i];
            const order = Number(m.order) || (i + 1);
            const tempId = `art-m-${order}`;
            const title = (m.title || `Article ${order}`).trim();
            const slug = generateSlug(m.slug || title);

            // 1. Content resolution: prioritize body_html, then content, then body_markdown
            let rawContent = m.body_html || m.content || '';
            let matchedDocPath = null;

            // Optional external document lookup if referenced
            const refFile = m.file || m.document || m.path || m.filename;
            if (!rawContent && refFile) {
                const normRef = path.normalize(refFile).replace(/\\/g, '/').toLowerCase();
                const matchedEntry = docEntries.find(e => {
                    const normE = e.entryName.replace(/\\/g, '/').toLowerCase();
                    return normE === normRef || normE.endsWith('/' + normRef) || path.basename(normE) === normRef;
                });

                if (matchedEntry) {
                    matchedDocPath = matchedEntry.entryName;
                    usedDocPaths.add(matchedDocPath);
                    const buf = matchedEntry.getData();

                    if (matchedEntry.ext === '.docx') {
                        const res = await convertDocxBufferToHtml(buf, matchedEntry.entryName);
                        rawContent = res.html;
                    } else if (matchedEntry.ext === '.html' || matchedEntry.ext === '.htm') {
                        rawContent = await processHtmlDocument(buf.toString('utf8'), imgMapByPath, matchedEntry.entryName);
                    } else if (matchedEntry.ext === '.txt' || matchedEntry.ext === '.md') {
                        rawContent = convertTextToHtml(buf.toString('utf8'));
                    }
                }
            }

            if (!rawContent && m.body_markdown) {
                rawContent = convertTextToHtml(m.body_markdown);
            }

            const contentHtml = sanitizeArticleHtml(rawContent);

            // 2. Category mapping: primary_category -> topic, secondary_categories -> topic2
            const primaryCat = (m.primary_category || m.topic || 'SID Philosophy').trim();
            let secondaryCats = [];
            if (Array.isArray(m.secondary_categories)) {
                secondaryCats = m.secondary_categories;
            } else if (typeof m.secondary_categories === 'string' && m.secondary_categories.trim()) {
                secondaryCats = m.secondary_categories.split(',').map(s => s.trim()).filter(Boolean);
            } else if (Array.isArray(m.topic2)) {
                secondaryCats = m.topic2;
            } else if (typeof m.topic2 === 'string' && m.topic2.trim()) {
                secondaryCats = m.topic2.split(',').map(s => s.trim()).filter(Boolean);
            }

            // 3. Excerpts and Standfirst
            const summary = m.card_excerpt || m.summary || extractSummary(contentHtml);
            const standfirst = m.standfirst || summary;

            // 4. Byline and reading time
            const authorByline = m.author_byline || 'By M. Q. Siddiqui, Founder, Siddiqui.digital';
            const readingTime = m.reading_time || calculateReadingTime(contentHtml);

            // 5. Editorial Pull Quote & Concluding Insight
            const pullQuote = m.pull_quote || null;
            const pullQuoteAuthor = m.pull_quote_attribution || m.pull_quote_author || null;
            const pullQuotePos = m.pull_quote_position !== undefined && m.pull_quote_position !== null
                ? Number(m.pull_quote_position)
                : 1;
            const concludingInsight = m.concluding_insight || null;

            // 6. Dates and publishing status
            const displayDate = m.display_date || m.published_date || new Date().toISOString().split('T')[0];
            const targetStatus = ['draft', 'scheduled', 'published'].includes(m.status) ? m.status : 'draft';
            const scheduledFor = targetStatus === 'scheduled' ? (m.scheduled_for || displayDate) : null;

            // 7. Flags
            const isFeatured = m.featured !== undefined ? !!m.featured : (m.is_featured !== undefined ? !!m.is_featured : false);
            const showBookPanel = m.show_book_panel !== undefined ? !!m.show_book_panel : (m.related_to_book !== undefined ? !!m.related_to_book : false);

            // 8. Related Slugs
            const relatedSlugs = Array.isArray(m.related_slugs) ? m.related_slugs : (typeof m.related_slugs === 'string' ? [m.related_slugs] : []);

            // 9. SEO & Metadata
            const seoTitle = m.seo_title || null;
            const seoDescription = m.meta_description || m.seo_description || null;

            // 10. Image Association (Cover: images/cover/{slug}.png, Social: images/social/{slug}.png)
            // NEVER use Instagram images on the website
            const normSlug = slug.toLowerCase();

            const matchedCoverEntry = imgEntries.find(e => {
                const normE = e.entryName.replace(/\\/g, '/').toLowerCase();
                if (normE.includes('/instagram/')) return false;
                const baseE = path.basename(normE, e.ext).toLowerCase();
                return normE.endsWith(`/cover/${normSlug}${e.ext}`) ||
                       (normE.includes('/cover/') && baseE === normSlug) ||
                       (m.cover_image && normE.endsWith(m.cover_image.toLowerCase()));
            });

            const matchedSocialEntry = imgEntries.find(e => {
                const normE = e.entryName.replace(/\\/g, '/').toLowerCase();
                if (normE.includes('/instagram/')) return false;
                const baseE = path.basename(normE, e.ext).toLowerCase();
                return normE.endsWith(`/social/${normSlug}${e.ext}`) ||
                       (normE.includes('/social/') && baseE === normSlug) ||
                       (m.social_image && normE.endsWith(m.social_image.toLowerCase()));
            });

            let coverUrl = null;
            let coverPath = null;
            let coverPreviewBase64 = null;
            let imageStatus = 'missing';

            if (matchedCoverEntry) {
                imageStatus = 'matched';
                coverPath = `blog-images/${path.basename(matchedCoverEntry.entryName)}`;
                // Generate base64 thumbnail for fast, zero-upload inspection preview
                try {
                    const mime = getMimeType(matchedCoverEntry.entryName);
                    coverPreviewBase64 = `data:${mime};base64,${matchedCoverEntry.getData().toString('base64')}`;
                    coverUrl = coverPreviewBase64;
                } catch (_) {}
            }

            let socialPath = null;
            let socialStatus = 'missing';
            if (matchedSocialEntry) {
                socialStatus = 'matched';
                socialPath = `blog-images/${path.basename(matchedSocialEntry.entryName)}`;
            }

            detectedArticles.push({
                tempId,
                order,
                sourceFile: matchedDocPath || refFile || 'articles.json',
                title,
                slug,
                content: contentHtml,
                body_markdown: m.body_markdown || null,
                topic: primaryCat,
                topic2: secondaryCats,
                published_date: displayDate,
                reading_time: readingTime,
                author_byline: authorByline,
                image_url: coverUrl,
                image_path: coverPath,
                image_status: imageStatus,
                image_caption: m.image_caption || null,
                image_alt: m.cover_image_alt || m.image_alt || null,
                social_image_path: socialPath,
                social_image_status: socialStatus,
                summary,
                standfirst,
                sub_sections: Array.isArray(m.sub_sections) ? m.sub_sections : [],
                pull_quote: pullQuote,
                pull_quote_author: pullQuoteAuthor,
                pull_quote_position: pullQuotePos,
                concluding_insight: concludingInsight,
                is_featured: isFeatured,
                status: targetStatus,
                scheduled_for: scheduledFor,
                related_to_book: showBookPanel,
                book_concept: m.book_concept || null,
                related_slugs: relatedSlugs,
                seo_title: seoTitle,
                seo_description: seoDescription,
                linkedin_url: m.linkedin_url || null,
                instagram_url: m.instagram_url || null,
                facebook_url: m.facebook_url || null,
            });
        }
    }

    // --- STRATEGY 2: Discover articles from remaining DOCX, HTML, TXT, MD files ---
    // CRITICAL: When articles.json exists, it is the sole authoritative article source!
    // Never parse README files, preview files, CSVs, or extra docs as synthetic articles.
    const hasAuthoritativeManifest = manifestData && Array.isArray(manifestData) && manifestData.length > 0;
    const remainingDocs = hasAuthoritativeManifest
        ? []
        : docEntries.filter(e => {
            if (usedDocPaths.has(e.entryName)) return false;
            const b = path.basename(e.entryName).toLowerCase();
            if (b.startsWith('readme') || b.startsWith('preview') || b.endsWith('.csv') || b.startsWith('license')) {
                return false;
            }
            return true;
        });

    for (let i = 0; i < remainingDocs.length; i++) {
        const docEntry = remainingDocs[i];
        const docPath = docEntry.entryName.replace(/\\/g, '/');
        const docDir = path.dirname(docPath);
        const docBase = path.basename(docPath, docEntry.ext).toLowerCase();
        const tempId = `art-doc-${i + 1}`;

        let contentHtml = '';
        const buf = docEntry.getData();

        try {
            if (docEntry.ext === '.docx') {
                const res = await convertDocxBufferToHtml(buf, docPath);
                contentHtml = res.html;
            } else if (docEntry.ext === '.html' || docEntry.ext === '.htm') {
                contentHtml = await processHtmlDocument(buf.toString('utf8'), imgMapByPath, docPath);
            } else if (docEntry.ext === '.txt' || docEntry.ext === '.md') {
                contentHtml = convertTextToHtml(buf.toString('utf8'));
            } else if (docEntry.ext === '.json') {
                try {
                    const parsed = JSON.parse(buf.toString('utf8'));
                    if (parsed.title || parsed.content || parsed.body_html) {
                        contentHtml = sanitizeArticleHtml(parsed.body_html || parsed.content || '');
                    }
                } catch (_) {}
            }
        } catch (err) {
            validationErrors.push(`Failed to parse document "${docPath}": ${err.message}`);
            continue;
        }

        if (!contentHtml.trim()) {
            validationErrors.push(`Document "${docPath}" is empty or has no readable content.`);
            continue;
        }

        const title = extractTitleFromContent(contentHtml, docPath);
        const slug = generateSlug(title);
        const summary = extractSummary(contentHtml);

        detectedArticles.push({
            tempId,
            order: i + 1,
            sourceFile: docPath,
            title,
            slug,
            content: contentHtml,
            body_markdown: null,
            topic: 'SID Philosophy',
            topic2: [],
            published_date: new Date().toISOString().split('T')[0],
            reading_time: calculateReadingTime(contentHtml),
            author_byline: 'By M. Q. Siddiqui, Founder, Siddiqui.digital',
            image_url: null,
            image_path: null,
            image_status: 'missing',
            image_caption: null,
            image_alt: null,
            social_image_path: null,
            social_image_status: 'missing',
            summary,
            standfirst: summary,
            sub_sections: [],
            pull_quote: null,
            pull_quote_author: null,
            pull_quote_position: 1,
            concluding_insight: null,
            is_featured: false,
            status: 'draft',
            scheduled_for: null,
            related_to_book: false,
            book_concept: null,
            related_slugs: [],
            seo_title: null,
            seo_description: null,
            linkedin_url: null,
            instagram_url: null,
            facebook_url: null,
        });
    }

    // --- STEP 3: Collision & Conflict Detection against existing DB records ---
    const existingSlugsMap = new Map();
    const existingTitlesMap = new Map();

    for (const blog of existingBlogs) {
        if (blog.slug) existingSlugsMap.set(blog.slug.toLowerCase().trim(), blog);
        if (blog.title) existingTitlesMap.set(blog.title.toLowerCase().trim(), blog);
    }

    let readyCount = 0;
    let conflictCount = 0;
    let missingImageCount = 0;

    const processedArticles = detectedArticles.map(art => {
        const artSlugNorm = (art.slug || '').toLowerCase().trim();
        const artTitleNorm = (art.title || '').toLowerCase().trim();

        const match = existingSlugsMap.get(artSlugNorm) || existingTitlesMap.get(artTitleNorm);

        if (match) {
            conflictCount++;
            return {
                ...art,
                hasConflict: true,
                existingMatch: {
                    id: match.id,
                    title: match.title,
                    slug: match.slug,
                    status: match.status
                },
                conflictAction: 'skip', // default safe: skip
                overwriteConfirmed: false,
                validationWarning: `Matches existing article "${match.title}" (slug: ${match.slug}). Kept intact by default.`
            };
        }

        if (art.image_status === 'missing') {
            missingImageCount++;
        }

        readyCount++;
        return {
            ...art,
            hasConflict: false,
            existingMatch: null,
            conflictAction: 'create',
            overwriteConfirmed: false
        };
    });

    return {
        summary: {
            totalArticles: processedArticles.length,
            readyToImport: readyCount,
            conflicts: conflictCount,
            missingImages: missingImageCount,
            unsupportedFilesCount: unsupportedFiles.length,
            unsupportedFiles,
            validationErrors
        },
        articles: processedArticles
    };
}

module.exports = {
    extractAndValidateZip,
    parseZipArticles,
    uploadBufferToStorage,
    sanitizeArticleHtml,
    generateSlug,
    calculateReadingTime,
    isSafeEntryPath
};
