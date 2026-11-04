function formatAppointmentDate(value) {
    if (!value) return '—';
    const raw = String(value).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [year, month, day] = raw.split('-').map(Number);
        return new Date(year, month - 1, day).toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function formatBookedOn(value) {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? '—'
        : parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ConsultationsTable({ consultations, onDelete, onStatusChange }) {
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
                                    {formatBookedOn(c.created_at)}
                                </td>
                                <td style={{ fontWeight: '500' }}>
                                    {formatAppointmentDate(c.selected_date || c.date)}
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
                                    <select
                                        value={c.status || 'booked'}
                                        onChange={(e) => onStatusChange?.(c.id, e.target.value)}
                                        style={{
                                            padding: '4px 8px',
                                            borderRadius: '12px',
                                            fontSize: '0.73rem',
                                            fontWeight: '600',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: c.status === 'cancelled' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                                        }}
                                    >
                                        <option value="booked">booked</option>
                                        <option value="confirmed">confirmed</option>
                                        <option value="completed">completed</option>
                                        <option value="cancelled">cancelled</option>
                                        <option value="no-show">no-show</option>
                                    </select>
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
