import { useState, useEffect } from 'react';
import { apiRequest } from '../config/api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
    HiOutlineArrowLeft,
    HiOutlineMail,
    HiOutlineTrash,
    HiOutlineSearch,
    HiOutlineInbox,
} from 'react-icons/hi';

export default function ContactMessages() {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        fetchMessages();
    }, []);

    async function fetchMessages() {
        try {
            const data = await apiRequest('/contact-messages');
            setMessages(data.messages || []);
        } catch (err) {
            toast.error('Failed to load contact messages');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Delete this message? This cannot be undone.')) return;
        try {
            await apiRequest(`/contact-messages/${id}`, { method: 'DELETE' });
            setMessages(prev => prev.filter(m => m.id !== id));
            toast.success('Message deleted');
        } catch (err) {
            toast.error('Failed to delete message');
        }
    }

    const filtered = messages.filter(m => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            m.email?.toLowerCase().includes(q) ||
            m.subject?.toLowerCase().includes(q) ||
            m.name?.toLowerCase().includes(q)
        );
    });

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner" />
                <p>Loading contact messages...</p>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page__header" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                    <HiOutlineArrowLeft /> Back to Dashboard
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h1 className="page__title">Contact Messages</h1>
                        <p className="page__subtitle">
                            {messages.length} message{messages.length !== 1 ? 's' : ''} received
                        </p>
                    </div>
                    <div style={{ position: 'relative', minWidth: '260px' }}>
                        <HiOutlineSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem' }} />
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Search by name, email, or subject..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: '38px', fontSize: '0.85rem' }}
                        />
                    </div>
                </div>
            </div>

            {filtered.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '60px 20px',
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                }}>
                    <HiOutlineInbox style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: '12px' }} />
                    <h3 style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                        {search ? 'No matching messages' : 'No messages yet'}
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {search ? 'Try a different search term.' : 'Contact form submissions will appear here.'}
                    </p>
                </div>
            ) : (
                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Subject</th>
                                <th>Message</th>
                                <th>Date</th>
                                <th style={{ width: '60px' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(msg => (
                                <tr key={msg.id}>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                        {msg.name}
                                    </td>
                                    <td>
                                        <a href={`mailto:${msg.email}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontSize: '0.85rem' }}>
                                            {msg.email}
                                        </a>
                                    </td>
                                    <td style={{ color: 'var(--text-primary)' }}>
                                        {msg.subject}
                                    </td>
                                    <td style={{ maxWidth: '300px' }}>
                                        {expandedId === msg.id ? (
                                            <div>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                                    {msg.message}
                                                </p>
                                                <button
                                                    onClick={() => setExpandedId(null)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.78rem', padding: '4px 0', marginTop: '4px' }}
                                                >
                                                    Show less
                                                </button>
                                            </div>
                                        ) : (
                                            <div>
                                                <p style={{
                                                    color: 'var(--text-secondary)', fontSize: '0.85rem',
                                                    overflow: 'hidden', textOverflow: 'ellipsis',
                                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                                }}>
                                                    {msg.message}
                                                </p>
                                                {msg.message?.length > 100 && (
                                                    <button
                                                        onClick={() => setExpandedId(msg.id)}
                                                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.78rem', padding: '4px 0', marginTop: '2px' }}
                                                    >
                                                        Read more
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                        {new Date(msg.created_at).toLocaleDateString('en-US', {
                                            year: 'numeric', month: 'short', day: 'numeric',
                                        })}
                                        <br />
                                        <span style={{ fontSize: '0.75rem' }}>
                                            {new Date(msg.created_at).toLocaleTimeString('en-US', {
                                                hour: '2-digit', minute: '2-digit',
                                            })}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            className="btn btn--danger btn--sm"
                                            onClick={() => handleDelete(msg.id)}
                                            title="Delete message"
                                            style={{ padding: '6px 8px', minWidth: 'auto' }}
                                        >
                                            <HiOutlineTrash />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
