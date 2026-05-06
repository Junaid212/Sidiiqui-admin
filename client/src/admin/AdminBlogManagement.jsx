import { useState, useEffect } from 'react';
import { fetchBlogs, createBlog, updateBlog, deleteBlog } from '../services/blogService';
import BlogList from '../components/Blog/BlogList';
import BlogForm from '../components/Blog/BlogForm';
import toast from 'react-hot-toast';

export default function AdminBlogManagement() {
    const [blogs, setBlogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingBlog, setEditingBlog] = useState(null);

    useEffect(() => {
        loadBlogs();
    }, []);

    async function loadBlogs() {
        try {
            const data = await fetchBlogs();
            setBlogs(data || []);
        } catch (err) {
            toast.error('Failed to load blogs from Supabase');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate(formData) {
        try {
            const data = await createBlog(formData);
            setBlogs((prev) => [data, ...prev]);
            setShowForm(false);
            toast.success('Blog created successfully');
        } catch (err) {
            toast.error(err.message || 'Failed to create blog');
        }
    }

    async function handleUpdate(formData) {
        try {
            const data = await updateBlog(editingBlog.id, formData);
            setBlogs((prev) =>
                prev.map((b) => (b.id === editingBlog.id ? data : b))
            );
            setEditingBlog(null);
            setShowForm(false);
            toast.success('Blog updated successfully');
        } catch (err) {
            toast.error(err.message || 'Failed to update blog');
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Are you sure you want to delete this blog post?')) return;

        try {
            await deleteBlog(id);
            setBlogs((prev) => prev.filter((b) => b.id !== id));
            toast.success('Blog deleted successfully');
        } catch (err) {
            toast.error('Failed to delete blog');
            console.error(err);
        }
    }

    function handleEdit(blog) {
        setEditingBlog(blog);
        setShowForm(true);
    }

    function handleCancel() {
        setShowForm(false);
        setEditingBlog(null);
    }

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner" />
                <p>Loading blogs...</p>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page__header">
                <div>
                    <h1 className="page__title">Admin Blog Management</h1>
                    <p className="page__subtitle">
                        {blogs.length} securely managed blog post{blogs.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    className="btn btn--primary"
                    onClick={() => {
                        setEditingBlog(null);
                        setShowForm(true);
                    }}
                >
                    + New Blog Post
                </button>
            </div>

            <BlogList blogs={blogs} onEdit={handleEdit} onDelete={handleDelete} />

            {showForm && (
                <BlogForm
                    blog={editingBlog}
                    onSubmit={editingBlog ? handleUpdate : handleCreate}
                    onCancel={handleCancel}
                />
            )}
        </div>
    );
}
