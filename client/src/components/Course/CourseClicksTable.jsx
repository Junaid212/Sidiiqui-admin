import { useState } from 'react';

export default function CourseClicksTable({ clicks }) {
    const isEmpty = !clicks || clicks.length === 0;

    return (
        <div className="table-wrapper">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>User ID</th>
                        <th>User Email</th>
                        <th>Course Title</th>
                        <th>Visited Date</th>
                    </tr>
                </thead>
                <tbody>
                    {isEmpty ? (
                        <tr>
                            <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                No course clicks found.
                            </td>
                        </tr>
                    ) : (
                        clicks.map((click) => (
                            <tr key={click.id}>
                                <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {click.user_id !== 'N/A' ? click.user_id.split('-')[0] + '...' : 'N/A'}
                                </td>
                                <td style={{ color: 'var(--accent-primary)', fontSize: '0.85rem' }}>{click.email}</td>
                                <td>
                                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', textTransform: 'uppercase' }}>
                                        {click.course_title}
                                    </span>
                                </td>
                                <td>
                                    {new Date(click.clicked_at).toLocaleDateString(undefined, {
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
