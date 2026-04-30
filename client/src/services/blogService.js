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
 * Note: Since backend handles upload, this client side function isn't strictly needed 
 * if we just pass the File directly to the backend. But if components rely on it, we'll keep it.
 * Actually, the backend /api/blogs endpoint accepts multipart/form-data.
 */
export async function uploadCoverImage(file) {
    // Keep this for compatibility if any UI components use it independently
    if (!file) return null;

    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
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

/**
 * Create a new Blog record via admin backend
 */
export async function createBlog(blogData) {
    // Determine if we are sending JSON or FormData
    // If backend expects JSON and we have an image_url already
    const data = await apiRequest('/blogs', {
        method: 'POST',
        body: JSON.stringify({
            title: blogData.title,
            content: blogData.content,
            topic: blogData.topic,
            published_date: blogData.published_date || new Date().toISOString().split('T')[0],
            title2: blogData.title2,
            content2: blogData.content2,
            image_url: blogData.image_url,
            image_path: blogData.image_path
        })
    });
    return data.blog;
}

/**
 * Update an existing Blog record via admin backend
 */
export async function updateBlog(id, blogData) {
    const data = await apiRequest(`/blogs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(blogData)
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
