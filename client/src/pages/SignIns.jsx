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

    const ebookCount = signIns.filter(s => s.source?.includes('Ebook')).length;
    const commentCount = signIns.filter(s => s.source?.includes('Comment')).length;
    const consultationCount = signIns.filter(s => s.source?.includes('Consultation')).length;

    return (
        <div className="page">
            <header className="page__header">
                <div>
                    <h1 className="page__title">Sign-In Metrics</h1>
                    <p className="page__subtitle">Users who signed in via Ebook purchase, Consultations, or Blog commenting.</p>
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

            {/* Stats Row */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <div style={{
                    flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)', padding: '16px 20px', textAlign: 'center'
                }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        {signIns.length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>
                        Total Sign-Ins
                    </div>
                </div>
                <div style={{
                    flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)', padding: '16px 20px', textAlign: 'center'
                }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#f59e0b' }}>
                        {consultationCount}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>
                        📅 Consultations
                    </div>
                </div>
                <div style={{
                    flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)', padding: '16px 20px', textAlign: 'center'
                }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#10b981' }}>
                        {ebookCount}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>
                        📚 Ebook Purchases
                    </div>
                </div>
                <div style={{
                    flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)', padding: '16px 20px', textAlign: 'center'
                }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#818cf8' }}>
                        {commentCount}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>
                        💬 Blog Comments
                    </div>
                </div>
            </div>

            <div className="card">
                <SignInsTable signIns={signIns} />
            </div>
        </div>
    );
}
