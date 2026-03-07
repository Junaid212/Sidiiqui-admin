import { useState, useEffect } from 'react';
import { apiRequest } from '../config/api';
import CourseClicksTable from '../components/Course/CourseClicksTable';
import { HiOutlineCursorClick } from 'react-icons/hi';
import toast from 'react-hot-toast';

export default function CourseClicks() {
    const [clicks, setClicks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchClicks();
    }, []);

    const fetchClicks = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/course-clicks-details');
            setClicks(data.clicks || []);
        } catch (error) {
            console.error('Error fetching course clicks:', error);
            toast.error('Failed to load course clicks');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>Loading course interactions...</p>
            </div>
        );
    }

    return (
        <div className="page">
            <header className="page__header">
                <div>
                    <h1 className="page__title">Course Interactions</h1>
                    <p className="page__subtitle">View details of users who have engaged with course materials.</p>
                </div>
                <div style={{
                    width: '48px', height: '48px', borderRadius: '12px',
                    background: 'rgba(59, 130, 246, 0.1)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: '#3b82f6',
                    fontSize: '1.5rem'
                }}>
                    <HiOutlineCursorClick />
                </div>
            </header>

            <div className="card">
                <CourseClicksTable clicks={clicks} />
            </div>
        </div>
    );
}
