import { useMemo, useState, useEffect } from 'react';
import { apiRequest } from '../config/api';
import ConsultationsTable from '../components/Consultations/ConsultationsTable';
import toast from 'react-hot-toast';

export default function Consultations() {
    const [consultations, setConsultations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('created_desc');

    useEffect(() => {
        fetchConsultations();
    }, []);

    async function fetchConsultations() {
        try {
            const data = await apiRequest('/consultations');
            setConsultations(data.consultations || []);
        } catch (err) {
            toast.error(`Failed to load: ${err.message}`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Are you sure you want to delete this consultation?')) return;

        try {
            await apiRequest(`/consultations/${id}`, { method: 'DELETE' });
            setConsultations((prev) => prev.filter((c) => c.id !== id));
            toast.success('Consultation deleted');
        } catch (err) {
            toast.error('Failed to delete consultation');
            console.error(err);
        }
    }

    async function handleStatusChange(id, status) {
        try {
            const data = await apiRequest(`/consultations/${id}`, {
                method: 'PATCH',
                body: { status },
            });
            setConsultations((prev) => prev.map((c) => (c.id === id ? data.consultation : c)));
            toast.success('Booking status updated');
        } catch (err) {
            toast.error(err.message || 'Failed to update booking');
            console.error(err);
        }
    }

    const visibleConsultations = useMemo(() => {
        const query = search.trim().toLowerCase();
        const filtered = consultations.filter((c) => {
            const status = (c.status || 'unknown').toLowerCase();
            if (statusFilter !== 'all' && status !== statusFilter) return false;
            if (!query) return true;
            const haystack = [
                c.name,
                c.email,
                c.phone,
                c.message,
                c.date,
                c.selected_date,
                c.time,
                c.selected_time,
                c.status,
            ].join(' ').toLowerCase();
            return haystack.includes(query);
        });

        const appointmentDate = (c) => String(c.selected_date || c.date || '');
        const created = (c) => new Date(c.created_at || 0).getTime();

        return [...filtered].sort((a, b) => {
            if (sortBy === 'created_asc') return created(a) - created(b);
            if (sortBy === 'date_desc') return appointmentDate(b).localeCompare(appointmentDate(a));
            if (sortBy === 'date_asc') return appointmentDate(a).localeCompare(appointmentDate(b));
            if (sortBy === 'name_asc') return String(a.name || '').localeCompare(String(b.name || ''));
            return created(b) - created(a);
        });
    }, [consultations, search, statusFilter, sortBy]);

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner" />
                <p>Loading consultations...</p>
            </div>
        );
    }

    const controlStyle = {
        padding: '10px 12px',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        minWidth: '180px',
    };

    return (
        <div className="page">
            <div className="page__header">
                <div>
                    <h1 className="page__title">Consultations</h1>
                    <p className="page__subtitle">
                        {visibleConsultations.length} of {consultations.length} consultation{consultations.length !== 1 ? 's' : ''}
                    </p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, email, phone, or message"
                    style={{ ...controlStyle, flex: '1 1 240px', minWidth: '220px' }}
                />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={controlStyle}>
                    <option value="all">All statuses</option>
                    <option value="booked">Booked</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no-show">No-show</option>
                </select>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={controlStyle}>
                    <option value="created_desc">Newest bookings</option>
                    <option value="created_asc">Oldest bookings</option>
                    <option value="date_desc">Appointment date (newest)</option>
                    <option value="date_asc">Appointment date (oldest)</option>
                    <option value="name_asc">Customer name A–Z</option>
                </select>
            </div>

            <ConsultationsTable
                consultations={visibleConsultations}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
            />
        </div>
    );
}
