import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchComments, postComment, deleteComment, approveComment, rejectComment } from '../services/commentService';
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
    const [filterTab, setFilterTab] = useState('all'); // 'all', 'pending', 'approved'

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

    async function handleApprove(commentId) {
        try {
            await approveComment(commentId);
            setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_approved: true, status: 'approved' } : c));
            toast.success('Comment approved and now visible publicly');
        } catch (err) {
            toast.error('Failed to approve comment');
        }
    }

    async function handleReject(commentId) {
        try {
            await rejectComment(commentId);
            setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_approved: false, status: 'rejected' } : c));
            toast.success('Comment rejected');
        } catch (err) {
            toast.error('Failed to reject comment');
        }
    }

    async function handleDelete(commentId) {
        if (!window.confirm('Delete this comment?')) return;
        try {
            await deleteComment(commentId);
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
                user_name: 'M. Q. Siddiqui',
                content: replyContent,
                is_admin: true
            });
            setComments(prev => [...prev, data]);
            setReplyingTo(null);
            setReplyContent('');
            toast.success('Reply posted — visible on the public article');
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
                user_name: 'M. Q. Siddiqui',
                content: newComment,
                is_admin: true
            });
            setComments(prev => [...prev, data]);
            setNewComment('');
            toast.success('Comment posted as Admin');
        } catch (err) {
            toast.error('Failed to post comment');
        }
    }

    if (loading) return <div className="page-loading"><div className="spinner" /></div>;

    const rootComments = comments.filter(c => !c.parent_id);
    const getReplies = (parentId) => comments.filter(c => c.parent_id === parentId);

    const pendingComments = comments.filter(c => !c.is_admin && (c.is_approved === false || c.status === 'pending'));
    const approvedComments = comments.filter(c => c.is_admin || c.is_approved === true || c.status === 'approved');

    const displayedRootComments = rootComments.filter(c => {
        if (filterTab === 'pending') return c.is_approved === false || c.status === 'pending';
        if (filterTab === 'approved') return c.is_admin || c.is_approved === true || c.status === 'approved';
        return true;
    });

    return (
        <div className="page">
            <button className="btn btn--outline btn--sm" style={{ marginBottom: '16px' }} onClick={() => navigate('/blogs')}>
                ← Back to Articles
            </button>

            <div className="page__header" style={{ marginBottom: '20px' }}>
                <div>
                    <h1 className="page__title">💬 Comment Moderation</h1>
                    <p className="page__subtitle">Article: <strong>{blog?.title}</strong></p>
                </div>
            </div>

            {/* Stats Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }}>{comments.length}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Comments</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800', color: pendingComments.length > 0 ? '#f59e0b' : '#10b981' }}>{pendingComments.length}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pending Review</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#10b981' }}>{approvedComments.length}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Approved / Public</div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {[
                    { id: 'all', label: `All (${rootComments.length})` },
                    { id: 'pending', label: `⏳ Pending Review (${pendingComments.length})` },
                    { id: 'approved', label: `✓ Approved (${approvedComments.length})` },
                ].map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFilterTab(tab.id)}
                        style={{
                            background: filterTab === tab.id ? 'var(--accent-primary, #A3192F)' : 'var(--bg-card)',
                            color: filterTab === tab.id ? '#fff' : 'inherit',
                            border: '1px solid var(--border-color)',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Admin New Comment */}
            <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>✍️ Post Direct Comment as Author / Admin</h4>
                <form onSubmit={handleNewComment} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <textarea
                        rows={2}
                        placeholder="Write a comment as Author / Admin (published immediately)..."
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
                    />
                    <button type="submit" className="btn btn--primary btn--sm" style={{ alignSelf: 'flex-start' }}>
                        Post Official Response
                    </button>
                </form>
            </div>

            {/* Comments Threads */}
            <div className="comments-admin-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {displayedRootComments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-card)', borderRadius: '10px', color: 'var(--text-muted)' }}>
                        <p>No comments in this section.</p>
                    </div>
                ) : (
                    displayedRootComments.map(comment => {
                        const isPending = !comment.is_admin && (comment.is_approved === false || comment.status === 'pending');
                        const isApproved = comment.is_admin || comment.is_approved === true || comment.status === 'approved';

                        return (
                            <div key={comment.id} style={{
                                background: 'var(--bg-card)',
                                border: isPending ? '2px solid rgba(245, 158, 11, 0.5)' : '1px solid var(--border-color)',
                                borderRadius: '10px',
                                padding: '20px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                    <div>
                                        <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{comment.is_admin || comment.user_name?.toLowerCase() === 'admin' ? 'M. Q. Siddiqui' : comment.user_name}</span>
                                        {comment.is_admin && (
                                            <span style={{ background: 'var(--accent-primary)', color: '#fff', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '12px', marginLeft: '8px', fontWeight: 'bold' }}>
                                                AUTHOR
                                            </span>
                                        )}
                                        {isPending && (
                                            <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', marginLeft: '8px', fontWeight: 'bold' }}>
                                                ⏳ PENDING APPROVAL
                                            </span>
                                        )}
                                        {isApproved && !comment.is_admin && (
                                            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', marginLeft: '8px', fontWeight: 'bold' }}>
                                                ✓ APPROVED
                                            </span>
                                        )}
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {new Date(comment.created_at).toLocaleString()}
                                        </div>
                                    </div>

                                    {/* Moderation Actions */}
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        {isPending && (
                                            <button
                                                type="button"
                                                onClick={() => handleApprove(comment.id)}
                                                style={{ background: '#10b981', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                                            >
                                                ✓ Approve
                                            </button>
                                        )}
                                        {isApproved && !comment.is_admin && (
                                            <button
                                                type="button"
                                                onClick={() => handleReject(comment.id)}
                                                style={{ background: 'var(--bg-input)', color: '#f59e0b', border: '1px solid #f59e0b', padding: '5px 10px', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}
                                            >
                                                Unpublish
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className="btn btn--danger btn--sm"
                                            onClick={() => handleDelete(comment.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                <p style={{ margin: '10px 0 14px', fontSize: '0.92rem', lineHeight: '1.6' }}>
                                    {comment.content}
                                </p>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        type="button"
                                        className="btn btn--outline btn--sm"
                                        onClick={() => setReplyingTo(comment)}
                                    >
                                        ↩ Reply as M. Q. Siddiqui
                                    </button>
                                </div>

                                {/* Replies list */}
                                {getReplies(comment.id).length > 0 && (
                                    <div style={{ marginLeft: '24px', marginTop: '14px', borderLeft: '2px solid var(--border-color)', paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {getReplies(comment.id).map(reply => (
                                            <div key={reply.id} style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '6px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>{reply.is_admin || reply.user_name?.toLowerCase() === 'admin' ? 'M. Q. Siddiqui' : reply.user_name}</span>
                                                        {reply.is_admin && (
                                                            <span style={{ background: 'var(--accent-primary)', color: '#fff', fontSize: '0.62rem', padding: '1px 6px', borderRadius: '8px', marginLeft: '6px', fontWeight: 'bold' }}>AUTHOR</span>
                                                        )}
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                                            {new Date(reply.created_at).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <button type="button" className="btn btn--danger btn--sm" onClick={() => handleDelete(reply.id)} style={{ padding: '2px 6px', fontSize: '0.75rem' }}>
                                                        Delete
                                                    </button>
                                                </div>
                                                <p style={{ margin: '6px 0 0', fontSize: '0.88rem' }}>{reply.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Reply Input */}
                                {replyingTo?.id === comment.id && (
                                    <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-input)', borderRadius: '6px' }}>
                                        <form onSubmit={handleReply}>
                                            <textarea
                                                rows={2}
                                                placeholder={`Reply to ${comment.user_name}...`}
                                                value={replyContent}
                                                onChange={e => setReplyContent(e.target.value)}
                                                autoFocus
                                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                            />
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                <button type="submit" className="btn btn--primary btn--sm">Post Reply</button>
                                                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setReplyingTo(null)}>Cancel</button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
