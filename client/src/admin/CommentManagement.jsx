import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchComments, postComment, deleteComment } from '../services/commentService';
import { fetchBlogById } from '../services/blogService';
import toast from 'react-hot-toast';

export default function CommentManagement() {
    const { id: blogId } = useParams();
    const navigate = useNavigate();
    const [comments, setComments] = useState([]);
    const [blog, setBlog] = useState(null);
    const [loading, setLoading] = useState(true);
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyContent, setReplyContent] = useState('');
    const [newComment, setNewComment] = useState('');

    useEffect(() => {
        loadData();
    }, [blogId]);

    async function loadData() {
        try {
            const blogData = await fetchBlogById(blogId);
            setBlog(blogData);
            const commentsData = await fetchComments(blogId);
            setComments(commentsData || []);
        } catch (err) {
            toast.error('Failed to load blog comments');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(commentId) {
        if (!window.confirm('Delete this comment?')) return;
        try {
            await deleteComment(commentId);
            // Re-fetch from DB to ensure cascaded deletes are reflected
            const fresh = await fetchComments(blogId);
            setComments(fresh);
            toast.success('Comment deleted');
        } catch (err) {
            toast.error('Failed to delete comment');
            console.error(err);
        }
    }

    async function handleReply(e) {
        e.preventDefault();
        if (!replyContent.trim()) return;
        try {
            const data = await postComment({
                blog_id: blogId,
                parent_id: replyingTo.id,
                user_name: 'Admin',
                content: replyContent,
                is_admin: true
            });
            setComments(prev => [...prev, data]);
            setReplyingTo(null);
            setReplyContent('');
            toast.success('Reply posted — now visible on the blog page');
        } catch (err) {
            toast.error('Failed to post reply');
        }
    }

    async function handleNewComment(e) {
        e.preventDefault();
        if (!newComment.trim()) return;
        try {
            const data = await postComment({
                blog_id: blogId,
                parent_id: null,
                user_name: 'Admin',
                content: newComment,
                is_admin: true
            });
            setComments(prev => [...prev, data]);
            setNewComment('');
            toast.success('Comment posted — now visible on the blog page');
        } catch (err) {
            toast.error('Failed to post comment');
        }
    }

    if (loading) return <div className="page-loading"><div className="spinner" /></div>;

    const rootComments = comments.filter(c => !c.parent_id);
    const getReplies = (parentId) => comments.filter(c => c.parent_id === parentId);

    return (
        <>
            <style>{`
                .cm-back {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: none;
                    border: 1px solid var(--border-color);
                    color: var(--text-secondary);
                    padding: 6px 14px;
                    border-radius: var(--radius-sm);
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: var(--transition-fast);
                    margin-bottom: 16px;
                }
                .cm-back:hover {
                    border-color: var(--accent-primary);
                    color: var(--accent-primary);
                }
                .cm-stats {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 24px;
                }
                .cm-stat-card {
                    flex: 1;
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    padding: 16px 20px;
                    text-align: center;
                }
                .cm-stat-number {
                    font-size: 1.8rem;
                    font-weight: 800;
                    background: var(--accent-gradient);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .cm-stat-label {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-top: 4px;
                }
                .cm-thread {
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-lg);
                    padding: 24px;
                    margin-bottom: 16px;
                    transition: var(--transition-base);
                }
                .cm-thread:hover {
                    border-color: rgba(255,255,255,0.1);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                }
                .cm-comment-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 12px;
                }
                .cm-user-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .cm-avatar {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 0.85rem;
                    color: #fff;
                    flex-shrink: 0;
                }
                .cm-avatar.user { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
                .cm-avatar.admin { background: var(--accent-gradient); }
                .cm-user-name {
                    font-weight: 600;
                    font-size: 0.9rem;
                    color: var(--text-primary);
                }
                .cm-admin-badge {
                    display: inline-block;
                    background: var(--accent-gradient);
                    color: #fff;
                    font-size: 0.65rem;
                    font-weight: 700;
                    padding: 2px 8px;
                    border-radius: 20px;
                    margin-left: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .cm-date {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }
                .cm-content {
                    font-size: 0.92rem;
                    line-height: 1.6;
                    color: var(--text-primary);
                    margin-bottom: 12px;
                    padding-left: 46px;
                }
                .cm-actions {
                    padding-left: 46px;
                    display: flex;
                    gap: 8px;
                }
                .cm-action-btn {
                    background: none;
                    border: 1px solid var(--border-color);
                    color: var(--text-secondary);
                    padding: 4px 12px;
                    border-radius: var(--radius-sm);
                    font-size: 0.78rem;
                    cursor: pointer;
                    transition: var(--transition-fast);
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }
                .cm-action-btn:hover {
                    border-color: var(--accent-primary);
                    color: var(--accent-primary);
                }
                .cm-action-btn.danger:hover {
                    border-color: var(--danger);
                    color: var(--danger);
                }
                .cm-replies {
                    margin-top: 16px;
                    margin-left: 46px;
                    border-left: 2px solid rgba(255,255,255,0.06);
                    padding-left: 20px;
                }
                .cm-reply-item {
                    padding: 12px 16px;
                    background: var(--bg-glass);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    margin-bottom: 10px;
                    transition: var(--transition-fast);
                }
                .cm-reply-item:hover {
                    background: var(--bg-hover);
                }
                .cm-reply-form {
                    margin-top: 12px;
                    margin-left: 46px;
                    background: var(--bg-glass);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    padding: 16px;
                }
                .cm-reply-form textarea {
                    width: 100%;
                    background: var(--bg-input);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-sm);
                    color: var(--text-primary);
                    padding: 10px 14px;
                    font-size: 0.88rem;
                    resize: vertical;
                    min-height: 60px;
                    font-family: inherit;
                }
                .cm-reply-form textarea:focus {
                    outline: none;
                    border-color: var(--accent-primary);
                }
                .cm-new-comment {
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-lg);
                    padding: 24px;
                    margin-bottom: 24px;
                }
                .cm-new-comment h3 {
                    font-size: 1rem;
                    font-weight: 600;
                    margin-bottom: 12px;
                    color: var(--text-primary);
                }
                .cm-new-comment textarea {
                    width: 100%;
                    background: var(--bg-input);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-sm);
                    color: var(--text-primary);
                    padding: 12px 16px;
                    font-size: 0.9rem;
                    resize: vertical;
                    min-height: 80px;
                    font-family: inherit;
                    margin-bottom: 12px;
                }
                .cm-new-comment textarea:focus {
                    outline: none;
                    border-color: var(--accent-primary);
                }
                .cm-empty {
                    text-align: center;
                    padding: 60px 20px;
                    color: var(--text-muted);
                }
                .cm-empty-icon {
                    font-size: 3rem;
                    margin-bottom: 12px;
                    opacity: 0.5;
                }
            `}</style>

            <div className="page">
                <button className="cm-back" onClick={() => navigate('/blogs')}>
                    ← Back to Blogs
                </button>

                <div className="page__header" style={{ marginBottom: '24px' }}>
                    <div>
                        <h1 className="page__title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            💬 {blog?.title}
                        </h1>
                        <p className="page__subtitle">Manage comments and engage with your readers</p>
                    </div>
                </div>

                {/* Stats */}
                <div className="cm-stats">
                    <div className="cm-stat-card">
                        <div className="cm-stat-number">{comments.length}</div>
                        <div className="cm-stat-label">Total Comments</div>
                    </div>
                    <div className="cm-stat-card">
                        <div className="cm-stat-number">{rootComments.length}</div>
                        <div className="cm-stat-label">Threads</div>
                    </div>
                    <div className="cm-stat-card">
                        <div className="cm-stat-number">{comments.filter(c => c.is_admin).length}</div>
                        <div className="cm-stat-label">Admin Replies</div>
                    </div>
                </div>

                {/* Admin New Comment */}
                <div className="cm-new-comment">
                    <h3>✍️ Post as Admin</h3>
                    <form onSubmit={handleNewComment}>
                        <textarea
                            placeholder="Write a comment as Admin — it will appear on the public blog page..."
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                        />
                        <button type="submit" className="btn btn--primary btn--sm">
                            Post Comment
                        </button>
                    </form>
                </div>

                {/* Comments List */}
                <div className="comments-admin-list">
                    {rootComments.length === 0 ? (
                        <div className="cm-empty">
                            <div className="cm-empty-icon">💬</div>
                            <p>No comments on this post yet.</p>
                            <p style={{ fontSize: '0.8rem' }}>Start the conversation by posting as Admin above!</p>
                        </div>
                    ) : (
                        rootComments.map(comment => (
                            <div key={comment.id} className="cm-thread">
                                <div className="cm-comment-header">
                                    <div className="cm-user-info">
                                        <div className={`cm-avatar ${comment.is_admin ? 'admin' : 'user'}`}>
                                            {comment.user_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <span className="cm-user-name">
                                                {comment.user_name}
                                                {comment.is_admin && <span className="cm-admin-badge">Admin</span>}
                                            </span>
                                            <div className="cm-date">{new Date(comment.created_at).toLocaleString()}</div>
                                        </div>
                                    </div>
                                </div>

                                <p className="cm-content">{comment.content}</p>

                                <div className="cm-actions">
                                    <button className="cm-action-btn" onClick={() => setReplyingTo(comment)}>
                                        ↩ Reply
                                    </button>
                                    <button className="cm-action-btn danger" onClick={() => handleDelete(comment.id)}>
                                        🗑 Delete
                                    </button>
                                </div>

                                {/* Replies */}
                                {getReplies(comment.id).length > 0 && (
                                    <div className="cm-replies">
                                        {getReplies(comment.id).map(reply => (
                                            <div key={reply.id} className="cm-reply-item">
                                                <div className="cm-comment-header">
                                                    <div className="cm-user-info">
                                                        <div className={`cm-avatar ${reply.is_admin ? 'admin' : 'user'}`}
                                                            style={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                                                            {reply.user_name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <span className="cm-user-name" style={{ fontSize: '0.85rem' }}>
                                                                {reply.user_name}
                                                                {reply.is_admin && <span className="cm-admin-badge">Admin</span>}
                                                            </span>
                                                            <div className="cm-date">{new Date(reply.created_at).toLocaleString()}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', margin: '8px 0 8px 38px' }}>
                                                    {reply.content}
                                                </p>
                                                <div style={{ paddingLeft: '38px' }}>
                                                    <button className="cm-action-btn danger" onClick={() => handleDelete(reply.id)}>
                                                        🗑 Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Reply Form */}
                                {replyingTo?.id === comment.id && (
                                    <div className="cm-reply-form">
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                            Replying to <strong style={{ color: 'var(--text-primary)' }}>{comment.user_name}</strong>
                                        </div>
                                        <form onSubmit={handleReply}>
                                            <textarea
                                                placeholder="Write your admin reply..."
                                                value={replyContent}
                                                onChange={e => setReplyContent(e.target.value)}
                                                autoFocus
                                            />
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                                <button type="submit" className="btn btn--primary btn--sm">Post Reply</button>
                                                <button type="button" className="btn btn--outline btn--sm" onClick={() => setReplyingTo(null)}>Cancel</button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
