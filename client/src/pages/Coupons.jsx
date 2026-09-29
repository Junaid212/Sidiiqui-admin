import React, { useState, useEffect } from 'react';
import { apiRequest } from '../config/api';
import toast from 'react-hot-toast';
import {
    HiOutlineTag,
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlinePencil,
    HiOutlineCheck,
    HiOutlineClipboardCopy,
    HiOutlineSearch,
    HiOutlineCalculator,
    HiOutlineInformationCircle,
    HiOutlineX,
} from 'react-icons/hi';

export default function Coupons() {
    const [coupons, setCoupons] = useState([]);
    const [stats, setStats] = useState({ total: 0, active: 0, totalRedemptions: 0, maxDiscount: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState(null);
    const [formData, setFormData] = useState({
        code: '',
        discount_percentage: 20,
        description: '',
        min_order_amount: 0,
        max_uses: '',
        expires_at: '',
        is_active: true,
    });
    const [submitting, setSubmitting] = useState(false);

    // Interactive Book Price Calculator
    const [sampleBookPrice, setSampleBookPrice] = useState(120);
    const [selectedCalcCoupon, setSelectedCalcCoupon] = useState(null);

    // Copied feedback
    const [copiedCode, setCopiedCode] = useState(null);

    useEffect(() => {
        fetchCoupons();
    }, []);

    async function fetchCoupons() {
        try {
            setLoading(true);
            const data = await apiRequest('/coupons');
            setCoupons(data.coupons || []);
            setStats(data.stats || { total: 0, active: 0, totalRedemptions: 0, maxDiscount: 0 });
            if (data.coupons && data.coupons.length > 0 && !selectedCalcCoupon) {
                setSelectedCalcCoupon(data.coupons[0]);
            }
        } catch (err) {
            toast.error(`Failed to load coupons: ${err.message}`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    function openCreateModal() {
        setEditingCoupon(null);
        setFormData({
            code: '',
            discount_percentage: 20,
            description: '',
            min_order_amount: 0,
            max_uses: '',
            expires_at: '',
            is_active: true,
        });
        setIsModalOpen(true);
    }

    function openEditModal(coupon) {
        setEditingCoupon(coupon);
        setFormData({
            code: coupon.code,
            discount_percentage: coupon.discount_percentage,
            description: coupon.description || '',
            min_order_amount: coupon.min_order_amount || 0,
            max_uses: coupon.max_uses || '',
            expires_at: coupon.expires_at ? coupon.expires_at.split('T')[0] : '',
            is_active: coupon.is_active !== false,
        });
        setIsModalOpen(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const cleanCode = formData.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        if (!cleanCode) {
            toast.error('Please enter a valid coupon code');
            return;
        }

        const pct = Number(formData.discount_percentage);
        if (isNaN(pct) || pct <= 0 || pct > 100) {
            toast.error('Discount percentage must be between 1 and 100%');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                code: cleanCode,
                discount_percentage: pct,
                description: formData.description.trim(),
                min_order_amount: Number(formData.min_order_amount) || 0,
                max_uses: formData.max_uses ? Number(formData.max_uses) : null,
                expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
                is_active: formData.is_active,
            };

            if (editingCoupon) {
                await apiRequest(`/coupons/${editingCoupon.id}`, {
                    method: 'PUT',
                    body: payload,
                });
                toast.success(`Coupon '${cleanCode}' updated successfully!`);
            } else {
                await apiRequest('/coupons', {
                    method: 'POST',
                    body: payload,
                });
                toast.success(`Coupon '${cleanCode}' created with ${pct}% discount!`);
            }

            setIsModalOpen(false);
            fetchCoupons();
        } catch (err) {
            toast.error(err.message || 'Failed to save coupon');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleToggleActive(coupon) {
        const newStatus = !coupon.is_active;
        try {
            await apiRequest(`/coupons/${coupon.id}`, {
                method: 'PUT',
                body: { is_active: newStatus },
            });
            toast.success(`Coupon '${coupon.code}' is now ${newStatus ? 'Active' : 'Disabled'}`);
            setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, is_active: newStatus } : c));
        } catch (err) {
            toast.error(`Failed to update status: ${err.message}`);
        }
    }

    async function handleDelete(coupon) {
        if (!window.confirm(`Are you sure you want to delete coupon '${coupon.code}'?`)) return;

        try {
            await apiRequest(`/coupons/${coupon.id}`, { method: 'DELETE' });
            toast.success(`Coupon '${coupon.code}' deleted.`);
            setCoupons(prev => prev.filter(c => c.id !== coupon.id));
        } catch (err) {
            toast.error(`Failed to delete coupon: ${err.message}`);
        }
    }

    function handleCopy(code) {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        toast.success(`Copied '${code}' to clipboard!`);
        setTimeout(() => setCopiedCode(null), 2000);
    }

    // Filtered coupons
    const filteredCoupons = coupons.filter(c => {
        const matchesSearch = !search ||
            c.code.toLowerCase().includes(search.toLowerCase().trim()) ||
            (c.description || '').toLowerCase().includes(search.toLowerCase().trim());

        const matchesStatus = filterStatus === 'all' ||
            (filterStatus === 'active' && c.is_active !== false) ||
            (filterStatus === 'inactive' && c.is_active === false);

        return matchesSearch && matchesStatus;
    });

    // Price calculator computation
    const calcPct = selectedCalcCoupon ? Number(selectedCalcCoupon.discount_percentage) : 0;
    const calcSaved = Math.round((sampleBookPrice * calcPct) / 100 * 100) / 100;
    const calcFinalPrice = Math.max(0, Math.round((sampleBookPrice - calcSaved) * 100) / 100);

    return (
        <div className="page" style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: 28 }}>
                <div>
                    <h1 className="page__title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ color: '#38bdf8' }}><HiOutlineTag /></span>
                        Coupons & Discount Codes
                    </h1>
                    <p className="page__subtitle">
                        Manage promotional discount codes. When a customer enters a matching coupon, the book price reduces automatically according to its discount percentage.
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="btn btn-primary"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: 8,
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                        transition: 'transform 0.15s ease'
                    }}
                >
                    <HiOutlinePlus size={18} />
                    Create New Coupon
                </button>
            </div>

            {/* Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: 28 }}>
                <div style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '18px 20px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Coupons</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>{stats.total || coupons.length}</div>
                </div>
                <div style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '18px 20px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Coupons</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#22c55e', marginTop: 4 }}>
                        {coupons.filter(c => c.is_active !== false).length}
                    </div>
                </div>
                <div style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '18px 20px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Highest Discount %</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#38bdf8', marginTop: 4 }}>
                        {coupons.reduce((m, c) => Math.max(m, Number(c.discount_percentage) || 0), 0)}%
                    </div>
                </div>
                <div style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '18px 20px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Redemptions</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>
                        {coupons.reduce((sum, c) => sum + (Number(c.times_used) || 0), 0)}
                    </div>
                </div>
            </div>

            {/* Interactive Live Price Reduction Simulator */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.7), rgba(15, 23, 42, 0.9))',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 14,
                padding: '20px 24px',
                marginBottom: 28,
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: 12 }}>
                    <HiOutlineCalculator style={{ color: '#818cf8', fontSize: '1.4rem' }} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                        Live Book Price Reduction Preview
                    </h3>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', padding: '2px 8px', borderRadius: 999 }}>
                        Real-time Percentage Calculation
                    </span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#cbd5e1', marginBottom: 16 }}>
                    Test how any book or publication price automatically reduces when customer inputs a matching coupon:
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: 4 }}>
                            Sample Book Price (AED)
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={sampleBookPrice}
                            onChange={(e) => setSampleBookPrice(Number(e.target.value) || 0)}
                            style={{
                                background: '#0f172a',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#fff',
                                padding: '8px 14px',
                                borderRadius: 8,
                                width: 140,
                                fontSize: '1rem',
                                fontWeight: 600,
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: 4 }}>
                            Select Matching Coupon
                        </label>
                        <select
                            value={selectedCalcCoupon?.code || ''}
                            onChange={(e) => {
                                const found = coupons.find(c => c.code === e.target.value);
                                setSelectedCalcCoupon(found || null);
                            }}
                            style={{
                                background: '#0f172a',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#38bdf8',
                                padding: '8px 14px',
                                borderRadius: 8,
                                minWidth: 200,
                                fontSize: '0.95rem',
                                fontWeight: 600,
                            }}
                        >
                            {coupons.map(c => (
                                <option key={c.id} value={c.code}>
                                    {c.code} — {c.discount_percentage}% OFF {c.is_active ? '' : '(Disabled)'}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Calculation result card */}
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        borderRadius: 10,
                        padding: '10px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.2rem',
                    }}>
                        <div>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Original Price</span>
                            <span style={{ fontSize: '1.1rem', color: '#e2e8f0', textDecoration: 'line-through' }}>
                                AED {sampleBookPrice.toFixed(2)}
                            </span>
                        </div>
                        <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '1.2rem' }}>
                            -{calcPct}%
                        </div>
                        <div>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Customer Saves</span>
                            <span style={{ fontSize: '1.1rem', color: '#f59e0b', fontWeight: 600 }}>
                                AED {calcSaved.toFixed(2)}
                            </span>
                        </div>
                        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1.2rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#86efac', display: 'block', fontWeight: 600 }}>Final Reduced Price</span>
                            <span style={{ fontSize: '1.4rem', color: '#22c55e', fontWeight: 800 }}>
                                AED {calcFinalPrice.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: 20,
            }}>
                <div style={{ position: 'relative', width: 320 }}>
                    <HiOutlineSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                        type="text"
                        placeholder="Search coupon code or description..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            width: '100%',
                            background: '#1e1e2e',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            padding: '10px 14px 10px 38px',
                            color: '#fff',
                            fontSize: '0.9rem',
                        }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {['all', 'active', 'inactive'].map((st) => (
                        <button
                            key={st}
                            onClick={() => setFilterStatus(st)}
                            style={{
                                background: filterStatus === st ? '#3b82f6' : '#1e1e2e',
                                color: filterStatus === st ? '#fff' : '#94a3b8',
                                border: '1px solid rgba(255,255,255,0.08)',
                                padding: '8px 16px',
                                borderRadius: 8,
                                fontSize: '0.85rem',
                                textTransform: 'capitalize',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            {st}
                        </button>
                    ))}
                </div>
            </div>

            {/* Coupons Table */}
            <div style={{
                background: '#1e1e2e',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                overflow: 'hidden',
            }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                        <div className="spinner" style={{ margin: '0 auto 12px' }} />
                        Loading coupons...
                    </div>
                ) : filteredCoupons.length === 0 ? (
                    <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                        <HiOutlineTag size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                        <h4 style={{ color: '#e2e8f0', marginBottom: 6 }}>No coupons found</h4>
                        <p style={{ fontSize: '0.9rem' }}>
                            {search ? 'Try adjusting your search query.' : 'Click "Create New Coupon" to add your first discount code.'}
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
                                    <th style={{ padding: '14px 20px', color: '#94a3b8', fontWeight: 600 }}>Coupon Code</th>
                                    <th style={{ padding: '14px 20px', color: '#94a3b8', fontWeight: 600 }}>Discount %</th>
                                    <th style={{ padding: '14px 20px', color: '#94a3b8', fontWeight: 600 }}>Description</th>
                                    <th style={{ padding: '14px 20px', color: '#94a3b8', fontWeight: 600 }}>Min Order</th>
                                    <th style={{ padding: '14px 20px', color: '#94a3b8', fontWeight: 600 }}>Redemptions</th>
                                    <th style={{ padding: '14px 20px', color: '#94a3b8', fontWeight: 600 }}>Status</th>
                                    <th style={{ padding: '14px 20px', color: '#94a3b8', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCoupons.map((c) => (
                                    <tr
                                        key={c.id}
                                        style={{
                                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                                            transition: 'background 0.15s',
                                        }}
                                    >
                                        {/* Code & Copy */}
                                        <td style={{ padding: '14px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <code style={{
                                                    background: 'rgba(56, 189, 248, 0.12)',
                                                    color: '#38bdf8',
                                                    padding: '4px 10px',
                                                    borderRadius: 6,
                                                    fontSize: '0.95rem',
                                                    fontWeight: 700,
                                                    letterSpacing: '1px',
                                                    border: '1px solid rgba(56, 189, 248, 0.25)',
                                                }}>
                                                    {c.code}
                                                </code>
                                                <button
                                                    onClick={() => handleCopy(c.code)}
                                                    title="Copy code"
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: copiedCode === c.code ? '#22c55e' : '#64748b',
                                                        cursor: 'pointer',
                                                        padding: 4,
                                                    }}
                                                >
                                                    {copiedCode === c.code ? <HiOutlineCheck size={16} /> : <HiOutlineClipboardCopy size={16} />}
                                                </button>
                                            </div>
                                        </td>

                                        {/* Discount percentage badge */}
                                        <td style={{ padding: '14px 20px' }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                padding: '4px 12px',
                                                borderRadius: 999,
                                                fontSize: '0.85rem',
                                                fontWeight: 700,
                                                background: 'rgba(34, 197, 94, 0.15)',
                                                color: '#4ade80',
                                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                            }}>
                                                {c.discount_percentage}% OFF
                                            </span>
                                        </td>

                                        {/* Description */}
                                        <td style={{ padding: '14px 20px', color: '#cbd5e1', maxWidth: 260 }}>
                                            {c.description || '—'}
                                            {c.expires_at && (
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 3 }}>
                                                    Expires: {new Date(c.expires_at).toLocaleDateString()}
                                                </div>
                                            )}
                                        </td>

                                        {/* Min Order */}
                                        <td style={{ padding: '14px 20px', color: '#94a3b8' }}>
                                            {c.min_order_amount ? `AED ${c.min_order_amount}` : 'None'}
                                        </td>

                                        {/* Redemptions */}
                                        <td style={{ padding: '14px 20px' }}>
                                            <span style={{ color: '#f8fafc', fontWeight: 600 }}>{c.times_used || 0}</span>
                                            {c.max_uses ? <span style={{ color: '#64748b' }}> / {c.max_uses}</span> : ''}
                                        </td>

                                        {/* Status Toggle */}
                                        <td style={{ padding: '14px 20px' }}>
                                            <button
                                                onClick={() => handleToggleActive(c)}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '4px 10px',
                                                    borderRadius: 999,
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    background: c.is_active !== false ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                    color: c.is_active !== false ? '#4ade80' : '#f87171',
                                                }}
                                            >
                                                <span style={{
                                                    width: 6,
                                                    height: 6,
                                                    borderRadius: '50%',
                                                    background: c.is_active !== false ? '#22c55e' : '#ef4444',
                                                }} />
                                                {c.is_active !== false ? 'Active' : 'Disabled'}
                                            </button>
                                        </td>

                                        {/* Actions */}
                                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => openEditModal(c)}
                                                    title="Edit coupon"
                                                    style={{
                                                        background: 'rgba(255,255,255,0.06)',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        color: '#cbd5e1',
                                                        borderRadius: 6,
                                                        padding: '6px 10px',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <HiOutlinePencil size={15} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(c)}
                                                    title="Delete coupon"
                                                    style={{
                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                        border: '1px solid rgba(239, 68, 68, 0.25)',
                                                        color: '#f87171',
                                                        borderRadius: 6,
                                                        padding: '6px 10px',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <HiOutlineTrash size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create / Edit Modal Dialog */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: 20,
                }}>
                    <div style={{
                        background: '#1e1e2e',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 16,
                        width: '100%',
                        maxWidth: 520,
                        padding: '24px 28px',
                        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                                {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create New Discount Coupon'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                            >
                                <HiOutlineX size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            {/* Coupon Code */}
                            <div style={{ marginBottom: 18 }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, marginBottom: 6 }}>
                                    Coupon Code <span style={{ color: '#f43f5e' }}>*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. SUMMER30, BOOKS20"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    style={{
                                        width: '100%',
                                        background: '#0f172a',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        borderRadius: 8,
                                        padding: '10px 14px',
                                        color: '#38bdf8',
                                        fontSize: '1.05rem',
                                        fontWeight: 700,
                                        letterSpacing: '1px',
                                    }}
                                />
                                <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                                    Auto-formatted in UPPERCASE. Customer must type this exact code at checkout.
                                </small>
                            </div>

                            {/* Discount Percentage */}
                            <div style={{ marginBottom: 18 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>
                                        Discount Percentage (%) <span style={{ color: '#f43f5e' }}>*</span>
                                    </label>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4ade80' }}>
                                        {formData.discount_percentage}% OFF
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <input
                                        type="range"
                                        min="1"
                                        max="100"
                                        step="1"
                                        value={formData.discount_percentage}
                                        onChange={(e) => setFormData({ ...formData, discount_percentage: Number(e.target.value) })}
                                        style={{ flex: 1, accentColor: '#22c55e' }}
                                    />
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={formData.discount_percentage}
                                        onChange={(e) => setFormData({ ...formData, discount_percentage: Number(e.target.value) })}
                                        style={{
                                            width: 80,
                                            background: '#0f172a',
                                            border: '1px solid rgba(255,255,255,0.15)',
                                            borderRadius: 8,
                                            padding: '8px 10px',
                                            color: '#fff',
                                            textAlign: 'center',
                                            fontWeight: 700,
                                        }}
                                    />
                                </div>
                                <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                                    Book price will reduce by {formData.discount_percentage}% when applied.
                                </small>
                            </div>

                            {/* Description */}
                            <div style={{ marginBottom: 18 }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, marginBottom: 6 }}>
                                    Campaign Description / Note
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. VIP Subscriber 20% discount"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    style={{
                                        width: '100%',
                                        background: '#0f172a',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        borderRadius: 8,
                                        padding: '10px 14px',
                                        color: '#fff',
                                        fontSize: '0.9rem',
                                    }}
                                />
                            </div>

                            {/* Min Order & Max Uses */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: 18 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, marginBottom: 6 }}>
                                        Min Order (AED)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="0 (no minimum)"
                                        value={formData.min_order_amount}
                                        onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })}
                                        style={{
                                            width: '100%',
                                            background: '#0f172a',
                                            border: '1px solid rgba(255,255,255,0.15)',
                                            borderRadius: 8,
                                            padding: '10px 14px',
                                            color: '#fff',
                                            fontSize: '0.9rem',
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, marginBottom: 6 }}>
                                        Max Usage Limit
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="Unlimited"
                                        value={formData.max_uses}
                                        onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                                        style={{
                                            width: '100%',
                                            background: '#0f172a',
                                            border: '1px solid rgba(255,255,255,0.15)',
                                            borderRadius: 8,
                                            padding: '10px 14px',
                                            color: '#fff',
                                            fontSize: '0.9rem',
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Expiry Date */}
                            <div style={{ marginBottom: 18 }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, marginBottom: 6 }}>
                                    Expiry Date (Optional)
                                </label>
                                <input
                                    type="date"
                                    value={formData.expires_at}
                                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                                    style={{
                                        width: '100%',
                                        background: '#0f172a',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        borderRadius: 8,
                                        padding: '10px 14px',
                                        color: '#fff',
                                        fontSize: '0.9rem',
                                    }}
                                />
                            </div>

                            {/* Active Switch */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: 24 }}>
                                <input
                                    type="checkbox"
                                    id="coupon-active-chk"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    style={{ width: 18, height: 18, accentColor: '#22c55e', cursor: 'pointer' }}
                                />
                                <label htmlFor="coupon-active-chk" style={{ fontSize: '0.9rem', color: '#cbd5e1', cursor: 'pointer' }}>
                                    Coupon is Active (can be redeemed immediately at checkout)
                                </label>
                            </div>

                            {/* Modal Buttons */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    style={{
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: '#cbd5e1',
                                        padding: '10px 18px',
                                        borderRadius: 8,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '10px 22px',
                                        borderRadius: 8,
                                        fontWeight: 600,
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        opacity: submitting ? 0.7 : 1,
                                    }}
                                >
                                    {submitting ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
