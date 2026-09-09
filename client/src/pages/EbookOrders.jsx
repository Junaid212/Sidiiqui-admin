import { useState, useEffect } from 'react';
import { apiRequest } from '../config/api';
import OrdersTable from '../components/Orders/OrdersTable';
import toast from 'react-hot-toast';
import { HiOutlineArrowLeft, HiOutlineDownload, HiOutlineSearch } from 'react-icons/hi';
import { Link } from 'react-router-dom';

export default function EbookOrders() {
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
        const matchesStatus = statusFilter === 'all' || o.status?.toLowerCase() === statusFilter.toLowerCase();
        const s = search.toLowerCase().trim();
        const matchesSearch = !s ||
            o.order_number?.toLowerCase().includes(s) ||
            o.customer_name?.toLowerCase().includes(s) ||
            (o.user_email || o.email)?.toLowerCase().includes(s) ||
            (o.book_name || o.ebook_title)?.toLowerCase().includes(s);
        return matchesStatus && matchesSearch;
    });

    const totalOrders = orders.length;
    const paidOrders = orders.filter(o => o.status === 'paid' || o.status === 'successful');
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const totalDownloadsUsed = orders.reduce((sum, o) => sum + (Number(o.download_count) || 0), 0);
    const totalRefunded = orders.filter(o => o.status === 'refunded').length;

    function handleExportCsv() {
        window.open('http://localhost:5001/api/orders/export-csv', '_blank');
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
                    <span style={{ fontSize: '0.8rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verified Sales (AED)</span>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', margin: '6px 0 0' }}>AED {totalRevenue.toFixed(2)}</h3>
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
                    {['all', 'paid', 'pending', 'refunded'].map((status) => (
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
        </div>
    );
}
