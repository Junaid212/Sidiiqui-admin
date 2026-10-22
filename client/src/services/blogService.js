import { apiRequest } from '../config/api';
import { supabase } from '../config/supabase';

/**
 * Fetch all blogs safely via admin backend
 */
export async function fetchBlogs() {
    const data = await apiRequest('/blogs');
    return data.blogs || [];
}

/**
 * Fetch exactly one blog safely using its ID via admin backend
 */
export async function fetchBlogById(id) {
    const data = await apiRequest(`/blogs/${id}`);
    return data.blog;
}

/**
 * Upload an image to the 'blogs' bucket
 */
export async function uploadCoverImage(file) {
    if (!file) return null;

    const rawName = file.name || 'image';
    const lastDot = rawName.lastIndexOf('.');
    const ext = lastDot !== -1 ? rawName.slice(lastDot).toLowerCase() : '.jpg';
    const nameWithoutExt = lastDot !== -1 ? rawName.slice(0, lastDot) : rawName;
    const base = nameWithoutExt
        .normalize('NFKD')
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '') || 'image';

    const fileName = `${Date.now()}-${base}${ext}`;
    const filePath = `blog-covers/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('blogs')
        .upload(filePath, file, { upsert: false });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
        .from('blogs')
        .getPublicUrl(filePath);

    return { publicUrl: data.publicUrl, filePath };
}

function formatTopic2(val) {
    if (Array.isArray(val)) {
        return val.map(s => String(s).trim()).filter(Boolean).join(', ');
    }
    return val ? String(val).trim() : '';
}

/**
 * Create a new Blog record via admin backend.
 */
export async function createBlog(blogData) {
    const formattedTopic2 = formatTopic2(blogData.topic2);

    if (blogData.imageFile) {
        const fd = new FormData();
        fd.append('image', blogData.imageFile);
        fd.append('title', blogData.title || '');
        fd.append('content', blogData.content || '');
        fd.append('topic', blogData.topic || '');
        fd.append('topic2', formattedTopic2);
        if (blogData.published_date) fd.append('published_date', blogData.published_date);
        if (blogData.title2) fd.append('title2', blogData.title2);
        if (blogData.content2) fd.append('content2', blogData.content2);

        // Editorial fields
        if (blogData.slug) fd.append('slug', blogData.slug);
        if (blogData.summary) fd.append('summary', blogData.summary);
        if (blogData.standfirst) fd.append('standfirst', blogData.standfirst);
        if (blogData.reading_time) fd.append('reading_time', blogData.reading_time);
        if (blogData.author_byline) fd.append('author_byline', blogData.author_byline);
        if (blogData.image_caption) fd.append('image_caption', blogData.image_caption);
        if (blogData.image_alt) fd.append('image_alt', blogData.image_alt);
        if (blogData.pull_quote) fd.append('pull_quote', blogData.pull_quote);
        if (blogData.pull_quote_author) fd.append('pull_quote_author', blogData.pull_quote_author);
        if (blogData.concluding_insight) fd.append('concluding_insight', blogData.concluding_insight);
        if (blogData.is_featured !== undefined) fd.append('is_featured', String(blogData.is_featured));
        if (blogData.status) fd.append('status', blogData.status);
        if (blogData.scheduled_for) fd.append('scheduled_for', blogData.scheduled_for);
        if (blogData.related_to_book !== undefined) fd.append('related_to_book', String(blogData.related_to_book));
        if (blogData.book_concept) fd.append('book_concept', blogData.book_concept);
        if (blogData.related_blog_ids) fd.append('related_blog_ids', JSON.stringify(blogData.related_blog_ids));
        if (blogData.seo_title) fd.append('seo_title', blogData.seo_title);
        if (blogData.seo_description) fd.append('seo_description', blogData.seo_description);
        if (blogData.linkedin_url !== undefined) fd.append('linkedin_url', blogData.linkedin_url || '');
        if (blogData.instagram_url !== undefined) fd.append('instagram_url', blogData.instagram_url || '');
        if (blogData.facebook_url !== undefined) fd.append('facebook_url', blogData.facebook_url || '');

        const data = await apiRequest('/blogs', { method: 'POST', body: fd });
        return data.blog;
    }

    // No new file — JSON only
    const data = await apiRequest('/blogs', {
        method: 'POST',
        body: JSON.stringify({
            title: blogData.title,
            content: blogData.content,
            topic: blogData.topic,
            topic2: formattedTopic2 || null,
            published_date: blogData.published_date || new Date().toISOString().split('T')[0],
            title2: blogData.title2,
            content2: blogData.content2,
            image_url: blogData.image_url,
            image_path: blogData.image_path,
            slug: blogData.slug,
            summary: blogData.summary,
            standfirst: blogData.standfirst,
            reading_time: blogData.reading_time,
            author_byline: blogData.author_byline,
            image_caption: blogData.image_caption,
            image_alt: blogData.image_alt,
            pull_quote: blogData.pull_quote,
            pull_quote_author: blogData.pull_quote_author,
            concluding_insight: blogData.concluding_insight,
            is_featured: !!blogData.is_featured,
            status: blogData.status || 'published',
            scheduled_for: blogData.scheduled_for || null,
            related_to_book: !!blogData.related_to_book,
            book_concept: blogData.book_concept || null,
            related_blog_ids: blogData.related_blog_ids || [],
            seo_title: blogData.seo_title || null,
            seo_description: blogData.seo_description || null,
            linkedin_url: blogData.linkedin_url || null,
            instagram_url: blogData.instagram_url || null,
            facebook_url: blogData.facebook_url || null,
        }),
    });
    return data.blog;
}

/**
 * Update an existing Blog record via admin backend.
 */
export async function updateBlog(id, blogData) {
    const formattedTopic2 = formatTopic2(blogData.topic2);

    if (blogData.imageFile) {
        const fd = new FormData();
        fd.append('image', blogData.imageFile);
        fd.append('title', blogData.title || '');
        fd.append('content', blogData.content || '');
        fd.append('topic', blogData.topic || '');
        fd.append('topic2', formattedTopic2);
        if (blogData.published_date) fd.append('published_date', blogData.published_date);
        if (blogData.title2) fd.append('title2', blogData.title2);
        if (blogData.content2) fd.append('content2', blogData.content2);

        // Editorial fields
        if (blogData.slug) fd.append('slug', blogData.slug);
        if (blogData.summary) fd.append('summary', blogData.summary);
        if (blogData.standfirst) fd.append('standfirst', blogData.standfirst);
        if (blogData.reading_time) fd.append('reading_time', blogData.reading_time);
        if (blogData.author_byline) fd.append('author_byline', blogData.author_byline);
        if (blogData.image_caption) fd.append('image_caption', blogData.image_caption);
        if (blogData.image_alt) fd.append('image_alt', blogData.image_alt);
        if (blogData.pull_quote) fd.append('pull_quote', blogData.pull_quote);
        if (blogData.pull_quote_author) fd.append('pull_quote_author', blogData.pull_quote_author);
        if (blogData.concluding_insight) fd.append('concluding_insight', blogData.concluding_insight);
        if (blogData.is_featured !== undefined) fd.append('is_featured', String(blogData.is_featured));
        if (blogData.status) fd.append('status', blogData.status);
        if (blogData.scheduled_for) fd.append('scheduled_for', blogData.scheduled_for);
        if (blogData.related_to_book !== undefined) fd.append('related_to_book', String(blogData.related_to_book));
        if (blogData.book_concept) fd.append('book_concept', blogData.book_concept);
        if (blogData.related_blog_ids) fd.append('related_blog_ids', JSON.stringify(blogData.related_blog_ids));
        if (blogData.seo_title) fd.append('seo_title', blogData.seo_title);
        if (blogData.seo_description) fd.append('seo_description', blogData.seo_description);
        if (blogData.linkedin_url !== undefined) fd.append('linkedin_url', blogData.linkedin_url || '');
        if (blogData.instagram_url !== undefined) fd.append('instagram_url', blogData.instagram_url || '');
        if (blogData.facebook_url !== undefined) fd.append('facebook_url', blogData.facebook_url || '');

        const data = await apiRequest(`/blogs/${id}`, { method: 'PUT', body: fd });
        return data.blog;
    }

    // No new file — send JSON only
    const data = await apiRequest(`/blogs/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
            title: blogData.title,
            content: blogData.content,
            topic: blogData.topic,
            topic2: formattedTopic2 || null,
            published_date: blogData.published_date,
            title2: blogData.title2,
            content2: blogData.content2,
            image_url: blogData.image_url,
            image_path: blogData.image_path,
            slug: blogData.slug,
            summary: blogData.summary,
            standfirst: blogData.standfirst,
            reading_time: blogData.reading_time,
            author_byline: blogData.author_byline,
            image_caption: blogData.image_caption,
            image_alt: blogData.image_alt,
            pull_quote: blogData.pull_quote,
            pull_quote_author: blogData.pull_quote_author,
            concluding_insight: blogData.concluding_insight,
            is_featured: !!blogData.is_featured,
            status: blogData.status,
            scheduled_for: blogData.scheduled_for || null,
            related_to_book: !!blogData.related_to_book,
            book_concept: blogData.book_concept || null,
            related_blog_ids: blogData.related_blog_ids || [],
            seo_title: blogData.seo_title || null,
            seo_description: blogData.seo_description || null,
            linkedin_url: blogData.linkedin_url || null,
            instagram_url: blogData.instagram_url || null,
            facebook_url: blogData.facebook_url || null,
        }),
    });
    return data.blog;
}

/**
 * Fast status / featured toggle via PATCH
 */
export async function updateBlogStatus(id, { status, is_featured }) {
    const data = await apiRequest(`/blogs/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, is_featured })
    });
    return data.blog;
}

/**
 * Delete a single Blog record safely via admin backend
 */
export async function deleteBlog(id) {
    await apiRequest(`/blogs/${id}`, {
        method: 'DELETE'
    });
}
