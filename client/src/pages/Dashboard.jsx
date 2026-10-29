import { useState, useEffect } from 'react';
import { apiRequest } from '../config/api';
import StatCard from '../components/Stats/StatCard';
import {
    HiOutlineCurrencyDollar,
    HiOutlineCalendar,
    HiOutlineUserGroup,
    HiOutlineNewspaper,
    HiOutlineMail,
} from 'react-icons/hi';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend,
} from 'recharts';

import { Link } from 'react-router-dom';
import { fetchBlogs } from '../services/blogService';

export default function Dashboard() {
    const [stats, setStats] = useState({
        ebookRevenue: 0,
        ebookCount: 0,
        ebookCurrency: 'USD',
        consultations: 0,
        signIns: 0,
        consultationUsers: 0,
        ebookUsers: 0,
        blogs: 0,
        emailsSent: 0,
        contactMessages: 0,
    });
    const [revenueData, setRevenueData] = useState([]);
    const [interactionsData, setInteractionsData] = useState([]);
    const [blogs, setBlogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    async function fetchStats() {
        try {
            const [
                ebooks,
                signInsData,
                consultations,
                blogStats,
                emailsSent,
                contactMsgs,
                blogsData,
                timelineData
            ] = await Promise.all([
                apiRequest('/stats/ebooks').catch(err => {
                    console.error('Failed to fetch ebooks stats:', err);
                    return { total: 0, count: 0, currency: 'USD' };
                }),
                apiRequest('/admin/metrics/signins').catch(err => {
                    console.error('Failed to fetch signins metrics:', err);
                    return { total_users: 0, consultation_users: 0, ebook_users: 0 };
                }),
                apiRequest('/stats/consultations-count').catch(err => {
                    console.error('Failed to fetch consultations count:', err);
                    return { count: 0 };
                }),
                apiRequest('/stats/blogs-count').catch(err => {
                    console.error('Failed to fetch blogs count:', err);
                    return { count: 0 };
                }),
                apiRequest('/stats/emails-sent-count').catch(err => {
                    console.error('Failed to fetch emails sent count:', err);
                    return { count: 0 };
                }),
                apiRequest('/stats/contact-messages-count').catch(err => {
                    console.error('Failed to fetch contact messages count:', err);
                    return { count: 0 };
                }),
                fetchBlogs().catch(err => {
                    console.error('Failed to fetch blogs:', err);
                    return [];
                }),
                apiRequest('/stats/timeline').catch(err => {
                    console.error('Failed to fetch timeline data:', err);
                    return { revenueTimeline: [], interactionsTimeline: [], currency: 'USD' };
                }),
            ]);

            setStats({
                ebookRevenue: ebooks?.total || 0,
                ebookCount: ebooks?.count || 0,
                ebookCurrency: ebooks?.currency || 'USD',
                consultations: consultations?.count || 0,
                signIns: signInsData?.total_users || 0,
                consultationUsers: signInsData?.consultation_users || 0,
                ebookUsers: signInsData?.ebook_users || 0,
                blogs: blogStats?.count || 0,
                emailsSent: emailsSent?.count || 0,
                contactMessages: contactMsgs?.count || 0,
            });

            // Deterministic sorting for recent blogs:
            // 1. Published / Scheduled Date DESC (fallback to created_at)
            // 2. Created At DESC
            // 3. Title ASC
            const rawBlogs = Array.isArray(blogsData) ? blogsData : (blogsData?.blogs || []);
            const sortedBlogs = [...rawBlogs].sort((a, b) => {
                const dateA = new Date(a.published_date || a.created_at).getTime() || 0;
                const dateB = new Date(b.published_date || b.created_at).getTime() || 0;
                if (dateB !== dateA) return dateB - dateA;
                const createdA = new Date(a.created_at).getTime() || 0;
                const createdB = new Date(b.created_at).getTime() || 0;
                if (createdB !== createdA) return createdB - createdA;
                return (a.title || '').localeCompare(b.title || '');
            });
            setBlogs(sortedBlogs.slice(0, 3));

            // Genuine database timeline datasets
            if (timelineData?.revenueTimeline && Array.isArray(timelineData.revenueTimeline)) {
                setRevenueData(timelineData.revenueTimeline);
            }
            if (timelineData?.interactionsTimeline && Array.isArray(timelineData.interactionsTimeline)) {
                setInteractionsData(timelineData.interactionsTimeline);
            }
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err);
        } finally {
            setLoading(false);
        }
    }

    function getBlogStatusBadge(status) {
        const st = (status || 'published').toLowerCase();
        if (st === 'published') {
            return {
                label: 'Published',
                style: {
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    textTransform: 'uppercase'
                }
            };
        }
        if (st === 'scheduled') {
            return {
                label: 'Scheduled',
                style: {
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    textTransform: 'uppercase'
                }
            };
        }
        return {
            label: st.toUpperCase(),
            style: {
                background: 'rgba(113, 113, 122, 0.2)',
                color: '#a1a1aa',
                border: '1px solid rgba(113, 113, 122, 0.3)',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: '700',
                textTransform: 'uppercase'
            }
        };
    }

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner" />
                <p>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page__header">
                <h1 className="page__title">Dashboard</h1>
                <p className="page__subtitle">Overview of your platform metrics</p>
            </div>

            <div className="stats-grid">
                <Link to="/orders" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <StatCard
                        title="EBook"
                        value={`${stats.ebookCurrency === 'AED' ? 'AED ' : '$'}${stats.ebookRevenue.toLocaleString()}`}
                        subtitle={`${stats.ebookCount} successful orders`}
                        icon={HiOutlineCurrencyDollar}
                        color="#10b981"
                    />
                </Link>
                <Link to="/consultations" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <StatCard
                        title="Consultations"
                        value={stats.consultations.toLocaleString()}
                        subtitle="Total bookings"
                        icon={HiOutlineCalendar}
                        color="#f59e0b"
                    />
                </Link>
                <Link to="/sign-ins" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <StatCard
                        title="Sign-In Metrics"
                        value={stats.signIns.toLocaleString()}
                        subtitle={
                            <span style={{ fontSize: '0.8rem' }}>
                                <strong>{stats.consultationUsers}</strong> via Consultations<br/>
                                <strong>{stats.ebookUsers}</strong> via Ebooks
                            </span>
                        }
                        icon={HiOutlineUserGroup}
                        color="#ef4444"
                    />
                </Link>
                <Link to="/blogs" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <StatCard
                        title="Active Blogs"
                        value={stats.blogs.toLocaleString()}
                        subtitle="Total published posts"
                        icon={HiOutlineNewspaper}
                        color="#ec4899"
                    />
                </Link>
                <Link to="/consultations" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <StatCard
                        title="Emails Sent"
                        value={stats.emailsSent.toLocaleString()}
                        subtitle="Confirmation emails delivered"
                        icon={HiOutlineMail}
                        color="#06b6d4"
                    />
                </Link>
                <Link to="/contact-messages" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <StatCard
                        title="Contact Messages"
                        value={stats.contactMessages.toLocaleString()}
                        subtitle="Form submissions received"
                        icon={HiOutlineMail}
                        color="#8b5cf6"
                    />
                </Link>
            </div>

            <div className="dashboard-charts">
                <div className="chart-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 className="chart-card__title" style={{ margin: 0 }}>EBook Revenue Overview</h3>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.05)', padding: '4px 10px', borderRadius: '6px' }}>
                            7-Day Trend ({stats.ebookCurrency})
                        </span>
                    </div>
                    <div className="chart-wrapper">
                        {revenueData.length === 0 ? (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                No revenue records found
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                                        itemStyle={{ color: '#10b981' }}
                                        formatter={(val, name, item) => [`$${val} (${item.payload.orders || 0} orders)`, 'Revenue']}
                                    />
                                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <div className="chart-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 className="chart-card__title" style={{ margin: 0 }}>Platform Activity</h3>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.05)', padding: '4px 10px', borderRadius: '6px' }}>
                            Monthly Engagement
                        </span>
                    </div>
                    <div className="chart-wrapper">
                        {interactionsData.length === 0 ? (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                No interaction records found
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={interactionsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                                        contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }} />
                                    <Bar dataKey="Consultations" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={28} />
                                    <Bar dataKey="SignIns" name="Sign-Ins" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={28} />
                                    <Bar dataKey="ContactMessages" name="Contact Messages" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={28} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            <div className="dashboard-recent" style={{ marginTop: '40px' }}>
                <div className="page__header" style={{ marginBottom: '20px' }}>
                    <h2 className="page__title">Recent Blog Posts</h2>
                    <Link to="/blogs" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem' }}>
                        Manage All Blogs →
                    </Link>
                </div>

                {blogs.length === 0 ? (
                    <div style={{ background: 'var(--bg-card)', padding: '40px', borderRadius: 'var(--radius-lg)', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                        <p style={{ color: 'var(--text-secondary)' }}>No blogs found. Go to Blog Management to create one!</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                        {blogs.map(blog => {
                            const statusBadge = getBlogStatusBadge(blog.status);
                            const displayDate = blog.published_date
                                ? new Date(blog.published_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : new Date(blog.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                            return (
                                <div key={blog.id} style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--border-color)',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}>
                                    <div style={{ height: '160px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', position: 'relative' }}>
                                        {blog.image_url ? (
                                            <img src={blog.image_url} alt={blog.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>📝</div>
                                        )}
                                        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                                            <span style={statusBadge.style}>{statusBadge.label}</span>
                                        </div>
                                    </div>
                                    <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.75rem' }}>
                                            <span style={{ color: 'var(--accent-primary)', fontWeight: '700' }}>{blog.topic?.toUpperCase() || 'GENERAL'}</span>
                                            <span style={{ color: 'var(--text-secondary)' }}>{displayDate}</span>
                                        </div>
                                        <h4 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'var(--text-primary)', lineHeight: '1.4' }}>{blog.title}</h4>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>
                                            {blog.content?.replace(/<[^>]+>/g, '')}
                                        </p>
                                        <Link to="/blogs" style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: '600' }}>
                                            View in Blog Management →
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
