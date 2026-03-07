import { useState, useEffect } from 'react';
import { apiRequest } from '../config/api';
import ConsultationsTable from '../components/Consultations/ConsultationsTable';
import toast from 'react-hot-toast';

export default function Consultations() {
    const [consultations, setConsultations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchConsultations();
    }, []);

    async function fetchConsultations() {
        try {
            const data = await apiRequest('/consultations');
            setConsultations(data.consultations || []);
        } catch (err) {
            toast.error('Failed to load consultations');
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

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner" />
                <p>Loading consultations...</p>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page__header">
                <h1 className="page__title">Consultations</h1>
                <p className="page__subtitle">
                    {consultations.length} consultation{consultations.length !== 1 ? 's' : ''} booked
                </p>
            </div>

            <ConsultationsTable
                consultations={consultations}
                onDelete={handleDelete}
            />
        </div>
    );
}
