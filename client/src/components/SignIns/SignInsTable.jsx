import { useState } from 'react';

export default function SignInsTable({ signIns }) {
    const isEmpty = !signIns || signIns.length === 0;

    return (
        <div className="table-wrapper">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>User ID</th>
                        <th>User Email-ID</th>
                        <th>Signed In Date</th>
                    </tr>
                </thead>
                <tbody>
                    {isEmpty ? (
                        <tr>
                            <td colSpan="3" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                No sign-ins found.
                            </td>
                        </tr>
                    ) : (
                        signIns.map((s) => (
                            <tr key={s.id}>
                                <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {s.id.split('-')[0]}...
                                </td>
                                <td>
                                    <a href={`mailto:${s.email}`} className="data-table__email">
                                        {s.email}
                                    </a>
                                </td>
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
