import { useState, useEffect } from 'react';
import { apiRequest } from '../config/api';
import StatCard from '../components/Stats/StatCard';
import {
    HiOutlineCurrencyDollar,
    HiOutlineCursorClick,
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
        courseClicks: 0,
        consultations: 0,
        signIns: 0,
        consultationUsers: 0,
        ebookUsers: 0,
        blogs: 0,
        emailsSent: 0,
        contactMessages: 0,
    });
    const [blogs, setBlogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    async function fetchStats() {
        try {
            const [ebooks, clicks, signInsData, consultations, blogStats, emailsSent, contactMsgs, blogsData] = await Promise.all([
                apiRequest('/stats/ebooks'),
                apiRequest('/stats/course-clicks'),
                apiRequest('/admin/metrics/signins'),
                apiRequest('/stats/consultations-count'),
                apiRequest('/stats/blogs-count'),
                apiRequest('/stats/emails-sent-count'),
                apiRequest('/stats/contact-messages-count'),
                fetchBlogs(),
            ]);

            setStats({
                ebookRevenue: ebooks.total || 0,
                ebookCount: ebooks.count || 0,
                courseClicks: clicks.count || 0,
                consultations: consultations.count || 0,
                signIns: signInsData.total_users || 0,
                consultationUsers: signInsData.consultation_users || 0,
                ebookUsers: signInsData.ebook_users || 0,
                blogs: blogStats.count || 0,
                emailsSent: emailsSent.count || 0,
                contactMessages: contactMsgs.count || 0,
            });
            setBlogs(blogsData.slice(0, 3));
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err);
        } finally {
            setLoading(false);
        }
    }

    // Mock data for charts (in a real app, this would be fetched from the backend timeline API)
    const revenueData = [
        { name: 'Mon', revenue: stats.ebookRevenue * 0.1 },
        { name: 'Tue', revenue: stats.ebookRevenue * 0.15 },
        { name: 'Wed', revenue: stats.ebookRevenue * 0.05 },
        { name: 'Thu', revenue: stats.ebookRevenue * 0.25 },
        { name: 'Fri', revenue: stats.ebookRevenue * 0.2 },
        { name: 'Sat', revenue: stats.ebookRevenue * 0.15 },
        { name: 'Sun', revenue: stats.ebookRevenue * 0.1 },
    ];

    const interactionsData = [
        { name: 'Interactions', Course: stats.courseClicks, Consultations: stats.consultations, SignIns: stats.signIns },
    ];

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
                        value={` ${stats.ebookRevenue.toLocaleString()} `}
                        subtitle={`${stats.ebookCount} successful orders`}
                        icon={HiOutlineCurrencyDollar}
                        color="#10b981"
                    />
                </Link>
                <Link to="/course-interactions" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <StatCard
                        title="Course"
                        value={stats.courseClicks.toLocaleString()}
                        subtitle="Total course card clicks"
                        icon={HiOutlineCursorClick}
                        color="#6366f1"
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
                    <h3 className="chart-card__title">EBook Revenue Overview</h3>
                    <div className="chart-wrapper">
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
                                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                                    itemStyle={{ color: '#10b981' }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-card">
                    <h3 className="chart-card__title">User Interactions</h3>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={interactionsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                                    contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }} />
                                <Bar dataKey="Course" name="Course Clicks" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                                <Bar dataKey="Consultations" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
                                <Bar dataKey="SignIns" name="Sign-Ins" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
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
                        {blogs.map(blog => (
                            <div key={blog.id} style={{
                                background: 'var(--bg-card)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--border-color)',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                <div style={{ height: '160px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                                    {blog.image_url ? (
                                        <img src={blog.image_url} alt={blog.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>📝</div>
                                    )}
                                </div>
                                <div style={{ padding: '20px', flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: '700' }}>
                                        <span>{blog.topic?.toUpperCase() || 'GENERAL'}</span>
                                        <span style={{ color: 'var(--text-secondary)' }}>{new Date(blog.published_date || blog.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <h4 style={{ fontSize: '1.1rem', marginBottom: '10px', color: 'var(--text-primary)' }}>{blog.title}</h4>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {blog.content?.replace(/<[^>]+>/g, '')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
