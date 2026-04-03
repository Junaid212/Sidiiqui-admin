export default function SignInsTable({ signIns }) {
    const isEmpty = !signIns || signIns.length === 0;

    const getSourceBadge = (source) => {
        if (!source) return null;
        return source.split(', ').map((s, i) => {
            const isEbook = s === 'Ebook Purchase';
            return (
                <span key={i} style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '0.72rem',
                    fontWeight: '600',
                    marginRight: '4px',
                    background: isEbook ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                    color: isEbook ? '#10b981' : '#818cf8',
                    border: `1px solid ${isEbook ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`
                }}>
                    {isEbook ? '📚' : '💬'} {s}
                </span>
            );
        });
    };

    return (
        <div className="table-wrapper">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Source</th>
                        <th>Signed In</th>
                    </tr>
                </thead>
                <tbody>
                    {isEmpty ? (
                        <tr>
                            <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                No sign-ins found.
                            </td>
                        </tr>
                    ) : (
                        signIns.map((s) => (
                            <tr key={s.id}>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {s.avatar_url ? (
                                            <img
                                                src={s.avatar_url}
                                                alt={s.full_name || 'User'}
                                                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: 32, height: 32, borderRadius: '50%',
                                                background: 'var(--accent-gradient)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.8rem', fontWeight: '700', color: '#fff'
                                            }}>
                                                {(s.full_name || s.email || '?').charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <span style={{ fontWeight: '500', fontSize: '0.88rem' }}>
                                            {s.full_name || 'Unknown'}
                                        </span>
                                    </div>
                                </td>
                                <td>
                                    <a href={`mailto:${s.email}`} className="data-table__email">
                                        {s.email}
                                    </a>
                                </td>
                                <td>{getSourceBadge(s.source)}</td>
                                <td>
                                    {new Date(s.last_sign_in_at).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
