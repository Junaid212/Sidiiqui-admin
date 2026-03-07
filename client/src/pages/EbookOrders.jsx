import { useState, useEffect } from 'react';
import { apiRequest } from '../config/api';
import OrdersTable from '../components/Orders/OrdersTable';
import toast from 'react-hot-toast';
import { HiOutlineArrowLeft } from 'react-icons/hi';
import { Link } from 'react-router-dom';

export default function EbookOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

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
            <div className="page__header" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#fff'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>
                    <HiOutlineArrowLeft /> Back to Dashboard
                </Link>
                <div>
                    <h1 className="page__title">EBook Orders</h1>
                    <p className="page__subtitle">
                        {orders.length} successful order{orders.length !== 1 ? 's' : ''} recorded
                    </p>
                </div>
            </div>

            <OrdersTable orders={orders} />
        </div>
    );
}
