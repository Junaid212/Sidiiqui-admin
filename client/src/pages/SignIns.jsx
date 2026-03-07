import { useState, useEffect } from 'react';
import { apiRequest } from '../config/api';
import SignInsTable from '../components/SignIns/SignInsTable';
import { HiOutlineUserGroup } from 'react-icons/hi';
import toast from 'react-hot-toast';

export default function SignIns() {
    const [signIns, setSignIns] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSignIns();
    }, []);

    const fetchSignIns = async () => {
        try {
            setLoading(true);
            const data = await apiRequest('/sign-ins-details');
            setSignIns(data.signIns || []);
        } catch (error) {
            console.error('Error fetching sign-ins:', error);
            toast.error('Failed to load sign-ins');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>Loading sign-in metrics...</p>
            </div>
        );
    }

    return (
        <div className="page">
            <header className="page__header">
                <div>
                    <h1 className="page__title">Sign-In Metrics</h1>
                    <p className="page__subtitle">Overview of users who have signed into your platform.</p>
                </div>
                <div style={{
                    width: '48px', height: '48px', borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.1)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: '#ef4444',
                    fontSize: '1.5rem'
                }}>
                    <HiOutlineUserGroup />
                </div>
            </header>

            <div className="card">
                <SignInsTable signIns={signIns} />
            </div>
        </div>
    );
}
