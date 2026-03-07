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
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {isEmpty ? (
                        <tr>
                            <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                No consultations found.
                            </td>
                        </tr>
                    ) : (
                        consultations.map((c) => (
                            <tr key={c.id}>
                                <td>
                                    <a href={`mailto:${c.email}`} className="data-table__email">
                                        {c.email}
                                    </a>
                                </td>
                                <td>
                                    <span className="data-table__name">{c.name}</span>
                                </td>
                                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    {new Date(c.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                </td>
                                <td style={{ fontWeight: '500' }}>
                                    {new Date(c.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                </td>
                                <td>
                                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', textTransform: 'uppercase' }}>
                                        {c.time}
                                    </span>
                                </td>
                                <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                    {c.phone || 'N/A'}
                                </td>
                                <td>
                                    <span className="data-table__notes">{c.notes || '—'}</span>
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
