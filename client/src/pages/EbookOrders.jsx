import { useState, useEffect } from 'react';
import { apiRequest } from '../config/api';
import OrdersTable from '../components/Orders/OrdersTable';
import toast from 'react-hot-toast';
import { HiOutlineArrowLeft, HiOutlineDownload, HiOutlineSearch } from 'react-icons/hi';
import { Link } from 'react-router-dom';

function RemoveModal({ orders, onClose, onDone, mode = 'remove' }) {
    const marking = mode === 'mark';
    const [picked, setPicked] = useState({}); const [reason, setReason] = useState(''); const [alsoEnd, setAlsoEnd] = useState(false); const [typed, setTyped] = useState(''); const [busy, setBusy] = useState(false);
    const ids = Object.keys(picked).filter((k) => picked[k]);
    const ok = ids.length > 0 && reason.trim().length >= 5 && (marking || typed.trim().toUpperCase() === 'REMOVE') && !busy;
    const toggleAll = (on) => setPicked(Object.fromEntries(orders.map((o) => [o.id, on])));
    async function go() {
        setBusy(true);
        try {
            if (marking) {
                const r = await apiRequest('/orders/mark-test', { method: 'POST', body: { ids, reason: reason.trim() } });
                toast.success(`Marked ${r.updated} order${r.updated === 1 ? '' : 's'} as test. Their access is unchanged.`);
            } else {
                const r = await apiRequest('/orders/remove', { method: 'POST', body: { ids, reason: reason.trim(), revokeAccess: alsoEnd } });
                toast.success(`Removed ${r.removed} order${r.removed === 1 ? '' : 's'}${r.accessEnded ? `; ended access for ${r.accessEnded}` : ''}`);
            }
            onDone(); onClose();
        } catch (e) { toast.error((e && e.message) || (marking ? 'Could not mark the orders' : 'Could not remove the orders')); } finally { setBusy(false); }
    }
    return (
        <div className="modal-overlay" role="dialog" aria-modal="true"><div className="modal" style={{ maxWidth: 820, maxHeight: '92vh', overflow: 'auto' }} data-testid={marking ? 'mark-modal' : 'remove-modal'}>
            <div className="modal__header"><h2>{marking ? 'Mark orders as test' : 'Remove test orders'}</h2><button className="modal__close" onClick={onClose} aria-label="Close">×</button></div>
            <div className="modal__body">
                {marking
                    ? <p style={{ color: '#a6adc8', fontSize: '0.85rem' }}>Tick the orders that are only tests but whose owner should <b>keep</b> reading. The orders and their access stay exactly as they are; they are just no longer counted in Total Orders, Verified Sales or the dashboard. You can switch any of them back later.</p>
                    : <p style={{ color: '#a6adc8', fontSize: '0.85rem' }}>Tick the orders that are tests, then confirm. A full copy of each order is kept in the audit log first. Real customers&rsquo; orders should not be ticked: removing an order takes it out of the totals and out of My Orders.</p>}
                <div style={{ marginBottom: 8 }}><button className="btn btn--outline btn--sm" onClick={() => toggleAll(true)}>Tick all shown</button> <button className="btn btn--outline btn--sm" onClick={() => toggleAll(false)}>Clear</button> <span style={{ color: '#a6adc8', marginLeft: 8 }}>{ids.length} selected</span></div>
                <div className="table-wrapper" style={{ maxHeight: 300, overflow: 'auto' }}><table className="data-table"><thead><tr><th></th><th>Order</th><th>Customer</th><th>Product</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>
                    {orders.map((o) => <tr key={o.id}><td><input type="checkbox" aria-label={`Select ${o.order_number}`} checked={!!picked[o.id]} onChange={(e) => setPicked({ ...picked, [o.id]: e.target.checked })} /></td><td>{o.order_number}</td><td>{o.user_email || o.email}</td><td>{o.book_name}</td><td>{o.created_at ? new Date(o.created_at).toISOString().slice(0, 10) : ''}</td><td>{Number(o.amount || 0).toFixed(2)}</td><td>{o.status}</td></tr>)}
                </tbody></table></div>
                <div className="form-group" style={{ marginTop: 12 }}><label>Reason (required, recorded in the audit log)</label><textarea className="form-textarea" aria-label="Reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. 26 October test scenarios" /></div>
                {!marking && <label style={{ display: 'block', margin: '8px 0', fontSize: '0.88rem' }}><input type="checkbox" checked={alsoEnd} onChange={(e) => setAlsoEnd(e.target.checked)} /> Also end the access these orders give (only needed if an order currently gives someone the reader or downloads)</label>}
                {!marking && <div className="form-group"><label>Type REMOVE to confirm</label><input className="form-input" aria-label="Type REMOVE" value={typed} onChange={(e) => setTyped(e.target.value)} style={{ maxWidth: 200 }} /></div>}
                <div className="form-actions"><button className="btn btn--outline" onClick={onClose}>Cancel</button>
                    {marking
                        ? <button className="btn btn--primary" disabled={!ok} onClick={go}>{busy ? 'Saving…' : `Mark ${ids.length} order${ids.length === 1 ? '' : 's'} as test`}</button>
                        : <button className="btn btn--danger" disabled={!ok} onClick={go}>{busy ? 'Removing…' : `Remove ${ids.length} order${ids.length === 1 ? '' : 's'}`}</button>}
                </div>
            </div>
        </div></div>
    );
}

export default function EbookOrders() {
    const [removeOpen, setRemoveOpen] = useState(false);
    const [markOpen, setMarkOpen] = useState(false);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchOrders();
    }, []);

    async function fetchOrders() {
        try {
            const data = await apiRequest('/orders');
            setOrders(data.orders || []);
        } catch (err) {
            toast.error('Failed to load ebook orders');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const filteredOrders = orders.filter((o) => {
        const matchesStatus = statusFilter === 'all' || (statusFilter === 'test' ? (o.is_test === true || o.is_complimentary === true) : o.status?.toLowerCase() === statusFilter.toLowerCase());
        const s = search.toLowerCase().trim();
        const matchesSearch = !s ||
            o.order_number?.toLowerCase().includes(s) ||
            o.customer_name?.toLowerCase().includes(s) ||
            (o.user_email || o.email)?.toLowerCase().includes(s) ||
            (o.book_name || o.ebook_title)?.toLowerCase().includes(s);
        return matchesStatus && matchesSearch;
    });

    // Orders marked as tests stay in the list (with a TEST badge) and keep their access, but are never counted in these totals.
    // (complimentary grants made in the admin are likewise not sales)
    const realOrders = orders.filter((o) => !o.is_test && !o.is_complimentary);
    const testCount = orders.length - realOrders.length;
    const totalOrders = realOrders.length;
    const paidOrders = realOrders.filter(o => o.status === 'paid' || o.status === 'successful');
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const totalDownloadsUsed = realOrders.reduce((sum, o) => sum + (Number(o.download_count) || 0), 0);
    const totalRefunded = realOrders.filter(o => o.status === 'refunded').length;

    // The CSV is built in the browser from the orders on screen (so the search and status filter apply) and downloaded as a file.
    // It used to open a localhost address that does not exist on the live server.
    function csvCell(value) {
        let s = value === null || value === undefined ? '' : String(value);
        if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // a spreadsheet must never run a cell as a formula
        return `"${s.replace(/"/g, '""')}"`;
    }

    function handleExportCsv() {
        if (!filteredOrders.length) { toast.error('There are no orders to export.'); return; }
        const header = ['Order #', 'Customer', 'Email', 'Product', 'Purchased (UTC)', 'Currency', 'Amount', 'Status', 'Downloads used', 'Download limit', 'Test order'];
        const rows = filteredOrders.map((o) => [
            o.order_number || `ORD-${String(o.id || '').substring(0, 8).toUpperCase()}`,
            o.customer_name || '',
            o.user_email || o.email || '',
            o.book_name || o.ebook_title || 'Marketing Reclassified',
            o.created_at ? new Date(o.created_at).toISOString().replace('T', ' ').slice(0, 19) : '',
            o.currency || 'USD',
            Number(o.amount || 0).toFixed(2),
            o.status || '',
            o.download_count || 0,
            o.download_limit || 3,
            o.is_test ? 'test' : o.is_complimentary ? 'complimentary' : '',
        ]);
        const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url; a.download = `ebook-orders-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success(`Exported ${filteredOrders.length} order${filteredOrders.length === 1 ? '' : 's'}.`);
    }

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner" />
                <p>Loading orders...</p>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', marginBottom: 12 }}>
                        <HiOutlineArrowLeft /> Back to Dashboard
                    </Link>
                    <h1 className="page__title">Digital Product & eBook Orders</h1>
                    <p className="page__subtitle">
                        Track verified purchases, Stripe payments, digital downloads, and customer fulfillment.
                    </p>
                </div>
                <button
                    onClick={() => setMarkOpen(true)}
                    className="btn btn--outline"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', marginLeft: 'auto', marginRight: 8 }}
                    data-testid="open-mark"
                >
                    Mark as test…
                </button>
                <button
                    onClick={() => setRemoveOpen(true)}
                    className="btn btn--outline"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', marginRight: 8 }}
                    data-testid="open-remove"
                >
                    Remove test orders…
                </button>
                <button
                    onClick={handleExportCsv}
                    className="btn btn--secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer' }}
                >
                    <HiOutlineDownload size={18} /> Export Orders CSV
                </button>
            </div>

            {/* Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Orders</span>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', margin: '6px 0 0' }}>{totalOrders}</h3>
                </div>
                <div style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verified Sales (USD)</span>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', margin: '6px 0 0' }}>USD {totalRevenue.toFixed(2)}</h3>
                </div>
                <div style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Downloads Used</span>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#3b82f6', margin: '6px 0 0' }}>{totalDownloadsUsed}</h3>
                </div>
                <div style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Refunds</span>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: totalRefunded > 0 ? '#ef4444' : '#a1a1aa', margin: '6px 0 0' }}>{totalRefunded}</h3>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {['all', 'paid', 'pending', 'refunded', 'test'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: statusFilter === status ? '#c80808' : 'rgba(255,255,255,0.04)',
                                color: statusFilter === status ? '#fff' : 'var(--text-secondary)',
                                fontWeight: statusFilter === status ? '700' : '500',
                                textTransform: 'capitalize',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }}
                        >
                            {status}
                        </button>
                    ))}
                </div>

                <div style={{ position: 'relative', width: '280px' }}>
                    <HiOutlineSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
                    <input
                        type="text"
                        placeholder="Search customer, order, product..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px 12px 8px 36px',
                            background: '#1e1e2e',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '0.85rem'
                        }}
                    />
                </div>
            </div>

            <OrdersTable orders={filteredOrders} onRefresh={fetchOrders} />
            {testCount > 0 && <p style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-secondary)' }} data-testid="test-note">{testCount} order{testCount === 1 ? ' is' : 's are'} marked as test or complimentary: shown here with a badge, keeping their access, but not counted in the totals above.</p>}
            {removeOpen && <RemoveModal orders={filteredOrders} onClose={() => setRemoveOpen(false)} onDone={fetchOrders} />}
            {markOpen && <RemoveModal mode="mark" orders={filteredOrders.filter((o) => !o.is_test)} onClose={() => setMarkOpen(false)} onDone={fetchOrders} />}
        </div>
    );
}
