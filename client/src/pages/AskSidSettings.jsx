import React, { useState, useEffect } from 'react';
import { apiRequest } from '../config/api';
import toast from 'react-hot-toast';
import {
    HiOutlineSparkles,
    HiOutlineSave,
    HiOutlineCheck,
    HiOutlineX,
    HiOutlineInformationCircle,
    HiOutlineBookOpen,
    HiOutlineExternalLink,
    HiOutlineShieldCheck,
} from 'react-icons/hi';

export default function AskSidSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [products, setProducts] = useState([]);
    const [settings, setSettings] = useState({
        askSidEnabled: true,
        publicDemoEnabled: true,
        demoQuestionLimit: 1,
        fullAccessProductId: '04b84648-3609-4b31-9ded-2486bacf1e74',
        onlineEditionProductId: 'prod_online_reading_001',
        upgradeCtaText: 'Unlock Full Ask SID with the Digital Companion Edition ($49.99)',
        upgradeUrl: '/publications/marketing-reclassified-principle-first-approach',
        advisoryCtaEnabled: true,
        advisoryUrl: '/consultation',
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    async function fetchSettings() {
        try {
            setLoading(true);
            const data = await apiRequest('/ask-sid/settings');
            if (data.settings) {
                setSettings((prev) => ({ ...prev, ...data.settings }));
            }
            if (data.products && Array.isArray(data.products)) {
                setProducts(data.products);
            }
        } catch (err) {
            toast.error(`Failed to load Ask SID settings: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            setSaving(true);
            const res = await apiRequest('/ask-sid/settings', {
                method: 'PUT',
                body: settings,
            });
            if (res.success) {
                toast.success('Ask SID settings updated successfully!');
            }
        } catch (err) {
            toast.error(`Error saving settings: ${err.message}`);
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="page-loading" style={{ padding: '60px', textAlign: 'center' }}>
                <div className="spinner" />
                <p style={{ marginTop: '16px', color: '#a6adc8' }}>Loading Ask SID configuration…</p>
            </div>
        );
    }

    return (
        <div className="admin-page" style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.05))', border: '1px solid rgba(212,175,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4af37' }}>
                        <HiOutlineSparkles size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: '#fff', margin: 0 }}>Ask SID Settings</h1>
                        <p style={{ fontSize: '0.88rem', color: '#a6adc8', margin: '4px 0 0 0' }}>
                            Configure Phase 1 access rules, demo limitations, and product entitlements for the Marketing Reclassified digital companion.
                        </p>
                    </div>
                </div>

                <a
                    href="https://siddiqui.digital/ask-sid"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--outline btn--sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(212,175,55,0.4)', color: '#d4af37' }}
                >
                    <HiOutlineExternalLink size={16} /> View Live /ask-sid
                </a>
            </div>

            <form onSubmit={handleSubmit}>
                {/* 1. Master & Demo Controls */}
                <div style={cardStyle}>
                    <h2 style={cardHeadingStyle}>
                        <HiOutlineShieldCheck style={{ color: '#d4af37' }} /> Core Availability & Demo Controls
                    </h2>
                    <p style={cardDescStyle}>
                        Control overall Ask SID public availability and trial question limits.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '20px' }}>
                        {/* Ask SID Master Toggle */}
                        <div style={controlBoxStyle(settings.askSidEnabled)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: '600', color: '#fff' }}>Ask SID Enabled</div>
                                    <div style={{ fontSize: '0.8rem', color: '#a6adc8', marginTop: '2px' }}>
                                        Master switch for the Ask SID companion experience.
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.askSidEnabled}
                                    onChange={(e) => setSettings({ ...settings, askSidEnabled: e.target.checked })}
                                    style={checkboxStyle}
                                    id="toggle-ask-sid-enabled"
                                />
                            </div>
                        </div>

                        {/* Public Demo Toggle */}
                        <div style={controlBoxStyle(settings.publicDemoEnabled)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: '600', color: '#fff' }}>Public Demo Mode</div>
                                    <div style={{ fontSize: '0.8rem', color: '#a6adc8', marginTop: '2px' }}>
                                        Allow visitors to test 1 configurable trial question before upgrading.
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.publicDemoEnabled}
                                    onChange={(e) => setSettings({ ...settings, publicDemoEnabled: e.target.checked })}
                                    style={checkboxStyle}
                                    id="toggle-public-demo-enabled"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Demo Question Limit */}
                    <div style={{ marginTop: '20px', maxWidth: '320px' }}>
                        <label style={labelStyle} htmlFor="input-demo-limit">
                            Trial Demo Question Limit
                        </label>
                        <input
                            id="input-demo-limit"
                            type="number"
                            min="1"
                            max="10"
                            className="form-input"
                            value={settings.demoQuestionLimit}
                            onChange={(e) => setSettings({ ...settings, demoQuestionLimit: Math.max(1, parseInt(e.target.value) || 1) })}
                            style={inputStyle}
                        />
                        <span style={hintStyle}>Default is 1 question per visitor before requiring the Digital Companion Edition.</span>
                    </div>
                </div>

                {/* 2. Product Access Mapping */}
                <div style={cardStyle}>
                    <h2 style={cardHeadingStyle}>
                        <HiOutlineBookOpen style={{ color: '#d4af37' }} /> Product Access Mapping (Critical Business Rule)
                    </h2>
                    <p style={cardDescStyle}>
                        Select which existing product grants full Ask SID access. The $20 Online Edition must NOT grant full access.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '20px' }}>
                        {/* Full Access Product */}
                        <div>
                            <label style={labelStyle} htmlFor="select-full-product">
                                Full Ask SID Product (Entitlement: Full Access)
                            </label>
                            <select
                                id="select-full-product"
                                className="form-input"
                                value={settings.fullAccessProductId}
                                onChange={(e) => setSettings({ ...settings, fullAccessProductId: e.target.value })}
                                style={inputStyle}
                            >
                                <option value="04b84648-3609-4b31-9ded-2486bacf1e74">
                                    Marketing Reclassified: Digital Companion Edition ($49.99 / Default)
                                </option>
                                {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.title} ({p.currency} {p.price})
                                    </option>
                                ))}
                            </select>
                            <span style={hintStyle}>Purchasing this edition gives instant server-verified full conversation access.</span>
                        </div>

                        {/* Online Edition Product */}
                        <div>
                            <label style={labelStyle} htmlFor="select-online-product">
                                Online Reading Edition Product (Entitlement: Online Reader Only)
                            </label>
                            <select
                                id="select-online-product"
                                className="form-input"
                                value={settings.onlineEditionProductId}
                                onChange={(e) => setSettings({ ...settings, onlineEditionProductId: e.target.value })}
                                style={inputStyle}
                            >
                                <option value="prod_online_reading_001">
                                    Marketing Reclassified: Online Edition ($20 / Default)
                                </option>
                                {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.title} — Online Reader Access
                                    </option>
                                ))}
                            </select>
                            <span style={hintStyle}>Users with this entitlement only get online reading access (no full Ask SID).</span>
                        </div>
                    </div>
                </div>

                {/* 3. Upgrade CTA & Destination */}
                <div style={cardStyle}>
                    <h2 style={cardHeadingStyle}>
                        <HiOutlineSparkles style={{ color: '#d4af37' }} /> Upgrade CTA & Checkout Destination
                    </h2>
                    <p style={cardDescStyle}>
                        Configure the message and destination shown to users who do not have the Digital Companion Edition.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginTop: '16px' }}>
                        <div>
                            <label style={labelStyle} htmlFor="input-upgrade-text">Upgrade CTA Headline / Text</label>
                            <input
                                id="input-upgrade-text"
                                type="text"
                                className="form-input"
                                value={settings.upgradeCtaText}
                                onChange={(e) => setSettings({ ...settings, upgradeCtaText: e.target.value })}
                                style={inputStyle}
                                placeholder="Unlock Full Ask SID with the Digital Companion Edition ($49.99)"
                            />
                        </div>

                        <div>
                            <label style={labelStyle} htmlFor="input-upgrade-url">Upgrade Checkout Destination URL</label>
                            <input
                                id="input-upgrade-url"
                                type="text"
                                className="form-input"
                                value={settings.upgradeUrl}
                                onChange={(e) => setSettings({ ...settings, upgradeUrl: e.target.value })}
                                style={inputStyle}
                                placeholder="/publications/marketing-reclassified-principle-first-approach"
                            />
                            <span style={hintStyle}>Connects directly to the existing publication checkout flow.</span>
                        </div>
                    </div>
                </div>

                {/* 4. SID Advisory CTA Configuration */}
                <div style={cardStyle}>
                    <h2 style={cardHeadingStyle}>
                        <HiOutlineInformationCircle style={{ color: '#d4af37' }} /> SID Advisory Configuration
                    </h2>
                    <p style={cardDescStyle}>
                        When a complex organizational challenge is detected, Ask SID can suggest exploring SID Advisory.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '16px' }}>
                        <div style={controlBoxStyle(settings.advisoryCtaEnabled)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: '600', color: '#fff' }}>Enable Advisory Suggestions</div>
                                    <div style={{ fontSize: '0.8rem', color: '#a6adc8', marginTop: '2px' }}>
                                        Contextually display 'Explore SID Advisory' for deep organizational dilemmas.
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.advisoryCtaEnabled}
                                    onChange={(e) => setSettings({ ...settings, advisoryCtaEnabled: e.target.checked })}
                                    style={checkboxStyle}
                                    id="toggle-advisory-enabled"
                                />
                            </div>
                        </div>

                        <div>
                            <label style={labelStyle} htmlFor="input-advisory-url">SID Advisory Page URL</label>
                            <input
                                id="input-advisory-url"
                                type="text"
                                className="form-input"
                                value={settings.advisoryUrl}
                                onChange={(e) => setSettings({ ...settings, advisoryUrl: e.target.value })}
                                style={inputStyle}
                                placeholder="/consultation"
                            />
                            <span style={hintStyle}>Directs to the existing consultation / advisory booking page.</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                    <button
                        type="button"
                        className="btn btn--outline"
                        onClick={fetchSettings}
                        disabled={saving}
                    >
                        Reset Changes
                    </button>
                    <button
                        type="submit"
                        className="btn btn--primary"
                        disabled={saving}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#d4af37', borderColor: '#d4af37', color: '#111', fontWeight: '600', padding: '10px 24px' }}
                    >
                        {saving ? (
                            <>Saving Changes…</>
                        ) : (
                            <>
                                <HiOutlineSave size={18} /> Save Ask SID Settings
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

const cardStyle = {
    background: '#181825',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '20px',
};

const cardHeadingStyle = {
    fontSize: '1.15rem',
    fontWeight: '700',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: '0 0 4px 0',
};

const cardDescStyle = {
    fontSize: '0.85rem',
    color: '#a6adc8',
    margin: 0,
};

const controlBoxStyle = (active) => ({
    background: active ? 'rgba(212,175,55,0.06)' : 'rgba(255,255,255,0.02)',
    border: active ? '1px solid rgba(212,175,55,0.3)' : '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '16px',
    transition: 'all 0.2s ease',
});

const labelStyle = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#cdd6f4',
    marginBottom: '6px',
};

const inputStyle = {
    width: '100%',
    background: '#11111b',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#fff',
    fontSize: '0.9rem',
};

const hintStyle = {
    display: 'block',
    fontSize: '0.75rem',
    color: '#6c7086',
    marginTop: '4px',
};

const checkboxStyle = {
    width: '20px',
    height: '20px',
    accentColor: '#d4af37',
    cursor: 'pointer',
};
