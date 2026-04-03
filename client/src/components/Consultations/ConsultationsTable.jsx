export default function ConsultationsTable({ consultations, onDelete }) {
    const isEmpty = !consultations || consultations.length === 0;

    return (
        <div className="table-wrapper">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>User Email-ID</th>
                        <th>Name</th>
                        <th>Booked On</th>
                        <th>Date Selected</th>
                        <th>Time Selected</th>
                        <th>Phone Number</th>
                        <th>Message</th>
                        <th>Status</th>
                        <th>Email Sent</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {isEmpty ? (
                        <tr>
                            <td colSpan="10" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                No consultations found.
                            </td>
                        </tr>
                    ) : (
                        consultations.map((c) => (
                            <tr key={c.id}>
                                <td>
                                    {c.email ? (
                                        <a href={`mailto:${c.email}`} className="data-table__email">{c.email}</a>
                                    ) : (
                                        <span style={{ color: 'var(--text-secondary)' }}>N/A</span>
                                    )}
                                </td>
                                <td>
                                    <span className="data-table__name" style={{ fontWeight: c.name ? 'bold' : 'normal', color: c.name ? 'inherit' : 'var(--text-secondary)' }}>
                                        {c.name || 'Anonymous'}
                                    </span>
                                </td>
                                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    {c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                                </td>
                                <td style={{ fontWeight: '500' }}>
                                    {(c.selected_date || c.date) ? new Date(c.selected_date || c.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                                </td>
                                <td>
                                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', textTransform: 'uppercase' }}>
                                        {c.selected_time || c.time}
                                    </span>
                                </td>
                                <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                    {c.phone || 'N/A'}
                                </td>
                                <td>
                                    <span className="data-table__notes">{c.message || c.notes || '—'}</span>
                                </td>
                                <td>
                                    <span style={{
                                        padding: '4px 10px', borderRadius: '12px', fontSize: '0.73rem', fontWeight: '600',
                                        backgroundColor: c.status === 'booked' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                                        color: c.status === 'booked' ? '#10b981' : '#9ca3af',
                                    }}>
                                        {c.status || 'unknown'}
                                    </span>
                                </td>
                                <td>
                                    <span style={{
                                        padding: '4px 10px', borderRadius: '12px', fontSize: '0.73rem', fontWeight: '600',
                                        backgroundColor: c.email_sent ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        color: c.email_sent ? '#10b981' : '#ef4444',
                                    }}>
                                        {c.email_sent ? '✅ Sent' : '❌ Not Sent'}
                                    </span>
                                </td>
                                <td>
                                    <button
                                        className="btn btn--danger btn--sm"
                                        onClick={() => onDelete(c.id)}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
