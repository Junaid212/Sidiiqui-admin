import { apiRequest } from '../config/api';

/**
 * Fetch all comments for a specific blog post via admin backend
 * @param {string} blogId 
 */
export async function fetchComments(blogId) {
    const data = await apiRequest(`/comments/${blogId}`);
    return data.comments || [];
}

/**
 * Post a new comment or reply via admin backend
 * @param {object} commentData 
 */
export async function postComment(commentData) {
    const data = await apiRequest('/comments', {
        method: 'POST',
        body: JSON.stringify({
            blog_id: commentData.blog_id,
            parent_id: commentData.parent_id || null,
            user_name: commentData.user_name,
            content: commentData.content,
            is_admin: commentData.is_admin || false
        })
    });
    return data.comment;
}

/**
 * Delete a comment via admin backend
 * @param {string} commentId 
 */
export async function deleteComment(commentId) {
    await apiRequest(`/comments/${commentId}`, {
        method: 'DELETE'
    });
}
