import { supabase } from '../config/supabase';

/**
 * Fetch all comments for a specific blog post
 * @param {string} blogId 
 */
export async function fetchComments(blogId) {
    const { data, error } = await supabase
        .from('blog_comments')
        .select('*')
        .eq('blog_id', blogId)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
}

/**
 * Post a new comment or reply
 * @param {object} commentData 
 */
export async function postComment(commentData) {
    const { data, error } = await supabase
        .from('blog_comments')
        .insert([{
            blog_id: commentData.blog_id,
            parent_id: commentData.parent_id || null,
            user_name: commentData.user_name,
            content: commentData.content,
            is_admin: commentData.is_admin || false
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Delete a comment (Admin only)
 * @param {string} commentId 
 */
export async function deleteComment(commentId) {
    const { error } = await supabase
        .from('blog_comments')
        .delete()
        .eq('id', commentId);

    if (error) throw error;
}
