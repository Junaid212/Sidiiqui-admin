import { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../config/api';
import toast from 'react-hot-toast';
import {
    HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX,
    HiOutlineUpload, HiOutlinePhotograph, HiOutlineDocumentText,
    HiOutlineChevronUp, HiOutlineChevronDown, HiOutlineCheck,
    HiOutlineBookOpen, HiOutlineSparkles, HiOutlineTag,
    HiOutlineUsers, HiOutlineCurrencyDollar, HiOutlineUser
} from 'react-icons/hi';

/* ─── Helpers ──────────────────────────────────────────────────────── */
function slugify(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

function safeArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
}

/* ─── Reusable Repeatable String List ─────────────────────────────── */
function RepeatableStringList({ label, items, onChange, placeholder = 'Add item…', hint = '' }) {
    const [draft, setDraft] = useState('');
    const [editIdx, setEditIdx] = useState(null);
    const [editVal, setEditVal] = useState('');

    const safeItems = Array.isArray(items) ? items : [];

    function add() {
        const v = draft.trim();
        if (!v) return;
        onChange([...safeItems, v]);
        setDraft('');
    }

    function remove(i) { onChange(safeItems.filter((_, idx) => idx !== i)); }
    function moveUp(i) {
        if (i === 0) return;
        const a = [...safeItems]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a);
    }
    function moveDown(i) {
        if (i === safeItems.length - 1) return;
        const a = [...safeItems]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; onChange(a);
    }
    function startEdit(i) { setEditIdx(i); setEditVal(safeItems[i]); }
    function saveEdit(i) {
        const v = editVal.trim();
        if (!v) return;
        const a = [...safeItems]; a[i] = v; onChange(a);
        setEditIdx(null); setEditVal('');
    }

    return (
        <div>
            {label && <label style={labelStyle}>{label}</label>}
            {hint && <p style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: 6 }}>{hint}</p>}
            {safeItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    {editIdx === i ? (
                        <>
                            <input
                                value={editVal}
                                onChange={e => setEditVal(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && saveEdit(i)}
                                style={inputStyle}
                                autoFocus
                            />
                            <button type="button" onClick={() => saveEdit(i)} style={iconBtnStyle('#10b981')} title="Save">
                                <HiOutlineCheck size={14} />
                            </button>
                            <button type="button" onClick={() => setEditIdx(null)} style={iconBtnStyle('#6b7280')} title="Cancel">
                                <HiOutlineX size={14} />
                            </button>
                        </>
                    ) : (
                        <>
                            <span style={{ flex: 1, padding: '8px 10px', background: '#28283d', borderRadius: 6, color: '#e5e7eb', fontSize: '0.83rem', border: '1px solid rgba(255,255,255,0.08)' }}>{item}</span>
                            <button type="button" onClick={() => moveUp(i)} style={iconBtnStyle('#a1a1aa')} title="Move up"><HiOutlineChevronUp size={14} /></button>
                            <button type="button" onClick={() => moveDown(i)} style={iconBtnStyle('#a1a1aa')} title="Move down"><HiOutlineChevronDown size={14} /></button>
                            <button type="button" onClick={() => startEdit(i)} style={iconBtnStyle('#818cf8')} title="Edit"><HiOutlinePencil size={14} /></button>
                            <button type="button" onClick={() => remove(i)} style={iconBtnStyle('#ef4444')} title="Delete"><HiOutlineTrash size={14} /></button>
                        </>
                    )}
                </div>
            ))}
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                    type="text"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
                    placeholder={placeholder}
                    style={{ ...inputStyle, flex: 1 }}
                />
                <button type="button" onClick={add} style={{ ...addBtnStyle, whiteSpace: 'nowrap' }}>
                    <HiOutlinePlus size={14} /> Add
                </button>
            </div>
        </div>
    );
}

/* ─── Offerings Cards Manager ─────────────────────────────────────── */
function OfferingsCardsManager({ cards = [], onChange }) {
    const safeCards = Array.isArray(cards) ? cards : [];

    function addCard() {
        onChange([...safeCards, { title: '', desc: '' }]);
    }

    function removeCard(idx) {
        onChange(safeCards.filter((_, i) => i !== idx));
    }

    function updateCard(idx, key, val) {
        const next = [...safeCards];
        next[idx] = { ...next[idx], [key]: val };
        onChange(next);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {safeCards.map((card, idx) => (
                <div key={idx} style={{ background: '#1a1a2b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '12px 14px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <p style={{ color: '#818cf8', fontSize: '0.75rem', fontWeight: 700, margin: 0 }}>
                            Feature Card 0{idx + 1}
                        </p>
                        <button type="button" onClick={() => removeCard(idx)} style={iconBtnStyle('#ef4444')} title="Delete Card">
                            <HiOutlineTrash size={13} />
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                            <label style={labelStyle}>Card Title</label>
                            <input
                                value={card.title || ''}
                                onChange={e => updateCard(idx, 'title', e.target.value)}
                                style={inputStyle}
                                placeholder="e.g. A New Definition of Marketing"
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Card Description</label>
                            <textarea
                                rows={2}
                                value={card.desc || ''}
                                onChange={e => updateCard(idx, 'desc', e.target.value)}
                                style={{ ...inputStyle, resize: 'vertical' }}
                                placeholder="e.g. The Sid definition places marketing upstream, as governed strategic intelligence..."
                            />
                        </div>
                    </div>
                </div>
            ))}
            <button
                type="button"
                onClick={addCard}
                style={{ ...addBtnStyle, alignSelf: 'flex-start', marginTop: 4 }}
            >
                <HiOutlinePlus size={14} /> Add Feature Card
            </button>
        </div>
    );
}

/* ─── Feature Checklist Manager (Inside Edition Form) ──────────────── */
function FeatureChecklistManager({ features = [], onChange }) {
    const [draftText, setDraftText] = useState('');
    const [draftIncluded, setDraftIncluded] = useState(true);

    const safeList = Array.isArray(features) ? features : [];

    function addFeature() {
        const t = draftText.trim();
        if (!t) return;
        const finalVal = draftIncluded ? t : `__exclude__${t}`;
        onChange([...safeList, finalVal]);
        setDraftText('');
        setDraftIncluded(true);
    }

    function removeFeature(idx) {
        onChange(safeList.filter((_, i) => i !== idx));
    }

    function toggleFeature(idx) {
        const item = safeList[idx];
        const isExcluded = typeof item === 'string' && item.startsWith('__exclude__');
        const clean = isExcluded ? item.replace('__exclude__', '') : item;
        const updated = isExcluded ? clean : `__exclude__${clean}`;
        const copy = [...safeList];
        copy[idx] = updated;
        onChange(copy);
    }

    return (
        <div style={{ marginTop: 8 }}>
            <label style={labelStyle}>Edition Feature Checklist (Bulleted Highlights)</label>
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0 0 8px 0' }}>
                Toggle ✓ for included (green checkmark) or ✗ for excluded (grey cross mark).
            </p>
            {safeList.map((f, idx) => {
                const isExcluded = typeof f === 'string' && f.startsWith('__exclude__');
                const clean = isExcluded ? f.replace('__exclude__', '') : f;
                return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                        <button
                            type="button"
                            onClick={() => toggleFeature(idx)}
                            style={{
                                padding: '4px 8px',
                                borderRadius: 4,
                                border: 'none',
                                background: isExcluded ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                                color: isExcluded ? '#ef4444' : '#10b981',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                minWidth: 26,
                                textAlign: 'center'
                            }}
                            title={isExcluded ? 'Click to mark as Included (✓)' : 'Click to mark as Excluded (✗)'}
                        >
                            {isExcluded ? '✗' : '✓'}
                        </button>
                        <span style={{ flex: 1, padding: '6px 10px', background: '#28283d', borderRadius: 6, color: isExcluded ? '#9ca3af' : '#e5e7eb', fontSize: '0.8rem', textDecoration: isExcluded ? 'line-through' : 'none' }}>
                            {clean}
                        </span>
                        <button type="button" onClick={() => removeFeature(idx)} style={iconBtnStyle('#ef4444')} title="Remove">
                            <HiOutlineTrash size={13} />
                        </button>
                    </div>
                );
            })}
            <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                <button
                    type="button"
                    onClick={() => setDraftIncluded(!draftIncluded)}
                    style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: 'none',
                        background: draftIncluded ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                        color: draftIncluded ? '#10b981' : '#ef4444',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {draftIncluded ? '✓ Included' : '✗ Excluded'}
                </button>
                <input
                    type="text"
                    value={draftText}
                    onChange={e => setDraftText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                    placeholder="e.g. Access the complete book through a protected online reader."
                    style={{ ...inputStyle, flex: 1 }}
                />
                <button type="button" onClick={addFeature} style={addBtnStyle}>
                    <HiOutlinePlus size={13} /> Add Feature
                </button>
            </div>
        </div>
    );
}

/* ─── Access Option / Edition Form ─────────────────────────────────── */
const EMPTY_OPTION = {
    book_code: '',
    name: '',
    badge: '',
    description: '',
    price: '',
    currency: 'USD',
    access_type: 'companion',
    status: 'active',
    cta_text: '',
    payhip_product_id: '',
    payhip_checkout_url: '',
    can_read_online: true,
    can_download: true,
    upgrade_payhip_product_id: '',
    upgrade_price: '29.99',
    online_file_path: '',
    download_file_path: '',
    features: []
};

function OptionForm({ val, setVal, onSave, onCancel, saveLabel = 'Save Edition' }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: 8 }}>
                <div>
                    <label style={{ ...labelStyle, color: '#f59e0b' }}>Edition Book Code *</label>
                    <input
                        placeholder="e.g. MR-ONLINE-001"
                        value={val.book_code || ''}
                        onChange={e => setVal(p => ({ ...p, book_code: e.target.value.trim().toUpperCase() }))}
                        style={{ ...inputStyle, borderColor: 'rgba(245, 158, 11, 0.4)' }}
                    />
                </div>
                <div>
                    <label style={labelStyle}>Edition Title *</label>
                    <input
                        placeholder="e.g. Online Reading Edition or Digital Companion Edition"
                        value={val.name || ''}
                        onChange={e => setVal(p => ({ ...p, name: e.target.value }))}
                        style={inputStyle}
                    />
                </div>
                <div>
                    <label style={labelStyle}>Badge (Optional)</label>
                    <input
                        placeholder="e.g. INCLUDES ASK SID or BEST VALUE"
                        value={val.badge || ''}
                        onChange={e => setVal(p => ({ ...p, badge: e.target.value }))}
                        style={inputStyle}
                    />
                </div>
            </div>

                        {/* Payhip Product & Checkout Configuration */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'rgba(238, 77, 45, 0.05)', padding: 10, borderRadius: 6, border: '1px solid rgba(238, 77, 45, 0.2)' }}>
                <div>
                    <label style={{ ...labelStyle, fontSize: '0.73rem', color: '#f87171' }}>
                        💳 Payhip Product ID
                    </label>
                    <input
                        placeholder="e.g. AbC12 or leave empty if using custom URL"
                        value={val.payhip_product_id || ''}
                        onChange={e => setVal(p => ({ ...p, payhip_product_id: e.target.value.trim() }))}
                        style={{ ...inputStyle, fontSize: '0.78rem' }}
                    />
                </div>
                <div>
                    <label style={{ ...labelStyle, fontSize: '0.73rem', color: '#f87171' }}>
                        🔗 Payhip Direct Checkout URL
                    </label>
                    <input
                        placeholder="https://payhip.com/b/XXXX"
                        value={val.payhip_checkout_url || ''}
                        onChange={e => setVal(p => ({ ...p, payhip_checkout_url: e.target.value.trim() }))}
                        style={{ ...inputStyle, fontSize: '0.78rem' }}
                    />
                </div>
                <div>
                    <label style={{ ...labelStyle, fontSize: '0.73rem', color: '#fbbf24' }}>
                        ⚡ Upgrade Payhip Product ID ($29.99)
                    </label>
                    <input
                        placeholder="e.g. UpGr4de12 (for Online -> Companion upgrade)"
                        value={val.upgrade_payhip_product_id || ''}
                        onChange={e => setVal(p => ({ ...p, upgrade_payhip_product_id: e.target.value.trim() }))}
                        style={{ ...inputStyle, fontSize: '0.78rem' }}
                    />
                </div>
                <div>
                    <label style={{ ...labelStyle, fontSize: '0.73rem', color: '#fbbf24' }}>
                        💰 Upgrade Price Difference (USD)
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        placeholder="29.99"
                        value={val.upgrade_price ?? '29.99'}
                        onChange={e => setVal(p => ({ ...p, upgrade_price: e.target.value }))}
                        style={{ ...inputStyle, fontSize: '0.78rem' }}
                    />
                </div>
                <div style={{ gridColumn: 'span 2', display: 'flex', gap: 16, paddingTop: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#e5e7eb', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={val.can_read_online !== false}
                            onChange={e => setVal(p => ({ ...p, can_read_online: e.target.checked }))}
                        />
                        <span>📖 Online Reader Eligible</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#e5e7eb', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={val.can_download !== false && val.access_type !== 'online'}
                            onChange={e => setVal(p => ({ ...p, can_download: e.target.checked }))}
                        />
                        <span>📥 PDF Download Eligible</span>
                    </label>
                </div>
            </div>

            {/* Dedicated Document Association for this Edition */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                    <label style={{ ...labelStyle, fontSize: '0.73rem', color: '#60a5fa' }}>
                        📖 Online Reader Document (Protected View)
                    </label>
                    <input
                        placeholder="ebooks/marketing-reclassified-online.pdf"
                        value={val.online_file_path || ''}
                        onChange={e => setVal(p => ({ ...p, online_file_path: e.target.value }))}
                        style={{ ...inputStyle, fontSize: '0.78rem' }}
                    />
                </div>
                <div>
                    <label style={{ ...labelStyle, fontSize: '0.73rem', color: '#10b981' }}>
                        📥 Downloadable Document (Companion Edition)
                    </label>
                    <input
                        placeholder="ebooks/marketing-reclassified-companion.pdf"
                        value={val.download_file_path || ''}
                        onChange={e => setVal(p => ({ ...p, download_file_path: e.target.value }))}
                        style={{ ...inputStyle, fontSize: '0.78rem' }}
                    />
                </div>
            </div>
            <div>
                <label style={labelStyle}>Description</label>
                <textarea
                    rows={2}
                    placeholder="e.g. Own the book. Explore the thinking. Apply the principles."
                    value={val.description || ''}
                    onChange={e => setVal(p => ({ ...p, description: e.target.value }))}
                    style={{ ...inputStyle, resize: 'vertical' }}
                />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                <div>
                    <label style={labelStyle}>Price</label>
                    <input
                        type="number"
                        step="0.01"
                        placeholder="49.99"
                        value={val.price ?? ''}
                        onChange={e => setVal(p => ({ ...p, price: e.target.value }))}
                        style={inputStyle}
                    />
                </div>
                <div>
                    <label style={labelStyle}>Currency</label>
                    <select
                        value={val.currency || 'USD'}
                        onChange={e => setVal(p => ({ ...p, currency: e.target.value }))}
                        style={selectStyle}
                    >
                        <option value="USD">USD</option>
                        <option value="AED">AED</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>Access Type</label>
                    <select
                        value={val.access_type || 'companion'}
                        onChange={e => setVal(p => ({ ...p, access_type: e.target.value }))}
                        style={selectStyle}
                    >
                        <option value="companion">Digital Companion</option>
                        <option value="online">Online Reading</option>
                        <option value="download">Downloadable PDF</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>Status</label>
                    <select
                        value={val.status || 'active'}
                        onChange={e => setVal(p => ({ ...p, status: e.target.value }))}
                        style={selectStyle}
                    >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="coming_soon">Coming Soon</option>
                    </select>
                </div>
            </div>
            <div>
                <label style={labelStyle}>CTA Button Text</label>
                <input
                    placeholder="e.g. Get Digital Companion · $49.99"
                    value={val.cta_text || ''}
                    onChange={e => setVal(p => ({ ...p, cta_text: e.target.value }))}
                    style={inputStyle}
                />
            </div>

            {/* Features Checklist */}
            <FeatureChecklistManager
                features={val.features || []}
                onChange={list => setVal(p => ({ ...p, features: list }))}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={onSave} style={addBtnStyle}><HiOutlineCheck size={13} /> {saveLabel}</button>
                {onCancel && <button type="button" onClick={onCancel} style={{ ...addBtnStyle, background: 'rgba(107,114,128,0.2)' }}>Cancel</button>}
            </div>
        </div>
    );
}

/* ─── Access Options Manager ───────────────────────────────────────── */
function AccessOptionsManager({ items = [], onChange }) {
    const [editIdx, setEditIdx] = useState(null);
    const [newDraft, setNewDraft] = useState(EMPTY_OPTION);
    const [editDraft, setEditDraft] = useState(EMPTY_OPTION);

    const safeItems = Array.isArray(items) ? items : [];

    function add() {
        if (!newDraft.name.trim()) { toast.error('Edition name is required'); return; }
        const code = (newDraft.book_code || '').trim().toUpperCase();
        if (code && safeItems.some(item => (item.book_code || '').toUpperCase() === code)) {
            toast.error(`Duplicate book code "${code}". Each edition must have a unique code.`);
            return;
        }
        onChange([...safeItems, { ...newDraft, book_code: code, price: Number(newDraft.price) || 0 }]);
        setNewDraft(EMPTY_OPTION);
    }
    function remove(i) {
        onChange(safeItems.filter((_, idx) => idx !== i));
        if (editIdx === i) {
            setEditIdx(null);
            setEditDraft(EMPTY_OPTION);
        }
    }
    function startEdit(i) {
        setEditIdx(i);
        setEditDraft({ ...safeItems[i] });
    }
    function saveEdit(i) {
        if (!editDraft.name.trim()) { toast.error('Edition name is required'); return; }
        const code = (editDraft.book_code || '').trim().toUpperCase();
        if (code && safeItems.some((item, idx) => idx !== i && (item.book_code || '').toUpperCase() === code)) {
            toast.error(`Duplicate book code "${code}". Each edition must have a unique code.`);
            return;
        }
        const a = [...safeItems];
        a[i] = { ...editDraft, book_code: code, price: Number(editDraft.price) || 0 };
        onChange(a);
        setEditIdx(null);
        setEditDraft(EMPTY_OPTION);
    }
    function cancelEdit() {
        setEditIdx(null);
        setEditDraft(EMPTY_OPTION);
    }

    return (
        <div>
            <label style={labelStyle}>Book Editions & Purchase Options</label>
            {safeItems.map((opt, i) => (
                <div key={i} style={{ background: '#1a1a2b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                    {editIdx === i ? (
                        <OptionForm
                            val={editDraft}
                            setVal={setEditDraft}
                            onSave={() => saveEdit(i)}
                            onCancel={cancelEdit}
                            saveLabel="Save Edition"
                        />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    {opt.book_code && (
                                        <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)', fontSize: '0.68rem', padding: '1px 7px', borderRadius: 4, fontWeight: 700, fontFamily: 'monospace' }}>
                                            {opt.book_code}
                                        </span>
                                    )}
                                    <p style={{ color: '#e5e7eb', fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>{opt.name}</p>
                                    {opt.badge && <span style={{ background: '#A3192F', color: '#fff', fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>{opt.badge}</span>}
                                </div>
                                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 3 }}>
                                    <span style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 600 }}>{opt.currency || 'USD'} {Number(opt.price).toFixed(2)}</span>
                                    <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>· {opt.access_type} · {opt.status}</span>
                                    {opt.payhip_product_id && (
                                        <span style={{ background: 'rgba(238, 77, 45, 0.15)', color: '#f87171', border: '1px solid rgba(238, 77, 45, 0.3)', fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                                            Payhip ID: {opt.payhip_product_id}
                                        </span>
                                    )}
                                    {opt.upgrade_payhip_product_id && (
                                        <span style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)', fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                                            Upgrade ID: {opt.upgrade_payhip_product_id}
                                        </span>
                                    )}
                                    <span style={{ fontSize: '0.7rem', color: opt.can_read_online !== false ? '#34d399' : '#6b7280' }}>
                                        {opt.can_read_online !== false ? '✓ Online Reader' : '✗ No Reader'}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: (opt.can_download !== false && opt.access_type !== 'online') ? '#60a5fa' : '#6b7280' }}>
                                        {(opt.can_download !== false && opt.access_type !== 'online') ? '✓ PDF Download' : '✗ No Download'}
                                    </span>
                                </div>
                                {Array.isArray(opt.features) && opt.features.length > 0 && (
                                    <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: '4px 0 0' }}>
                                        {opt.features.length} feature bullet(s) configured
                                    </p>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <button type="button" onClick={() => startEdit(i)} style={iconBtnStyle('#818cf8')}><HiOutlinePencil size={13} /></button>
                                <button type="button" onClick={() => remove(i)} style={iconBtnStyle('#ef4444')}><HiOutlineTrash size={13} /></button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
            <div style={{ background: '#1a1a2b', border: '1.5px dashed rgba(16,185,129,0.3)', borderRadius: 8, padding: '12px 14px', marginTop: 6 }}>
                <p style={{ fontSize: '0.78rem', color: '#10b981', marginBottom: 8, fontWeight: 600 }}>Add New Edition</p>
                <OptionForm
                    val={newDraft}
                    setVal={setNewDraft}
                    onSave={add}
                    saveLabel="Add Edition"
                />
            </div>
        </div>
    );
}

/* ─── Main DigitalProducts Component ───────────────────────────────── */
export default function DigitalProducts() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [activeTab, setActiveTab] = useState('book');

    const [coverImageFile, setCoverImageFile] = useState(null);
    const [coverImagePreview, setCoverImagePreview] = useState('');
    const [heroImageFile, setHeroImageFile] = useState(null);
    const [heroImagePreview, setHeroImagePreview] = useState('');
    const [authorPhotoFile, setAuthorPhotoFile] = useState(null);
    const [authorPhotoPreview, setAuthorPhotoPreview] = useState('');
    const [productFile, setProductFile] = useState(null);

    const fileInputRef = useRef(null);
    const heroFileInputRef = useRef(null);
    const authorFileInputRef = useRef(null);
    const productFileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        // 1. Book Card / Catalog Information
        title: '',
        subtitle: '',
        slug: '',
        sku: '',
        product_type: 'publication',
        publication_status: 'available',
        author: '',
        price: '',
        currency: 'USD',
        format: 'PDF',
        description: '',
        cover_image: '',
        file_path: '',
        download_limit: 3,
        download_expiry_hours: 72,
        active: true,

        // 2. Dedicated Hero Section Information
        hero_audience_tag: '',
        hero_title: '',
        hero_title_accent: '',
        hero_subtitle: '',
        hero_motto: '',
        hero_image: '',
        hero_meta_info: '',

        // 3. Metadata Stats Numbers (About the Book)
        meta_edition_year: '',
        meta_pages: '',
        meta_chapters: '',
        meta_toolkit_note: '',

        // 4. Introduction
        intro_eyebrow: '',
        intro_lead: '',
        intro_highlight: '',
        intro_body: '',

        // 5. SID Definition
        sid_definition_quote: '',
        sid_definition_full: '',
        sid_definition_citation: '',

        // 6. 4 Systems & Offerings
        system_1_desc: '',
        system_2_desc: '',
        system_3_desc: '',
        system_4_desc: '',
        loop_note: '',
        offering_cards: [],

        // 7. Ask SID
        ask_sid_eyebrow: '',
        ask_sid_title: '',
        ask_sid_tagline: '',
        ask_sid_paragraphs: [],
        ask_sid_link_text: '',
        ask_sid_link_url: '',
        ask_sid_disclaimer: '',
        ask_sid_bottom_quote: '',
        ask_sid_questions: [],

        // 8. Audience
        who_its_for: [],
        what_not_paras: [],
        what_not_conclusion: '',

        // 9. Editions
        editions_eyebrow: '',
        editions_heading: '',
        access_options: [],
        editions_footnote: '',

        // 10. Author & About the Book
        about_book_eyebrow: '',
        about_book_title: '',
        about_book_summary: '',
        about_author_eyebrow: '',
        author_photo: '',
        author_bio: [],

        // 11. Final CTA
        cta_heading: '',
        cta_paragraphs: [],
        cta_motto: '',

        faq: [],
        related_learning: [],
        related_frameworks: [],
        related_blogs: [],
    });

    useEffect(() => { fetchProducts(); }, []);

    async function fetchProducts() {
        try {
            const data = await apiRequest('/products');
            setProducts(data.products || []);
        } catch (err) {
            toast.error('Failed to load digital products');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    function buildEmptyForm() {
        return {
            title: '',
            subtitle: '',
            slug: '',
            sku: 'PROD-' + Date.now().toString(36).toUpperCase(),
            product_type: 'publication',
            publication_status: 'available',
            author: '',
            price: '',
            currency: 'USD',
            format: 'PDF',
            description: '',
            cover_image: '',
            file_path: '',
            download_limit: 3,
            download_expiry_hours: 72,
            active: true,

            hero_audience_tag: '',
            hero_title: '',
            hero_title_accent: '',
            hero_subtitle: '',
            hero_motto: '',
            hero_image: '',
            hero_meta_info: '',

            meta_edition_year: '',
            meta_pages: '',
            meta_chapters: '',
            meta_toolkit_note: '',

            intro_eyebrow: '',
            intro_lead: '',
            intro_highlight: '',
            intro_body: '',

            sid_definition_quote: '',
            sid_definition_full: '',
            sid_definition_citation: '',

            system_1_desc: '',
            system_2_desc: '',
            system_3_desc: '',
            system_4_desc: '',
            loop_note: '',
            offering_cards: [],

            ask_sid_eyebrow: '',
            ask_sid_title: '',
            ask_sid_tagline: '',
            ask_sid_paragraphs: [],
            ask_sid_link_text: '',
            ask_sid_link_url: '',
            ask_sid_disclaimer: '',
            ask_sid_bottom_quote: '',
            ask_sid_questions: [],

            who_its_for: [],
            what_not_paras: [],
            what_not_conclusion: '',

            editions_eyebrow: '',
            editions_heading: '',
            access_options: [],
            editions_footnote: '',

            about_book_eyebrow: '',
            about_book_title: '',
            about_book_summary: '',
            about_author_eyebrow: '',
            author_photo: '',
            author_bio: [],

            cta_heading: '',
            cta_paragraphs: [],
            cta_motto: '',

            faq: [],
            related_learning: [],
            related_frameworks: [],
            related_blogs: [],
        };
    }

    function openCreateModal() {
        setEditingProduct(null);
        setCoverImageFile(null);
        setHeroImageFile(null);
        setAuthorPhotoFile(null);
        setProductFile(null);
        setActiveTab('book');
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (heroFileInputRef.current) heroFileInputRef.current.value = '';
        if (authorFileInputRef.current) authorFileInputRef.current.value = '';
        if (productFileInputRef.current) productFileInputRef.current.value = '';
        setCoverImagePreview('');
        setHeroImagePreview('');
        setAuthorPhotoPreview('');
        setFormData(buildEmptyForm());
        setModalOpen(true);
    }

    function openEditModal(prod) {
        setEditingProduct(prod);
        setCoverImageFile(null);
        setHeroImageFile(null);
        setAuthorPhotoFile(null);
        setProductFile(null);
        setActiveTab('book');
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (heroFileInputRef.current) heroFileInputRef.current.value = '';
        if (authorFileInputRef.current) authorFileInputRef.current.value = '';
        if (productFileInputRef.current) productFileInputRef.current.value = '';

        const currentCover = prod.cover_image || '';
        setCoverImagePreview(currentCover);

        let parsedV2 = {};
        if (typeof prod.why_this_book_matters === 'string' && prod.why_this_book_matters.trim().startsWith('{')) {
            try {
                parsedV2 = JSON.parse(prod.why_this_book_matters);
            } catch {
                parsedV2 = {};
            }
        }

        const currentHeroImg = parsedV2.hero_image || '';
        setHeroImagePreview(currentHeroImg);

        const currentAuthorPhoto = parsedV2.author_photo || '';
        setAuthorPhotoPreview(currentAuthorPhoto);

        setFormData({
            title: prod.title || '',
            subtitle: prod.subtitle || '',
            slug: prod.slug || '',
            sku: prod.sku || '',
            product_type: prod.product_type || 'publication',
            publication_status: prod.publication_status || 'available',
            author: prod.author || '',
            price: prod.price !== undefined ? prod.price : '',
            currency: prod.currency || 'USD',
            format: prod.format || 'PDF',
            description: prod.description || '',
            cover_image: currentCover,
            file_path: prod.file_path || '',
            download_limit: prod.download_limit || 3,
            download_expiry_hours: prod.download_expiry_hours || 72,
            active: prod.active !== false,

            hero_audience_tag: parsedV2.hero_audience_tag || '',
            hero_title: parsedV2.hero_title || '',
            hero_title_accent: parsedV2.hero_title_accent || '',
            hero_subtitle: parsedV2.hero_subtitle || '',
            hero_motto: parsedV2.hero_motto || '',
            hero_image: currentHeroImg,
            hero_meta_info: parsedV2.hero_meta_info || '',

            meta_edition_year: parsedV2.meta_edition_year || '',
            meta_pages: parsedV2.meta_pages || '',
            meta_chapters: parsedV2.meta_chapters || '',
            meta_toolkit_note: parsedV2.meta_toolkit_note || '',

            intro_eyebrow: parsedV2.intro_eyebrow || '',
            intro_lead: parsedV2.intro_lead || (typeof prod.why_this_book_matters === 'string' && !prod.why_this_book_matters.startsWith('{') ? prod.why_this_book_matters : ''),
            intro_highlight: parsedV2.intro_highlight || '',
            intro_body: parsedV2.intro_body || '',

            sid_definition_quote: parsedV2.sid_definition_quote || '',
            sid_definition_full: parsedV2.sid_definition_full || '',
            sid_definition_citation: parsedV2.sid_definition_citation || '',

            system_1_desc: parsedV2.system_1_desc || '',
            system_2_desc: parsedV2.system_2_desc || '',
            system_3_desc: parsedV2.system_3_desc || '',
            system_4_desc: parsedV2.system_4_desc || '',
            loop_note: parsedV2.loop_note || '',
            offering_cards: Array.isArray(parsedV2.offering_cards) ? parsedV2.offering_cards : [],

            ask_sid_eyebrow: parsedV2.ask_sid_eyebrow || '',
            ask_sid_title: parsedV2.ask_sid_title || '',
            ask_sid_tagline: parsedV2.ask_sid_tagline || '',
            ask_sid_paragraphs: Array.isArray(parsedV2.ask_sid_paragraphs) ? parsedV2.ask_sid_paragraphs : [],
            ask_sid_link_text: parsedV2.ask_sid_link_text || '',
            ask_sid_link_url: parsedV2.ask_sid_link_url || '',
            ask_sid_disclaimer: parsedV2.ask_sid_disclaimer || '',
            ask_sid_bottom_quote: parsedV2.ask_sid_bottom_quote || '',
            ask_sid_questions: Array.isArray(parsedV2.ask_sid_questions) ? parsedV2.ask_sid_questions : [],

            who_its_for: safeArray(prod.who_its_for),
            what_not_paras: Array.isArray(parsedV2.what_not_paras) ? parsedV2.what_not_paras : [],
            what_not_conclusion: parsedV2.what_not_conclusion || '',

            editions_eyebrow: parsedV2.editions_eyebrow || '',
            editions_heading: parsedV2.editions_heading || '',
            access_options: safeArray(prod.access_options),
            editions_footnote: parsedV2.editions_footnote || '',

            about_book_eyebrow: parsedV2.about_book_eyebrow || '',
            about_book_title: parsedV2.about_book_title || '',
            about_book_summary: parsedV2.about_book_summary || '',
            about_author_eyebrow: parsedV2.about_author_eyebrow || '',
            author_photo: currentAuthorPhoto,
            author_bio: Array.isArray(parsedV2.author_bio) ? parsedV2.author_bio : (prod.author_note ? [prod.author_note] : []),

            cta_heading: parsedV2.cta_heading || '',
            cta_paragraphs: Array.isArray(parsedV2.cta_paragraphs) ? parsedV2.cta_paragraphs : [],
            cta_motto: parsedV2.cta_motto || '',

            faq: safeArray(prod.faq),
            related_learning: safeArray(prod.related_learning),
            related_frameworks: safeArray(prod.related_frameworks),
            related_blogs: safeArray(prod.related_blogs),
        });
        setModalOpen(true);
    }

    function handleCoverImageChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const MAX = 5 * 1024 * 1024;
        if (file.size > MAX) { toast.error(`Image too large (max 5MB)`); if (fileInputRef.current) fileInputRef.current.value = ''; return; }
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
        if (!validTypes.includes(file.type)) { toast.error('Invalid image type'); if (fileInputRef.current) fileInputRef.current.value = ''; return; }
        setCoverImageFile(file);
        setCoverImagePreview(URL.createObjectURL(file));
        toast.success(`Book Card Cover selected (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    }

    function handleRemoveSelectedFile() {
        setCoverImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        const fallback = editingProduct?.cover_image || '';
        setCoverImagePreview(fallback);
        setFormData(prev => ({ ...prev, cover_image: fallback }));
    }

    function handleHeroImageChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const MAX = 5 * 1024 * 1024;
        if (file.size > MAX) { toast.error('Image too large (max 5MB)'); if (heroFileInputRef.current) heroFileInputRef.current.value = ''; return; }
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
        if (!validTypes.includes(file.type)) { toast.error('Invalid image type'); if (heroFileInputRef.current) heroFileInputRef.current.value = ''; return; }
        setHeroImageFile(file);
        const reader = new FileReader();
        reader.onload = () => {
            setHeroImagePreview(reader.result);
            setFormData(p => ({ ...p, hero_image: reader.result }));
        };
        reader.readAsDataURL(file);
        toast.success(`Hero Showcase image selected (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    }

    function handleRemoveHeroImage() {
        setHeroImageFile(null);
        if (heroFileInputRef.current) heroFileInputRef.current.value = '';
        setHeroImagePreview('');
        setFormData(p => ({ ...p, hero_image: '' }));
    }

    function handleAuthorPhotoChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const MAX = 5 * 1024 * 1024;
        if (file.size > MAX) { toast.error('Image too large (max 5MB)'); if (authorFileInputRef.current) authorFileInputRef.current.value = ''; return; }
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
        if (!validTypes.includes(file.type)) { toast.error('Invalid image type'); if (authorFileInputRef.current) authorFileInputRef.current.value = ''; return; }
        setAuthorPhotoFile(file);
        const reader = new FileReader();
        reader.onload = () => {
            setAuthorPhotoPreview(reader.result);
            setFormData(p => ({ ...p, author_photo: reader.result }));
        };
        reader.readAsDataURL(file);
        toast.success(`Author Photo selected (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    }

    function handleRemoveAuthorPhoto() {
        setAuthorPhotoFile(null);
        if (authorFileInputRef.current) authorFileInputRef.current.value = '';
        setAuthorPhotoPreview('');
        setFormData(p => ({ ...p, author_photo: '' }));
    }

    function handleProductFileChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const MAX = 50 * 1024 * 1024;
        if (file.size > MAX) { toast.error(`File too large (max 50MB)`); if (productFileInputRef.current) productFileInputRef.current.value = ''; return; }
        setProductFile(file);
        const ext = file.name.split('.').pop()?.toUpperCase() || 'PDF';
        setFormData(prev => ({ ...prev, format: ext }));
        toast.success(`eBook File selected: ${file.name}`);
    }

    function handleRemoveProductFile() {
        setProductFile(null);
        if (productFileInputRef.current) productFileInputRef.current.value = '';
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!formData.title.trim()) { toast.error('Title is required'); return; }
        setSaving(true);
        try {
            const v2Payload = {
                hero_audience_tag: formData.hero_audience_tag,
                hero_title: formData.hero_title,
                hero_title_accent: formData.hero_title_accent,
                hero_subtitle: formData.hero_subtitle,
                hero_motto: formData.hero_motto,
                hero_image: formData.hero_image,
                hero_meta_info: formData.hero_meta_info,

                meta_edition_year: formData.meta_edition_year,
                meta_pages: formData.meta_pages,
                meta_chapters: formData.meta_chapters,
                meta_toolkit_note: formData.meta_toolkit_note,

                intro_eyebrow: formData.intro_eyebrow,
                intro_lead: formData.intro_lead,
                intro_highlight: formData.intro_highlight,
                intro_body: formData.intro_body,

                sid_definition_quote: formData.sid_definition_quote,
                sid_definition_full: formData.sid_definition_full,
                sid_definition_citation: formData.sid_definition_citation,

                system_1_desc: formData.system_1_desc,
                system_2_desc: formData.system_2_desc,
                system_3_desc: formData.system_3_desc,
                system_4_desc: formData.system_4_desc,
                loop_note: formData.loop_note,
                offering_cards: formData.offering_cards,

                ask_sid_eyebrow: formData.ask_sid_eyebrow,
                ask_sid_title: formData.ask_sid_title,
                ask_sid_tagline: formData.ask_sid_tagline,
                ask_sid_paragraphs: formData.ask_sid_paragraphs,
                ask_sid_link_text: formData.ask_sid_link_text,
                ask_sid_link_url: formData.ask_sid_link_url,
                ask_sid_disclaimer: formData.ask_sid_disclaimer,
                ask_sid_bottom_quote: formData.ask_sid_bottom_quote,
                ask_sid_questions: formData.ask_sid_questions,

                who_its_for: formData.who_its_for,
                what_not_paras: formData.what_not_paras,
                what_not_conclusion: formData.what_not_conclusion,

                editions_eyebrow: formData.editions_eyebrow,
                editions_heading: formData.editions_heading,
                editions_footnote: formData.editions_footnote,

                about_book_eyebrow: formData.about_book_eyebrow,
                about_book_title: formData.about_book_title,
                about_book_summary: formData.about_book_summary,
                about_author_eyebrow: formData.about_author_eyebrow,
                author_photo: formData.author_photo,
                author_bio: formData.author_bio,

                cta_heading: formData.cta_heading,
                cta_paragraphs: formData.cta_paragraphs,
                cta_motto: formData.cta_motto,
            };

            const serializedWhyMatters = JSON.stringify(v2Payload);
            const jsonFields = ['who_its_for', 'what_readers_will_learn', 'faq', 'related_learning', 'related_frameworks', 'related_blogs', 'access_options'];

            if (coverImageFile || productFile) {
                const fd = new FormData();
                if (coverImageFile) fd.append('cover_image', coverImageFile);
                if (productFile) fd.append('product_file', productFile);
                fd.append('title', formData.title);
                fd.append('subtitle', formData.subtitle || '');
                fd.append('slug', formData.slug || '');
                fd.append('sku', formData.sku);
                fd.append('product_type', formData.product_type || 'publication');
                fd.append('publication_status', formData.publication_status || 'available');
                fd.append('author', formData.author);
                fd.append('price', String(Number(formData.price) || 0));
                fd.append('currency', formData.currency || 'USD');
                fd.append('format', formData.format || 'PDF');
                fd.append('description', formData.description || '');
                fd.append('why_this_book_matters', serializedWhyMatters);
                fd.append('author_note', formData.sid_definition_quote || '');
                if (formData.file_path) fd.append('file_path', formData.file_path);
                fd.append('download_limit', String(Number(formData.download_limit) || 3));
                fd.append('download_expiry_hours', String(Number(formData.download_expiry_hours) || 72));
                fd.append('active', String(formData.active !== false));
                for (const f of jsonFields) fd.append(f, JSON.stringify(formData[f] || []));

                if (editingProduct) {
                    await apiRequest(`/products/${editingProduct.id}`, { method: 'PUT', body: fd });
                    toast.success('Publication updated');
                } else {
                    await apiRequest('/products', { method: 'POST', body: fd });
                    toast.success('Publication created');
                }
            } else {
                const payload = {
                    ...formData,
                    price: Number(formData.price) || 0,
                    download_limit: Number(formData.download_limit) || 3,
                    download_expiry_hours: Number(formData.download_expiry_hours) || 72,
                    why_this_book_matters: serializedWhyMatters,
                    description: formData.description || '',
                    author_note: formData.sid_definition_quote || '',
                };
                for (const f of jsonFields) {
                    payload[f] = Array.isArray(payload[f]) ? payload[f] : safeArray(payload[f]);
                }
                if (editingProduct) {
                    await apiRequest(`/products/${editingProduct.id}`, { method: 'PUT', body: JSON.stringify(payload) });
                    toast.success('Publication updated');
                } else {
                    await apiRequest('/products', { method: 'POST', body: JSON.stringify(payload) });
                    toast.success('Publication created');
                }
            }
            setModalOpen(false);
            fetchProducts();
        } catch (err) {
            toast.error(err.message || 'Failed to save publication');
            console.error(err);
        } finally {
            setSaving(false);
        }
    }

    async function toggleActive(prod) {
        try {
            await apiRequest(`/products/${prod.id}`, { method: 'PUT', body: JSON.stringify({ active: !prod.active }) });
            toast.success(prod.active ? 'Deactivated' : 'Activated');
            fetchProducts();
        } catch (err) { toast.error('Failed to update status'); }
    }

    async function handleDelete(prod) {
        if (!window.confirm(`Delete "${prod.title}"?`)) return;
        try {
            await apiRequest(`/products/${prod.id}`, { method: 'DELETE' });
            toast.success('Deleted');
            fetchProducts();
        } catch (err) { toast.error('Failed to delete'); }
    }

    const statusColors = {
        available: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Available' },
        coming_soon: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Coming Soon' },
        draft: { bg: 'rgba(99,102,241,0.15)', color: '#818cf8', label: 'Draft' },
        archived: { bg: 'rgba(107,114,128,0.15)', color: '#6b7280', label: 'Archived' },
    };

    const TABS = [
        { id: 'book', label: '1. Book Card & Catalog', icon: HiOutlineBookOpen },
        { id: 'hero', label: '2. Hero Section', icon: HiOutlinePhotograph },
        { id: 'intro', label: '3. Introduction', icon: HiOutlineSparkles },
        { id: 'definition', label: '4. SID Definition', icon: HiOutlineTag },
        { id: 'systems', label: '5. 4 Systems & Offers', icon: HiOutlineSparkles },
        { id: 'asksid', label: '6. Meet Ask SID', icon: HiOutlineSparkles },
        { id: 'audience', label: '7. Audience & Scope', icon: HiOutlineUsers },
        { id: 'editions', label: '8. Editions & Pricing', icon: HiOutlineCurrencyDollar },
        { id: 'author', label: '9. About Book & Author', icon: HiOutlineUser },
        { id: 'cta', label: '10. Final Call to Action', icon: HiOutlineSparkles },
    ];

    return (
        <div className="page">
            <div className="page__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page__title">Publications & Landing Page Management</h1>
                    <p className="page__subtitle">Manage Marketing Reclassified and publications according to the V.2 structure.</p>
                </div>
                <button onClick={openCreateModal} className="btn btn--primary" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, fontWeight: 600 }}>
                    <HiOutlinePlus size={18} /> Add Publication
                </button>
            </div>

            {loading ? <div className="page-loading"><div className="spinner" /></div> : (
                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Cover</th>
                                <th>Title & Slug</th>
                                <th>Status</th>
                                <th>Price</th>
                                <th>Type</th>
                                <th>Active</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((p) => {
                                const sc = statusColors[p.publication_status] || statusColors.available;
                                return (
                                    <tr key={p.id}>
                                        <td>
                                            <img
                                                src={p.cover_image || '/assets/images/img/book1.webp'}
                                                alt={p.title}
                                                style={{ width: 44, height: 58, objectFit: 'cover', borderRadius: 6 }}
                                            />
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: '#f3f4f6' }}>{p.title}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#818cf8', marginTop: 2 }}>/publications/{p.slug}</div>
                                        </td>
                                        <td>
                                            <span style={{ background: sc.bg, color: sc.color, padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                                                {sc.label}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 600, color: '#10b981' }}>
                                            {p.currency || 'USD'} {Number(p.price).toFixed(2)}
                                        </td>
                                        <td style={{ fontSize: '0.8rem', color: '#9ca3af', textTransform: 'capitalize' }}>
                                            {p.product_type || 'publication'}
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                onClick={() => toggleActive(p)}
                                                style={{
                                                    background: p.active !== false ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                                                    color: p.active !== false ? '#10b981' : '#f87171',
                                                    border: 'none',
                                                    borderRadius: 4,
                                                    padding: '3px 8px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {p.active !== false ? 'Active' : 'Disabled'}
                                            </button>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button
                                                    onClick={() => openEditModal(p)}
                                                    style={iconBtnStyle('#818cf8')}
                                                    title="Edit Publication"
                                                >
                                                    <HiOutlinePencil size={15} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(p)}
                                                    style={iconBtnStyle('#ef4444')}
                                                    title="Delete"
                                                >
                                                    <HiOutlineTrash size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ─── Publication V.2 Editor Modal ─── */}
            {modalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '20px', overflowY: 'auto' }}>
                    <div style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: '24px 28px', maxWidth: 840, width: '100%', marginBottom: 40, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div>
                                <h2 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                                    {editingProduct ? 'Edit Publication (V.2 Structure)' : 'Add New Publication (V.2 Structure)'}
                                </h2>
                                <p style={{ color: '#818cf8', fontSize: '0.75rem', margin: '4px 0 0' }}>
                                    Book Card and Hero Section are completely distinct. Rich placeholders guide each section.
                                </p>
                            </div>
                            <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><HiOutlineX size={22} /></button>
                        </div>

                        {/* Navigation Tabs Bar */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
                            {TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        background: activeTab === tab.id ? '#6366f1' : 'rgba(255,255,255,0.06)',
                                        color: activeTab === tab.id ? '#ffffff' : '#9ca3af',
                                        border: 'none',
                                        borderRadius: 6,
                                        padding: '7px 12px',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                            {/* ── TAB 1: BOOK CARD & CATALOG ── */}
                            {activeTab === 'book' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#c7d2fe' }}>
                                            ℹ️ <strong>Book Card & Catalog Info:</strong> Configures the formal book listing card on the /publications page and catalog card summary.
                                        </p>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <div>
                                            <label style={{ ...labelStyle, color: '#f87171' }}>Book Title *</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.title}
                                                onChange={e => {
                                                    const title = e.target.value;
                                                    setFormData(p => ({
                                                        ...p,
                                                        title,
                                                        slug: p.slug || !editingProduct ? slugify(title) : p.slug
                                                    }));
                                                }}
                                                style={inputStyle}
                                                placeholder="e.g. Marketing Reclassified: A Principle-First Approach"
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Subtitle</label>
                                            <input
                                                type="text"
                                                value={formData.subtitle}
                                                onChange={e => setFormData(p => ({ ...p, subtitle: e.target.value }))}
                                                style={inputStyle}
                                                placeholder="e.g. A Principle-First Approach"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Card Description (Catalog Listing)</label>
                                        <textarea
                                            rows={3}
                                            value={formData.description}
                                            onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                                            style={{ ...inputStyle, resize: 'vertical' }}
                                            placeholder="e.g. From transaction to human progress. Marketing Reclassified challenges the narrow view of marketing as promotion, advertising, selling, or short-term campaign activity."
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                        <div>
                                            <label style={labelStyle}>URL Slug *</label>
                                            <input
                                                type="text"
                                                value={formData.slug}
                                                onChange={e => setFormData(p => ({ ...p, slug: slugify(e.target.value) }))}
                                                style={inputStyle}
                                                placeholder="e.g. marketing-reclassified"
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Publication Status</label>
                                            <select
                                                value={formData.publication_status}
                                                onChange={e => setFormData(p => ({ ...p, publication_status: e.target.value }))}
                                                style={selectStyle}
                                            >
                                                <option value="available">Available</option>
                                                <option value="coming_soon">Coming Soon</option>
                                                <option value="draft">Draft</option>
                                                <option value="archived">Archived</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Default Price (USD)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.price}
                                                onChange={e => setFormData(p => ({ ...p, price: e.target.value }))}
                                                style={inputStyle}
                                                placeholder="e.g. 49.99"
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                        <div>
                                            <label style={labelStyle}>Author</label>
                                            <input
                                                type="text"
                                                value={formData.author}
                                                onChange={e => setFormData(p => ({ ...p, author: e.target.value }))}
                                                style={inputStyle}
                                                placeholder="e.g. M. Q. Siddiqui"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ ...labelStyle, color: '#f59e0b' }}>Book Code / Publication SKU *</label>
                                            <input
                                                type="text"
                                                value={formData.sku}
                                                onChange={e => setFormData(p => ({ ...p, sku: e.target.value }))}
                                                style={inputStyle}
                                                placeholder="e.g. PROD-MR-01"
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Currency</label>
                                            <select
                                                value={formData.currency}
                                                onChange={e => setFormData(p => ({ ...p, currency: e.target.value }))}
                                                style={selectStyle}
                                            >
                                                <option value="USD">USD</option>
                                                <option value="AED">AED</option>
                                                <option value="EUR">EUR</option>
                                                <option value="GBP">GBP</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Book Card Cover Thumbnail */}
                                    <div>
                                        <label style={labelStyle}>Book Card Cover Thumbnail</label>
                                        <div style={{ border: '1.5px dashed rgba(167,139,250,0.3)', borderRadius: 10, padding: 12, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ width: 64, height: 86, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: '#161622', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                <img src={coverImagePreview || '/assets/images/img/book1.webp'} alt="Card cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.src = '/assets/images/img/book1.webp'; }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCoverImageChange} style={{ display: 'none' }} />
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    <button type="button" onClick={() => fileInputRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                                                        <HiOutlineUpload size={14} /> {coverImageFile ? 'Change Card Cover' : 'Upload Card Cover'}
                                                    </button>
                                                    {coverImageFile && (
                                                        <button type="button" onClick={handleRemoveSelectedFile} style={{ padding: '6px 9px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 6, color: '#f87171', fontSize: '0.73rem', cursor: 'pointer' }}>
                                                            Clear
                                                        </button>
                                                    )}
                                                </div>
                                                <p style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 5 }}>
                                                    {coverImageFile ? `✓ ${coverImageFile.name}` : formData.cover_image ? `Current: ${formData.cover_image}` : 'Used for the publications catalog card (e.g. /assets/images/img/book1.webp)'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── TAB 2: HERO SECTION ── */}
                            {activeTab === 'hero' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div style={{ background: 'rgba(163,25,47,0.1)', border: '1px solid rgba(163,25,47,0.3)', borderRadius: 8, padding: '10px 14px' }}>
                                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#F2C6CD' }}>
                                            🎯 <strong>Landing Page Hero Section:</strong> Dedicated content and showcase cover displayed on the dark navy Hero banner at the top of the V.2 landing page.
                                        </p>
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Hero Audience Eyebrow Tag</label>
                                        <input
                                            type="text"
                                            value={formData.hero_audience_tag}
                                            onChange={e => setFormData(p => ({ ...p, hero_audience_tag: e.target.value }))}
                                            style={inputStyle}
                                            placeholder="e.g. FOR BOARDS · CEOs · CMOs · CFOs"
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <div>
                                            <label style={labelStyle}>Hero Main Title</label>
                                            <input
                                                type="text"
                                                value={formData.hero_title}
                                                onChange={e => setFormData(p => ({ ...p, hero_title: e.target.value }))}
                                                style={inputStyle}
                                                placeholder="e.g. MARKETING"
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Hero Accent Title (Pink/Crimson Highlight)</label>
                                            <input
                                                type="text"
                                                value={formData.hero_title_accent}
                                                onChange={e => setFormData(p => ({ ...p, hero_title_accent: e.target.value }))}
                                                style={inputStyle}
                                                placeholder="e.g. RECLASSIFIED"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Hero Subtitle</label>
                                        <input
                                            type="text"
                                            value={formData.hero_subtitle}
                                            onChange={e => setFormData(p => ({ ...p, hero_subtitle: e.target.value }))}
                                            style={inputStyle}
                                            placeholder="e.g. From Promotion to Governed Strategic Intelligence"
                                        />
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Hero Strategic Hook / Motto</label>
                                        <input
                                            type="text"
                                            value={formData.hero_motto}
                                            onChange={e => setFormData(p => ({ ...p, hero_motto: e.target.value }))}
                                            style={inputStyle}
                                            placeholder="e.g. Decide with the market, not about it."
                                        />
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Hero Meta Info Line</label>
                                        <input
                                            type="text"
                                            value={formData.hero_meta_info}
                                            onChange={e => setFormData(p => ({ ...p, hero_meta_info: e.target.value }))}
                                            style={inputStyle}
                                            placeholder="e.g. Digital edition, 2026 · 14 chapters · 205 pages"
                                        />
                                    </div>

                                    {/* Dedicated Hero Showcase Image */}
                                    <div>
                                        <label style={{ ...labelStyle, color: '#f87171' }}>Hero Showcase Cover Image (Large 3D Book)</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <input
                                                type="text"
                                                value={formData.hero_image}
                                                onChange={e => {
                                                    setFormData(p => ({ ...p, hero_image: e.target.value }));
                                                    setHeroImagePreview(e.target.value);
                                                }}
                                                style={inputStyle}
                                                placeholder="e.g. /assets/images/img/v2-book-cover.jpeg or URL"
                                            />
                                            <div style={{ border: '1.5px dashed rgba(244,63,94,0.3)', borderRadius: 10, padding: 12, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{ width: 70, height: 98, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: '#161622', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                    <img
                                                        src={heroImagePreview || formData.hero_image || '/assets/images/img/v2-book-cover.jpeg'}
                                                        alt="Hero cover preview"
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        onError={e => { e.target.src = '/assets/images/img/v2-book-cover.jpeg'; }}
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <input ref={heroFileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleHeroImageChange} style={{ display: 'none' }} />
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                        <button type="button" onClick={() => heroFileInputRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                                                            <HiOutlineUpload size={14} /> Upload Hero Cover
                                                        </button>
                                                        {(heroImageFile || formData.hero_image) && (
                                                            <button type="button" onClick={handleRemoveHeroImage} style={{ padding: '6px 9px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 6, color: '#f87171', fontSize: '0.73rem', cursor: 'pointer' }}>
                                                                Clear
                                                            </button>
                                                        )}
                                                    </div>
                                                    <p style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 5 }}>
                                                        {heroImageFile ? `✓ ${heroImageFile.name}` : 'Upload or type URL for the hero showcase book display'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── TAB 3: INTRODUCTION & THESIS ── */}
                            {activeTab === 'intro' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div>
                                        <label style={labelStyle}>Section Eyebrow</label>
                                        <input value={formData.intro_eyebrow} onChange={e => setFormData(p => ({ ...p, intro_eyebrow: e.target.value }))} style={inputStyle} placeholder="e.g. INTRODUCTION" />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Intro Lead Paragraph (Core Thesis)</label>
                                        <textarea rows={3} value={formData.intro_lead} onChange={e => setFormData(p => ({ ...p, intro_lead: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} placeholder="e.g. Most organizations treat marketing as promotion: campaigns, channels and activity metrics, brought in after the important decisions are already made..." />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Bold Highlight Statement</label>
                                        <textarea rows={2} value={formData.intro_highlight} onChange={e => setFormData(p => ({ ...p, intro_highlight: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} placeholder="e.g. Marketing Reclassified argues that the problem is not poor marketing. It is misplaced marketing." />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Intro Body Paragraph</label>
                                        <textarea rows={3} value={formData.intro_body} onChange={e => setFormData(p => ({ ...p, intro_body: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} placeholder="e.g. The book puts marketing back where it belongs: upstream, as the system that brings market reality into the decisions that shape what an organization offers, prices, promises and scales." />
                                    </div>
                                </div>
                            )}

                            {/* ── TAB 4: SID DEFINITION ── */}
                            {activeTab === 'definition' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div>
                                        <label style={labelStyle}>SID Definition Pull-Quote</label>
                                        <textarea rows={3} value={formData.sid_definition_quote} onChange={e => setFormData(p => ({ ...p, sid_definition_quote: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} placeholder="e.g. Marketing is how an organization senses, shapes, scales and learns, so leadership decides with the market, not about it." />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Full Definition Statement</label>
                                        <textarea rows={3} value={formData.sid_definition_full} onChange={e => setFormData(p => ({ ...p, sid_definition_full: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} placeholder="e.g. “Marketing is the governed strategic intelligence system through which an organization senses market reality, shapes value customers recognize, scales aligned value so it is known and chosen, and learns from lived experience...”" />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Citation / Book Source Reference</label>
                                        <input value={formData.sid_definition_citation} onChange={e => setFormData(p => ({ ...p, sid_definition_citation: e.target.value }))} style={inputStyle} placeholder="e.g. The Sid definition of Marketing — Chapter 1" />
                                    </div>
                                </div>
                            )}

                            {/* ── TAB 5: 4 SYSTEMS & OFFERINGS ── */}
                            {activeTab === 'systems' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <div>
                                            <label style={{ ...labelStyle, color: '#60a5fa' }}>01. SENSE System Description</label>
                                            <textarea rows={2} value={formData.system_1_desc} onChange={e => setFormData(p => ({ ...p, system_1_desc: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} placeholder="e.g. Brings market reality into organizational decisions." />
                                        </div>
                                        <div>
                                            <label style={{ ...labelStyle, color: '#f59e0b' }}>02. SHAPE System Description</label>
                                            <textarea rows={2} value={formData.system_2_desc} onChange={e => setFormData(p => ({ ...p, system_2_desc: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} placeholder="e.g. Turns market understanding into value choices." />
                                        </div>
                                        <div>
                                            <label style={{ ...labelStyle, color: '#10b981' }}>03. SCALE System Description</label>
                                            <textarea rows={2} value={formData.system_3_desc} onChange={e => setFormData(p => ({ ...p, system_3_desc: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} placeholder="e.g. Makes aligned value known and chosen." />
                                        </div>
                                        <div>
                                            <label style={{ ...labelStyle, color: '#a78bfa' }}>04. EXPERIENCE System Description</label>
                                            <textarea rows={2} value={formData.system_4_desc} onChange={e => setFormData(p => ({ ...p, system_4_desc: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} placeholder="e.g. Tests the promise against what customers actually receive." />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Loop / Feedback Note</label>
                                        <input value={formData.loop_note} onChange={e => setFormData(p => ({ ...p, loop_note: e.target.value }))} style={inputStyle} placeholder="e.g. Experience feeds back into Sense, so the loop keeps learning." />
                                    </div>

                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 14 }}>
                                        <label style={{ ...labelStyle, color: '#818cf8', fontWeight: 700 }}>What the Book Offers (Feature Cards)</label>
                                        <OfferingsCardsManager cards={formData.offering_cards} onChange={cards => setFormData(p => ({ ...p, offering_cards: cards }))} />
                                    </div>
                                </div>
                            )}

                            {/* ── TAB 6: ASK SID ── */}
                            {activeTab === 'asksid' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div style={{ background: 'rgba(19,41,75,0.6)', border: '1px solid rgba(242,198,205,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#F2C6CD' }}>
                                            🤖 <strong>Section 5 (Ask SID):</strong> Configures the AI Book Companion section, explanatory paragraphs, interactive box widget, and bottom hook.
                                        </p>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                                        <div>
                                            <label style={labelStyle}>Section Eyebrow</label>
                                            <input value={formData.ask_sid_eyebrow} onChange={e => setFormData(p => ({ ...p, ask_sid_eyebrow: e.target.value }))} style={inputStyle} placeholder="e.g. NEW · AI BOOK COMPANION" />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Section Title</label>
                                            <input value={formData.ask_sid_title} onChange={e => setFormData(p => ({ ...p, ask_sid_title: e.target.value }))} style={inputStyle} placeholder="e.g. Meet Ask SID: Your AI-Powered Book Companion" />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Tagline / Hook</label>
                                        <input value={formData.ask_sid_tagline} onChange={e => setFormData(p => ({ ...p, ask_sid_tagline: e.target.value }))} style={inputStyle} placeholder="e.g. Reading introduces the ideas. Ask SID helps you explore them." />
                                    </div>

                                    {/* Explanatory Paragraphs */}
                                    <RepeatableStringList
                                        label="Ask SID Explanatory Paragraphs"
                                        items={formData.ask_sid_paragraphs}
                                        onChange={list => setFormData(p => ({ ...p, ask_sid_paragraphs: list }))}
                                        placeholder="e.g. Ask SID is an AI-powered companion to Marketing Reclassified, designed to help readers understand its principles..."
                                        hint="Appears on the left column under the tagline to explain capabilities, boundaries, and pricing inclusion."
                                    />

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <div>
                                            <label style={labelStyle}>Learn More Link Text</label>
                                            <input value={formData.ask_sid_link_text} onChange={e => setFormData(p => ({ ...p, ask_sid_link_text: e.target.value }))} style={inputStyle} placeholder="e.g. Learn more about Ask SID" />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Learn More Target URL</label>
                                            <input value={formData.ask_sid_link_url} onChange={e => setFormData(p => ({ ...p, ask_sid_link_url: e.target.value }))} style={inputStyle} placeholder="e.g. /ask-sid or #asksid-details" />
                                        </div>
                                    </div>

                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 14 }}>
                                        <label style={{ ...labelStyle, color: '#818cf8', fontWeight: 700 }}>Interactive Widget Box Details</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 6 }}>
                                            <div>
                                                <label style={labelStyle}>Widget Disclaimer / Access Note</label>
                                                <input value={formData.ask_sid_disclaimer} onChange={e => setFormData(p => ({ ...p, ask_sid_disclaimer: e.target.value }))} style={inputStyle} placeholder="e.g. Available with the Digital Companion Edition." />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Section Bottom Tagline Quote</label>
                                                <input value={formData.ask_sid_bottom_quote} onChange={e => setFormData(p => ({ ...p, ask_sid_bottom_quote: e.target.value }))} style={inputStyle} placeholder="e.g. Read the book. Question the ideas. Explore their application." />
                                            </div>
                                        </div>
                                    </div>

                                    <RepeatableStringList
                                        label="Sample Questions / Prompts for Ask SID"
                                        items={formData.ask_sid_questions}
                                        onChange={list => setFormData(p => ({ ...p, ask_sid_questions: list }))}
                                        placeholder="e.g. What is a Measurement Spine?"
                                        hint="Clickable prompt chips displayed inside the interactive Ask SID widget box."
                                    />
                                </div>
                            )}

                            {/* ── TAB 7: AUDIENCE & SCOPE ── */}
                            {activeTab === 'audience' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <RepeatableStringList
                                        label="Who Is This Book For? (Audience Checklist)"
                                        items={formData.who_its_for}
                                        onChange={list => setFormData(p => ({ ...p, who_its_for: list }))}
                                        placeholder="e.g. Board members, CEOs, business owners, CMOs, and CFOs who want marketing to improve decisions..."
                                        hint="Each item renders with a crimson checkmark on the public page."
                                    />

                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 14 }}>
                                        <label style={{ ...labelStyle, color: '#818cf8', fontWeight: 700 }}>What This Book Is Not</label>
                                        <RepeatableStringList
                                            label="Explanatory Paragraphs"
                                            items={formData.what_not_paras}
                                            onChange={list => setFormData(p => ({ ...p, what_not_paras: list }))}
                                            placeholder="e.g. Marketing Reclassified is not a conventional marketing textbook or a collection of promotional tactics."
                                        />
                                        <div style={{ marginTop: 10 }}>
                                            <label style={labelStyle}>Conclusion Statement (Bold Highlight)</label>
                                            <textarea rows={2} value={formData.what_not_conclusion} onChange={e => setFormData(p => ({ ...p, what_not_conclusion: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} placeholder="e.g. The objective is not to replace marketing’s existing tools, but to reconsider the organizational purpose those tools are expected to serve." />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── TAB 8: EDITIONS & PRICING ── */}
                            {activeTab === 'editions' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#a7f3d0' }}>
                                            💳 <strong>Section 7 (Editions):</strong> Configure the purchase tier cards, price, feature bullet checklists (✓ included / ✗ excluded), and footer note.
                                        </p>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                                        <div>
                                            <label style={labelStyle}>Section Eyebrow</label>
                                            <input value={formData.editions_eyebrow} onChange={e => setFormData(p => ({ ...p, editions_eyebrow: e.target.value }))} style={inputStyle} placeholder="e.g. EDITIONS" />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Section Heading</label>
                                            <input value={formData.editions_heading} onChange={e => setFormData(p => ({ ...p, editions_heading: e.target.value }))} style={inputStyle} placeholder="e.g. Choose Your Edition" />
                                        </div>
                                    </div>

                                    <AccessOptionsManager
                                        items={formData.access_options}
                                        onChange={list => setFormData(p => ({ ...p, access_options: list }))}
                                    />

                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 14, marginTop: 8 }}>
                                        <label style={labelStyle}>Editions Footnote Notice</label>
                                        <textarea rows={2} value={formData.editions_footnote} onChange={e => setFormData(p => ({ ...p, editions_footnote: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} placeholder="e.g. Both editions require registration and successful payment. Digital access and downloads are managed through secure customer accounts." />
                                    </div>
                                </div>
                            )}

                            {/* ── TAB 9: ABOUT BOOK & AUTHOR ── */}
                            {activeTab === 'author' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#c7d2fe' }}>
                                            📖 <strong>Section 8 Details:</strong> Configures Section 8 ("ABOUT THE BOOK") stats & summary, and Section 8 ("ABOUT THE AUTHOR") profile photo & bio.
                                        </p>
                                    </div>

                                    {/* About The Book Column Settings */}
                                    <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14, background: 'rgba(255,255,255,0.02)' }}>
                                        <label style={{ ...labelStyle, color: '#818cf8', fontWeight: 700, marginBottom: 10 }}>About The Book Column (Left)</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
                                            <div>
                                                <label style={labelStyle}>Eyebrow</label>
                                                <input value={formData.about_book_eyebrow} onChange={e => setFormData(p => ({ ...p, about_book_eyebrow: e.target.value }))} style={inputStyle} placeholder="e.g. ABOUT THE BOOK" />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Title</label>
                                                <input value={formData.about_book_title} onChange={e => setFormData(p => ({ ...p, about_book_title: e.target.value }))} style={inputStyle} placeholder="e.g. Marketing Reclassified: From Promotion to Governed Strategic Intelligence" />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                                            <div>
                                                <label style={labelStyle}>Edition Year</label>
                                                <input value={formData.meta_edition_year} onChange={e => setFormData(p => ({ ...p, meta_edition_year: e.target.value }))} style={inputStyle} placeholder="e.g. 2026" />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Pages</label>
                                                <input value={formData.meta_pages} onChange={e => setFormData(p => ({ ...p, meta_pages: e.target.value }))} style={inputStyle} placeholder="e.g. 205" />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Chapters</label>
                                                <input value={formData.meta_chapters} onChange={e => setFormData(p => ({ ...p, meta_chapters: e.target.value }))} style={inputStyle} placeholder="e.g. 14" />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Toolkit Note</label>
                                                <input value={formData.meta_toolkit_note} onChange={e => setFormData(p => ({ ...p, meta_toolkit_note: e.target.value }))} style={inputStyle} placeholder="e.g. Toolkit, Glossary and full References" />
                                            </div>
                                        </div>

                                        <div>
                                            <label style={labelStyle}>Book Summary / Thesis (Below Stats Grid)</label>
                                            <textarea
                                                rows={2}
                                                value={formData.about_book_summary}
                                                onChange={e => setFormData(p => ({ ...p, about_book_summary: e.target.value }))}
                                                style={{ ...inputStyle, resize: 'vertical' }}
                                                placeholder="e.g. A principles-first examination of how marketing can move beyond promotion to become governed strategic intelligence that improves organizational decisions."
                                            />
                                        </div>
                                    </div>

                                    {/* About The Author Column Settings */}
                                    <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14, background: 'rgba(255,255,255,0.02)' }}>
                                        <label style={{ ...labelStyle, color: '#f87171', fontWeight: 700, marginBottom: 10 }}>About The Author Column (Right)</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
                                            <div>
                                                <label style={labelStyle}>Eyebrow</label>
                                                <input value={formData.about_author_eyebrow} onChange={e => setFormData(p => ({ ...p, about_author_eyebrow: e.target.value }))} style={inputStyle} placeholder="e.g. ABOUT THE AUTHOR" />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Author Name</label>
                                                <input value={formData.author} onChange={e => setFormData(p => ({ ...p, author: e.target.value }))} style={inputStyle} placeholder="e.g. M. Q. Siddiqui" />
                                            </div>
                                        </div>

                                        {/* Author Photo Upload / URL */}
                                        <div style={{ marginBottom: 12 }}>
                                            <label style={labelStyle}>Author Headshot Photo</label>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <input
                                                    type="text"
                                                    value={formData.author_photo}
                                                    onChange={e => {
                                                        setFormData(p => ({ ...p, author_photo: e.target.value }));
                                                        setAuthorPhotoPreview(e.target.value);
                                                    }}
                                                    style={inputStyle}
                                                    placeholder="e.g. /assets/images/img/v2-author-photo.png or URL"
                                                />
                                                <div style={{ border: '1.5px dashed rgba(248,113,113,0.3)', borderRadius: 10, padding: 12, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 14 }}>
                                                    <div style={{ width: 68, height: 68, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', background: '#161622', border: '2px solid rgba(255,255,255,0.2)' }}>
                                                        <img
                                                            src={authorPhotoPreview || formData.author_photo || '/assets/images/img/v2-author-photo.png'}
                                                            alt="Author preview"
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            onError={e => { e.target.src = '/assets/images/img/v2-author-photo.png'; }}
                                                        />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <input ref={authorFileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAuthorPhotoChange} style={{ display: 'none' }} />
                                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                            <button type="button" onClick={() => authorFileInputRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                                                                <HiOutlineUpload size={14} /> Upload Author Photo
                                                            </button>
                                                            {(authorPhotoFile || formData.author_photo) && (
                                                                <button type="button" onClick={handleRemoveAuthorPhoto} style={{ padding: '6px 9px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 6, color: '#f87171', fontSize: '0.73rem', cursor: 'pointer' }}>
                                                                    Clear
                                                                </button>
                                                            )}
                                                        </div>
                                                        <p style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 5 }}>
                                                            {authorPhotoFile ? `✓ ${authorPhotoFile.name}` : 'Circular photo shown beside author bio in Section 8'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <RepeatableStringList
                                            label="Author Bio Paragraphs"
                                            items={formData.author_bio}
                                            onChange={list => setFormData(p => ({ ...p, author_bio: list }))}
                                            placeholder="e.g. M. Q. Siddiqui is the Founder of Siddiqui.digital and the originator of the Sid Philosophy and the Sid Approach."
                                            hint="Each paragraph appears under the author's name in Section 8."
                                        />
                                    </div>

                                    {/* eBook File Upload */}
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 14 }}>
                                        <label style={{ ...labelStyle, color: '#10b981', fontWeight: 700 }}>
                                            <HiOutlineDocumentText size={15} /> Product File / eBook (PDF / EPUB)
                                        </label>
                                        <div style={{ border: '1.5px dashed rgba(16,185,129,0.3)', borderRadius: 8, padding: 12, background: '#1a1a2b', marginTop: 6 }}>
                                            <input ref={productFileInputRef} type="file" accept=".pdf,.epub,.mobi,.zip,.docx" onChange={handleProductFileChange} style={{ display: 'none' }} />
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <button type="button" onClick={() => productFileInputRef.current?.click()} style={{ padding: '7px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                                                    {productFile ? 'Change eBook File' : 'Upload eBook File'}
                                                </button>
                                                {productFile && (
                                                    <button type="button" onClick={handleRemoveProductFile} style={{ padding: '6px 9px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 6, color: '#f87171', fontSize: '0.73rem', cursor: 'pointer' }}>
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 6 }}>
                                                {productFile ? `✓ ${productFile.name}` : formData.file_path ? `📄 Current: ${formData.file_path.split('/').pop()}` : 'Supports PDF, EPUB up to 50MB'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── TAB 10: FINAL CALL TO ACTION ── */}
                            {activeTab === 'cta' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div>
                                        <label style={labelStyle}>Final CTA Heading</label>
                                        <input value={formData.cta_heading} onChange={e => setFormData(p => ({ ...p, cta_heading: e.target.value }))} style={inputStyle} placeholder="e.g. Rethink Where Marketing Belongs" />
                                    </div>
                                    <RepeatableStringList
                                        label="Call to Action Paragraphs"
                                        items={formData.cta_paragraphs}
                                        onChange={list => setFormData(p => ({ ...p, cta_paragraphs: list }))}
                                        placeholder="e.g. Marketing should not enter the conversation only after the important decisions have been made."
                                        hint="These paragraphs appear under the heading on the dark crimson banner."
                                    />
                                    <div>
                                        <label style={labelStyle}>CTA Motto / Sub-statement</label>
                                        <input value={formData.cta_motto} onChange={e => setFormData(p => ({ ...p, cta_motto: e.target.value }))} style={inputStyle} placeholder="e.g. Decide with the market, not about it." />
                                    </div>
                                </div>
                            )}

                            {/* Modal Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => setModalOpen(false)}
                                    style={{ padding: '10px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="btn btn--primary"
                                    style={{ padding: '10px 24px', borderRadius: 8, fontWeight: 700, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                >
                                    {saving ? 'Saving…' : editingProduct ? 'Save V.2 Publication' : 'Create V.2 Publication'}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Styles ────────────────────────────────────────────────────────── */
const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#9ca3af',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
};

const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    background: '#141420',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#f3f4f6',
    fontSize: '0.85rem',
    outline: 'none',
    boxSizing: 'border-box'
};

const selectStyle = {
    ...inputStyle,
    cursor: 'pointer'
};

const addBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    background: 'rgba(99,102,241,0.2)',
    color: '#818cf8',
    border: '1px solid rgba(99,102,241,0.4)',
    borderRadius: 6,
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer'
};

function iconBtnStyle(color) {
    return {
        padding: '5px 7px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 5,
        color,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
    };
}
