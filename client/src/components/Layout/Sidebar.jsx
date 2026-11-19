import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    HiOutlineBookOpen,
    HiOutlineChartBar,
    HiOutlineCalendar,
    HiOutlineNewspaper,
    HiOutlineLogout,
    HiOutlineMenu,
    HiOutlineX,
    HiOutlineShoppingCart,
    HiOutlineCursorClick,
    HiOutlineUserGroup,
    HiOutlineMail,
    HiOutlineClipboardList,
    HiOutlineTag,
    HiOutlineSparkles,
    HiOutlineDocumentText,
    HiOutlineIdentification,
    HiOutlineUsers,
} from 'react-icons/hi';
import { ROUTE_PERMISSION } from '../../utils/access';
import { useState } from 'react';

const navItems = [
    { to: '/', icon: HiOutlineChartBar, label: 'Dashboard' },
    { to: '/orders', icon: HiOutlineShoppingCart, label: 'EBook Orders' },
    { to: '/coupons', icon: HiOutlineTag, label: 'Coupons & Discounts' },
    { to: '/products', icon: HiOutlineBookOpen, label: 'Digital Products' },
    { to: '/ask-sid', icon: HiOutlineSparkles, label: 'Ask SID Settings' },
    { to: '/reading', icon: HiOutlineBookOpen, label: 'Online Reading' },
    { to: '/companion-files', icon: HiOutlineDocumentText, label: 'Companion Files' },
    { to: '/customers-access', icon: HiOutlineIdentification, label: 'Reader & Companion Customers' },
    // { to: '/course-interactions', icon: HiOutlineCursorClick, label: 'Course Clicks' },
    { to: '/consultations', icon: HiOutlineCalendar, label: 'Consultations' },
    { to: '/sign-ins', icon: HiOutlineUserGroup, label: 'Sign-Ins' },
    { to: '/contact-messages', icon: HiOutlineMail, label: 'Contact Messages' },
    { to: '/questionnaire', icon: HiOutlineClipboardList, label: 'Questionnaire' },
    { to: '/blogs', icon: HiOutlineNewspaper, label: 'Blog Management' },
    { to: '/team', icon: HiOutlineUsers, label: 'Team & Access' },
];

export default function Sidebar() {
    const { signOut, profile: profileRow, user, can, roleLabel } = useAuth();
    // a new Editor / Support account may have no profile row yet: fall back to the sign-in e-mail
    const profile = profileRow || (user ? { email: user.email } : null);
    // each person sees only the screens their role allows (the server enforces it too)
    const visibleItems = navItems.filter((item) => can(ROUTE_PERMISSION[item.to]));
    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);

    function handleSignOut() {
        signOut();
        navigate('/login');
    }

    return (
        <>
            {/* Mobile toggle */}
            <button
                className="sidebar-toggle"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle sidebar"
            >
                {mobileOpen ? <HiOutlineX size={24} /> : <HiOutlineMenu size={24} />}
            </button>

            {/* Overlay */}
            {mobileOpen && (
                <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
            )}

            <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
                {/* Brand */}
                <div className="sidebar__brand">
                    <div className="sidebar__logo">
                        <span className="sidebar__logo-icon">S</span>
                    </div>
                    <h1 className="sidebar__title">Admin Panel</h1>
                </div>

                {/* Navigation */}
                <nav className="sidebar__nav">
                    {visibleItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            className={({ isActive }) =>
                                `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                            }
                            onClick={() => setMobileOpen(false)}
                        >
                            <item.icon className="sidebar__link-icon" />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* User & Logout */}
                <div className="sidebar__footer">
                    {profile && (
                        <div className="sidebar__user">
                            <div className="sidebar__avatar">
                                {(profile.full_name || profile.email || '?')[0].toUpperCase()}
                            </div>
                            <div className="sidebar__user-info">
                                <span className="sidebar__user-name">
                                    {profile.full_name || 'Admin'}{roleLabel ? ` · ${roleLabel}` : ''}
                                </span>
                                <span className="sidebar__user-email">{profile.email}</span>
                            </div>
                        </div>
                    )}
                    <button className="sidebar__logout" onClick={handleSignOut}>
                        <HiOutlineLogout />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
