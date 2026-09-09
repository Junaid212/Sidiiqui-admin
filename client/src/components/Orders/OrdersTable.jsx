import React from 'react';
import { apiRequest } from '../../config/api';
import toast from 'react-hot-toast';

export default function OrdersTable({ orders, onRefresh }) {
    const isEmpty = !orders || orders.length === 0;

    async function handleRefund(order) {
        if (!window.confirm(`Are you sure you want to mark order ${order.order_number || order.id} as REFUNDED? This will revoke digital download access immediately.`)) {
            return;
        }

        try {
            await apiRequest(`/orders/${order.id}/refund`, { method: 'POST' });
            toast.success('Order marked as refunded. Download access revoked.');
            if (onRefresh) onRefresh();
        } catch (err) {
            toast.error('Failed to process refund');
            console.error(err);
        }
    }

    return (
        <div className="table-wrapper">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Order #</th>
                        <th>Customer</th>
                        <th>Product</th>
                        <th>Purchased Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Downloads</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {isEmpty ? (
                        <tr>
                            <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                No digital product orders match the criteria.
                            </td>
                        </tr>
                    ) : (
                        orders.map((order) => {
                            const isPaid = order.status === 'paid' || order.status === 'successful';
                            const isRefunded = order.status === 'refunded';
                            const orderNum = order.order_number || `ORD-${order.id?.substring(0, 8).toUpperCase()}`;
                            const customerName = order.customer_name || 'Customer';
                            const customerEmail = order.user_email || order.email || 'guest@customer.com';

                            return (
                                <tr key={order.id}>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#fff', fontWeight: '600' }}>
                                        {orderNum}
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.9rem' }}>{customerName}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{customerEmail}</div>
                                    </td>
                                    <td>
                                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc' }}>
                                            {order.book_name || order.ebook_title || 'Marketing Reclassified'}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        {new Date(order.created_at).toLocaleDateString(undefined, {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </td>
                                    <td style={{ fontWeight: '700', color: '#10b981' }}>
                                        {order.currency || 'AED'} {Number(order.amount).toFixed(2)}
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            backgroundColor: isRefunded ? 'rgba(239, 68, 68, 0.15)' : isPaid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                            color: isRefunded ? '#ef4444' : isPaid ? '#10b981' : '#f59e0b',
                                            textTransform: 'uppercase'
                                        }}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.85rem' }}>
                                        <span style={{ color: isRefunded ? '#ef4444' : '#fff', fontWeight: '600' }}>
                                            {order.download_count || 0}
                                        </span>
                                        <span style={{ color: 'var(--text-secondary)' }}> / {order.download_limit || 3}</span>
                                    </td>
                                    <td>
                                        {isPaid && !isRefunded && (
                                            <button
                                                onClick={() => handleRefund(order)}
                                                style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    color: '#f87171',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '600',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Refund
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
