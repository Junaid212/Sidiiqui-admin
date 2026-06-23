import React, { useState, useEffect, useCallback } from 'react';
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
    HiOutlineDownload, HiOutlineRefresh, HiOutlineUsers,
    HiOutlineClipboardList, HiOutlineSearch, HiOutlineFilter,
    HiOutlineLightBulb,
} from 'react-icons/hi';
import {
    fetchQuestionnaireAnalytics,
    fetchSubmissions,
    fetchProfiles,
    downloadCSV,
    downloadExcel,
} from '../services/questionnaireService';
import toast from 'react-hot-toast';

/* ─── Palettes ───────────────────────────────────────────────── */
const CATEGORY_META = {
    'Promotional Thinker':       { color: '#f97316', emoji: '📢' },
    'Sales Thinker':             { color: '#eab308', emoji: '📈' },
    'Value Thinker':             { color: '#22c55e', emoji: '💡' },
    'Strategic Value Architect': { color: '#ef4444', emoji: '🏛️' },
};
const PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#6366f1'];

/* ─── Custom Tooltip ─────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem' }}>
            {label && <p style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</p>}
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.fill || p.color || '#ef4444', fontWeight: 600 }}>
                    {p.name}: {p.value}
                </p>
            ))}
        </div>
    );
}

/* ─── Stat Card ──────────────────────────────────────────────── */
function StatCard({ icon: Icon, title, value, subtitle, color }) {
    return (
        <div className="stat-card" style={{ '--card-accent': color }}>
            <div className="stat-card__header">
                <div className="stat-card__icon-wrap"><Icon className="stat-card__icon" /></div>
                <div>
                    <p className="stat-card__title">{title}</p>
                    {subtitle && <span className="stat-card__subtitle">{subtitle}</span>}
                </div>
            </div>
            <p className="stat-card__value">{value}</p>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function QuestionnaireAnalytics() {
    const [analytics, setAnalytics] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [subLoading, setSubLoading] = useState(false);
    const [exporting, setExporting] = useState(null);

    const [filterProfile, setFilterProfile] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterSearch, setFilterSearch] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [expandedRow, setExpandedRow] = useState(null);

    const loadAnalytics = useCallback(async () => {
        try { const d = await fetchQuestionnaireAnalytics(); setAnalytics(d); }
        catch { toast.error('Failed to load analytics'); }
    }, []);

    const loadSubmissions = useCallback(async () => {
        setSubLoading(true);
        try {
            const d = await fetchSubmissions({
                page, limit: 25,
                profile: filterProfile,
                category: filterCategory,
                search: filterSearch,
                dateFrom: filterDateFrom,
                dateTo: filterDateTo,
            });
            setSubmissions(d.submissions || []);
            setTotalPages(d.total_pages || 1);
            setTotalCount(d.total || 0);
        } catch { toast.error('Failed to load submissions'); }
        finally { setSubLoading(false); }
    }, [page, filterProfile, filterCategory, filterSearch, filterDateFrom, filterDateTo]);

    const loadProfiles = useCallback(async () => {
        try { const d = await fetchProfiles(); setProfiles(d.profiles || []); } catch { }
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            await Promise.all([loadAnalytics(), loadProfiles()]);
            setLoading(false);
        })();
    }, [loadAnalytics, loadProfiles]);

    useEffect(() => { loadSubmissions(); }, [loadSubmissions]);
    useEffect(() => { const id = setInterval(loadAnalytics, 30000); return () => clearInterval(id); }, [loadAnalytics]);

    const handleReset = () => { setFilterProfile(''); setFilterCategory(''); setFilterSearch(''); setFilterDateFrom(''); setFilterDateTo(''); setPage(1); };

    const handleExportCSV = async () => {
        setExporting('csv');
        try { await downloadCSV({ profile: filterProfile, category: filterCategory, search: filterSearch, dateFrom: filterDateFrom, dateTo: filterDateTo }); toast.success('CSV downloaded!'); }
        catch (e) { toast.error(e.message || 'Export failed'); }
        finally { setExporting(null); }
    };

    const handleExportExcel = async () => {
        setExporting('excel');
        try { await downloadExcel({ profile: filterProfile, category: filterCategory, search: filterSearch, dateFrom: filterDateFrom, dateTo: filterDateTo }); toast.success('Excel downloaded!'); }
        catch (e) { toast.error(e.message || 'Export failed'); }
        finally { setExporting(null); }
    };

    if (loading) return (
        <div className="page-loading">
            <div className="spinner" />
            <p>Loading Questionnaire Analytics…</p>
        </div>
    );

    const totalSubmissions = analytics?.total_submissions || 0;
    const profileBreakdown = analytics?.profile_breakdown || [];
    const categoryBreakdown = analytics?.category_breakdown || [];
    const questions = analytics?.questions || [];

    return (
        <div className="page">
            {/* ── Header ── */}
            <div className="page__header">
                <div>
                    <h1 className="page__title">Questionnaire Analytics</h1>
                    <p className="page__subtitle">Marketing Perception Study · live data · auto-refreshes every 30s</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => { loadAnalytics(); loadSubmissions(); }}>
                        <HiOutlineRefresh size={16} /> Refresh
                    </button>
                    <button className="btn btn--outline btn--sm" onClick={handleExportCSV} disabled={exporting === 'csv'}>
                        <HiOutlineDownload size={16} /> {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
                    </button>
                    <button className="btn btn--primary btn--sm" onClick={handleExportExcel} disabled={exporting === 'excel'}>
                        <HiOutlineDownload size={16} /> {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
                    </button>
                </div>
            </div>

            {/* ── Stats Row ── */}
            <div className="stats-grid" style={{ marginBottom: 32 }}>
                <StatCard icon={HiOutlineUsers} title="Total Participants" value={totalSubmissions.toLocaleString()} subtitle="Completed submissions" color="#ef4444" />
                <StatCard icon={HiOutlineClipboardList} title="Professional Profiles" value={profileBreakdown.length} subtitle="Distinct backgrounds" color="#8b5cf6" />
                <StatCard icon={HiOutlineLightBulb} title="Perception Categories" value={categoryBreakdown.filter(c => c.count > 0).length} subtitle="Active categories" color="#3b82f6" />
            </div>

            {/* ── Marketing Perception Categories ── */}
            {categoryBreakdown.length > 0 && (
                <section style={{ marginBottom: 40 }}>
                    <h2 className="qa-section-title">Marketing Perception Categories</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px,100%), 1fr))', gap: 16 }}>
                        {categoryBreakdown.map((cat) => {
                            const meta = CATEGORY_META[cat.category] || { color: '#6366f1', emoji: '🎯' };
                            const isTop = cat.count === Math.max(...categoryBreakdown.map(c => c.count));
                            return (
                                <div key={cat.category} style={{
                                    background: 'var(--bg-card)',
                                    border: `1.5px solid ${isTop ? meta.color + '66' : 'var(--border-color)'}`,
                                    borderRadius: 'var(--radius-lg)',
                                    padding: '20px',
                                    position: 'relative',
                                    boxShadow: isTop ? `0 4px 20px ${meta.color}22` : 'none',
                                }}>
                                    {isTop && (
                                        <span style={{ position: 'absolute', top: 12, right: 12, fontSize: '0.65rem', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.06em', background: meta.color + '18', padding: '2px 8px', borderRadius: 9999 }}>
                                            Most Common
                                        </span>
                                    )}
                                    <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{meta.emoji}</div>
                                    <p style={{ fontSize: '0.78rem', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
                                        Perception Category
                                    </p>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px' }}>
                                        {cat.category}
                                    </h3>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                                        <span style={{ fontSize: '2rem', fontWeight: 800, color: meta.color }}>{cat.count}</span>
                                        <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>({cat.percentage}%)</span>
                                    </div>
                                    <div style={{ height: 6, borderRadius: 9999, background: 'var(--border-color)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', borderRadius: 9999, width: `${cat.percentage}%`, background: `linear-gradient(90deg, ${meta.color}, ${meta.color}aa)`, transition: 'width 0.8s ease' }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ── Category Pie + Profile Breakdown ── */}
            {(categoryBreakdown.length > 0 || profileBreakdown.length > 0) && (
                <section style={{ marginBottom: 40 }}>
                    <h2 className="qa-section-title">Distributions</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(400px,100%), 1fr))', gap: 24 }}>

                        {/* Category Pie */}
                        <div className="chart-card">
                            <h3 className="chart-card__title">Perception Category Distribution</h3>
                            <div className="chart-wrapper">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={categoryBreakdown.filter(c => c.count > 0).map(c => ({ name: c.category, value: c.count }))}
                                            cx="50%" cy="50%" innerRadius="42%" outerRadius="68%" paddingAngle={3} dataKey="value">
                                            {categoryBreakdown.filter(c => c.count > 0).map((c, i) => (
                                                <Cell key={i} fill={(CATEGORY_META[c.category] || {}).color || PIE_COLORS[i]} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '0.76rem', color: 'var(--text-secondary)', paddingTop: 12 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Profile breakdown table */}
                        <div className="chart-card">
                            <h3 className="chart-card__title">Professional Profile Breakdown</h3>
                            <div style={{ overflowY: 'auto', maxHeight: 320 }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Profile</th>
                                            <th style={{ textAlign: 'right' }}>Count</th>
                                            <th style={{ textAlign: 'right' }}>%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {profileBreakdown.map((p, i) => (
                                            <tr key={p.profile}>
                                                <td>
                                                    <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], marginRight: 8 }} />
                                                    {p.profile}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 700 }}>{p.count}</td>
                                                <td style={{ textAlign: 'right', color: 'var(--accent-primary)' }}>{p.percentage}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ── Per-Question Charts ── */}
            {questions.length > 0 && (
                <section style={{ marginBottom: 40 }}>
                    <h2 className="qa-section-title">Question-by-Question Results</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                        {questions.map((q, qi) => {
                            const barData = q.options.map((o) => ({
                                name: o.option_text.length > 38 ? o.option_text.slice(0, 38) + '…' : o.option_text,
                                Votes: o.votes,
                            }));
                            const maxVotes = Math.max(...q.options.map((o) => o.votes));

                            return (
                                <div key={q.key} className="chart-card">
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                                        <div>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Q{qi + 1}</span>
                                            <h3 className="chart-card__title" style={{ marginBottom: 0 }}>{q.question_text}</h3>
                                        </div>
                                        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 8, padding: '5px 12px', fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                            {q.total_votes.toLocaleString()} votes
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px,100%), 1fr))', gap: 24 }}>
                                        <div style={{ minHeight: 200 }}>
                                            <ResponsiveContainer width="100%" height={Math.max(200, q.options.length * 42)}>
                                                <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 36, top: 4, bottom: 4 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                                                    <XAxis type="number" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                                                    <YAxis type="category" dataKey="name" width={150} stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Bar dataKey="Votes" radius={[0, 6, 6, 0]} barSize={20}>
                                                        {barData.map((entry, i) => (
                                                            <Cell key={i} fill={entry.Votes === maxVotes ? '#ef4444' : '#6366f1'} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
                                            {q.options.map((opt, oi) => {
                                                const isTop = opt.votes === maxVotes && opt.votes > 0;
                                                return (
                                                    <div key={oi}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                                                            <span style={{ fontSize: '0.8rem', color: isTop ? '#ef4444' : 'var(--text-primary)', fontWeight: isTop ? 700 : 400, flex: 1, lineHeight: 1.35 }}>
                                                                {opt.option_text}
                                                            </span>
                                                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isTop ? '#ef4444' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                                                {opt.percentage}% <span style={{ fontWeight: 400, fontSize: '0.72rem', color: 'var(--text-muted)' }}>({opt.votes})</span>
                                                            </span>
                                                        </div>
                                                        <div style={{ height: 6, borderRadius: 9999, background: 'var(--border-color)', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', borderRadius: 9999, width: `${opt.percentage}%`, background: isTop ? 'linear-gradient(90deg,#ef4444,#991b1b)' : '#6366f155', transition: 'width 0.8s ease' }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ── Submissions Table ── */}
            <section>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                    <h2 className="qa-section-title" style={{ marginBottom: 0 }}>
                        All Submissions <span style={{ marginLeft: 8, fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-secondary)' }}>({totalCount.toLocaleString()})</span>
                    </h2>
                </div>

                {/* Filters */}
                <div className="qa-filter-bar">
                    <div className="qa-filter-field">
                        <HiOutlineSearch size={16} style={{ color: 'var(--text-muted)' }} />
                        <input className="form-input" style={{ paddingLeft: 36, height: 38, fontSize: '0.875rem' }}
                            placeholder="Search profile, category, or ID…" value={filterSearch}
                            onChange={(e) => { setFilterSearch(e.target.value); setPage(1); }} />
                    </div>
                    <select className="form-input" style={{ height: 38, fontSize: '0.875rem', minWidth: 180 }}
                        value={filterProfile} onChange={(e) => { setFilterProfile(e.target.value); setPage(1); }}>
                        <option value="">All Profiles</option>
                        {profiles.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select className="form-input" style={{ height: 38, fontSize: '0.875rem', minWidth: 210 }}
                        value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}>
                        <option value="">All Categories</option>
                        {Object.keys(CATEGORY_META).map((c) => <option key={c} value={c}>{CATEGORY_META[c].emoji} {c}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="date" className="form-input" style={{ height: 38, fontSize: '0.875rem' }} value={filterDateFrom} onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }} title="From" />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>–</span>
                        <input type="date" className="form-input" style={{ height: 38, fontSize: '0.875rem' }} value={filterDateTo} onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }} title="To" />
                    </div>
                    {(filterProfile || filterCategory || filterSearch || filterDateFrom || filterDateTo) && (
                        <button className="btn btn--ghost btn--sm" onClick={handleReset}>
                            <HiOutlineFilter size={14} /> Clear
                        </button>
                    )}
                </div>

                {/* Table */}
                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    {subLoading ? (
                        <div style={{ padding: 40, textAlign: 'center' }}>
                            <div className="spinner" style={{ margin: '0 auto 12px' }} />
                            <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
                        </div>
                    ) : submissions.length === 0 ? (
                        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>No submissions found.</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date & Time</th>
                                        <th>Professional Profile</th>
                                        <th>Perception Category</th>
                                        <th>Score</th>
                                        <th>Answers</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submissions.map((sub) => {
                                        const meta = CATEGORY_META[sub.perception_category] || { color: '#6366f1', emoji: '🎯' };
                                        const isExpanded = expandedRow === sub.id;
                                        const answerCount = Object.keys(sub.answers || {}).length;
                                        return (
                                            <React.Fragment key={sub.id}>
                                                <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedRow(isExpanded ? null : sub.id)}>
                                                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{new Date(sub.created_at).toLocaleString()}</td>
                                                    <td style={{ fontSize: '0.85rem' }}>{sub.profile || '—'}</td>
                                                    <td>
                                                        {sub.perception_category ? (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 9999, background: meta.color + '18', border: `1px solid ${meta.color}44`, color: meta.color, fontSize: '0.76rem', fontWeight: 700 }}>
                                                                {meta.emoji} {sub.perception_category}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                    <td style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.9rem' }}>{sub.total_score ?? '—'}</td>
                                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                        {answerCount} answer{answerCount !== 1 ? 's' : ''} &nbsp;
                                                        <span style={{ color: 'var(--accent-primary)', fontSize: '0.75rem' }}>{isExpanded ? '▲' : '▼'}</span>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={5} style={{ padding: 0, background: meta.color + '06' }}>
                                                            <div style={{ padding: '14px 24px', borderLeft: `3px solid ${meta.color}66` }}>
                                                                {Object.entries(sub.answers || {}).sort(([a], [b]) => a.localeCompare(b)).map(([qKey, ans]) => (
                                                                    <div key={qKey} style={{ marginBottom: 10 }}>
                                                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 3px' }}>{ans.question_text || qKey}</p>
                                                                        <p style={{ fontSize: '0.86rem', color: 'var(--text-primary)', fontWeight: 500, margin: 0 }}>→ {ans.option_text}</p>
                                                                    </div>
                                                                ))}
                                                                {sub.voter_ip && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>IP: {sub.voter_ip}</p>}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
                        <button className="btn btn--ghost btn--sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>← Previous</button>
                        <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '0 8px' }}>Page {page} of {totalPages}</span>
                        <button className="btn btn--ghost btn--sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next →</button>
                    </div>
                )}
            </section>

            <style>{`
                .qa-section-title { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em; margin-bottom: 18px; }
                .qa-filter-bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; padding: 14px 18px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); }
                .qa-filter-field { position: relative; flex: 1; min-width: 180px; }
                .qa-filter-field > svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); pointer-events: none; }
            `}</style>
        </div>
    );
}
