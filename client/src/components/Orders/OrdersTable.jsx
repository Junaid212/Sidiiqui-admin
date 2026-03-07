import { useState } from 'react';

export default function OrdersTable({ orders }) {
    const isEmpty = !orders || orders.length === 0;

    return (
        <div className="table-wrapper">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Order ID</th>
                        <th>User Email</th>
                        <th>Book Name</th>
                        <th>Purchased Date</th>
                        <th>Amount Paid</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {isEmpty ? (
                        <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                No Ebook orders found.
                            </td>
                        </tr>
                    ) : (
                        orders.map((order) => (
                            <tr key={order.id}>
                                <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {order.id.split('-')[0]}...
                                </td>
                                <td>{order.email}</td>
                                <td>
                                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', textTransform: 'uppercase' }}>
                                        {order.book_name}
                                    </span>
                                </td>
                                <td>
                                    {new Date(order.created_at).toLocaleDateString(undefined, {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </td>
                                <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                                    ${Number(order.amount).toFixed(2)}
                                </td>
                                <td>
                                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', textTransform: 'uppercase' }}>
                                        {order.status}
                                    </span>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
