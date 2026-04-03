import { supabase } from '../config/supabase';

// generateSlug removed as user's schema does not use slug
/**
 * Fetch all blogs safely
 */
export async function fetchBlogs() {
    const { data, error } = await supabase
        .from('blogs')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Fetch exactly one blog safely using its ID
 */
export async function fetchBlogById(id) {
    const { data, error } = await supabase
        .from('blogs')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Upload an image to the 'blogs' bucket
 * @param {File} file 
 * @returns {{ publicUrl: string, filePath: string } | null}
 */
export async function uploadCoverImage(file) {
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
 * Create a new Blog record
 */
export async function createBlog(blogData) {
    const { data, error } = await supabase
        .from('blogs')
        .insert([{
            title: blogData.title,
            content: blogData.content,
            topic: blogData.topic,
            published_date: blogData.published_date || new Date().toISOString().split('T')[0],
            title2: blogData.title2,
            content2: blogData.content2,
            image_url: blogData.image_url,
            image_path: blogData.image_path
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update an existing Blog record
 */
export async function updateBlog(id, blogData) {
    const updatePayload = {
        updated_at: new Date().toISOString()
    };

    // Only update fields that are strictly provided
    if (blogData.title) updatePayload.title = blogData.title;
    if (blogData.content) updatePayload.content = blogData.content;
    if (blogData.topic !== undefined) updatePayload.topic = blogData.topic;
    if (blogData.title2 !== undefined) updatePayload.title2 = blogData.title2;
    if (blogData.content2 !== undefined) updatePayload.content2 = blogData.content2;
    if (blogData.published_date !== undefined) updatePayload.published_date = blogData.published_date;
    if (blogData.image_url !== undefined) {
        updatePayload.image_url = blogData.image_url;
        updatePayload.image_path = blogData.image_path;
    }

    const { data, error } = await supabase
        .from('blogs')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Delete a single Blog record safely
 */
export async function deleteBlog(id) {
    const { error } = await supabase
        .from('blogs')
        .delete()
        .eq('id', id);

    if (error) throw error;
}
