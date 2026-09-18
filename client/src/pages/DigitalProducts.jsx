import { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../config/api';
import toast from 'react-hot-toast';
import {
    HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX,
    HiOutlineUpload, HiOutlinePhotograph, HiOutlineDocumentText,
    HiOutlineChevronUp, HiOutlineChevronDown, HiOutlineCheck,
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

/* ─── Reusable repeatable-list component ──────────────────────────── */
function RepeatableStringList({ label, items, onChange, placeholder = 'Add item…', hint = '' }) {
    const [draft, setDraft] = useState('');
    const [editIdx, setEditIdx] = useState(null);
    const [editVal, setEditVal] = useState('');

    function add() {
        const v = draft.trim();
        if (!v) return;
        onChange([...items, v]);
        setDraft('');
    }

    function remove(i) { onChange(items.filter((_, idx) => idx !== i)); }
    function moveUp(i) {
        if (i === 0) return;
        const a = [...items]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a);
    }
    function moveDown(i) {
        if (i === items.length - 1) return;
        const a = [...items]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; onChange(a);
    }
    function startEdit(i) { setEditIdx(i); setEditVal(items[i]); }
    function saveEdit(i) {
        const v = editVal.trim();
        if (!v) return;
        const a = [...items]; a[i] = v; onChange(a);
        setEditIdx(null); setEditVal('');
    }

    return (
        <div>
            <label style={labelStyle}>{label}</label>
            {hint && <p style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: 6 }}>{hint}</p>}
            {items.map((item, i) => (
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

/* ─── FAQ Manager ──────────────────────────────────────────────────── */
function FaqManager({ items, onChange }) {
    const [editIdx, setEditIdx] = useState(null);
    const [draft, setDraft] = useState({ question: '', answer: '' });

    function add() {
        if (!draft.question.trim() || !draft.answer.trim()) {
            toast.error('Both question and answer are required');
            return;
        }
        onChange([...items, { question: draft.question.trim(), answer: draft.answer.trim() }]);
        setDraft({ question: '', answer: '' });
    }

    function remove(i) { onChange(items.filter((_, idx) => idx !== i)); }
    function moveUp(i) {
        if (i === 0) return;
        const a = [...items]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a);
    }
    function moveDown(i) {
        if (i === items.length - 1) return;
        const a = [...items]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; onChange(a);
    }
    function startEdit(i) { setEditIdx(i); setDraft({ ...items[i] }); }
    function saveEdit(i) {
        if (!draft.question.trim() || !draft.answer.trim()) return;
        const a = [...items]; a[i] = { question: draft.question.trim(), answer: draft.answer.trim() };
        onChange(a); setEditIdx(null); setDraft({ question: '', answer: '' });
    }

    return (
        <div>
            <label style={labelStyle}>FAQ Items</label>
            {items.map((item, i) => (
                <div key={i} style={{ background: '#1a1a2b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                    {editIdx === i ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <input
                                placeholder="Question"
                                value={draft.question}
                                onChange={e => setDraft(p => ({ ...p, question: e.target.value }))}
                                style={inputStyle}
                                autoFocus
                            />
                            <textarea
                                placeholder="Answer"
                                rows={3}
                                value={draft.answer}
                                onChange={e => setDraft(p => ({ ...p, answer: e.target.value }))}
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button type="button" onClick={() => saveEdit(i)} style={addBtnStyle}><HiOutlineCheck size={13} /> Save</button>
                                <button type="button" onClick={() => setEditIdx(null)} style={{ ...addBtnStyle, background: 'rgba(107,114,128,0.2)' }}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                                <p style={{ color: '#e5e7eb', fontWeight: 600, fontSize: '0.83rem', marginBottom: 2 }}>Q: {item.question}</p>
                                <p style={{ color: '#9ca3af', fontSize: '0.78rem', lineHeight: 1.4 }}>A: {item.answer}</p>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                <button type="button" onClick={() => moveUp(i)} style={iconBtnStyle('#a1a1aa')} title="Move up"><HiOutlineChevronUp size={13} /></button>
                                <button type="button" onClick={() => moveDown(i)} style={iconBtnStyle('#a1a1aa')} title="Move down"><HiOutlineChevronDown size={13} /></button>
                                <button type="button" onClick={() => startEdit(i)} style={iconBtnStyle('#818cf8')} title="Edit"><HiOutlinePencil size={13} /></button>
                                <button type="button" onClick={() => remove(i)} style={iconBtnStyle('#ef4444')} title="Delete"><HiOutlineTrash size={13} /></button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
            <div style={{ background: '#1a1a2b', border: '1.5px dashed rgba(99,102,241,0.3)', borderRadius: 8, padding: '10px 12px', marginTop: 6 }}>
                <p style={{ fontSize: '0.78rem', color: '#818cf8', marginBottom: 6, fontWeight: 600 }}>Add New FAQ</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input placeholder="Question" value={draft.question} onChange={e => setDraft(p => ({ ...p, question: e.target.value }))} style={inputStyle} />
                    <textarea placeholder="Answer" rows={2} value={draft.answer} onChange={e => setDraft(p => ({ ...p, answer: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} />
                    <button type="button" onClick={add} style={{ ...addBtnStyle, alignSelf: 'flex-start' }}>
                        <HiOutlinePlus size={14} /> Add FAQ
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Access Options Manager ───────────────────────────────────────── */
const EMPTY_OPTION = { name: '', description: '', price: '', currency: 'USD', access_type: 'download', downloadable: true, cta_text: '', status: 'active', product_id: '' };

function AccessOptionsManager({ items, onChange }) {
    const [editIdx, setEditIdx] = useState(null);
    const [draft, setDraft] = useState(EMPTY_OPTION);

    function add() {
        if (!draft.name.trim()) { toast.error('Option name is required'); return; }
        onChange([...items, { ...draft, price: Number(draft.price) || 0 }]);
        setDraft(EMPTY_OPTION);
    }
    function remove(i) { onChange(items.filter((_, idx) => idx !== i)); }
    function startEdit(i) { setEditIdx(i); setDraft({ ...items[i] }); }
    function saveEdit(i) {
        const a = [...items]; a[i] = { ...draft, price: Number(draft.price) || 0 };
        onChange(a); setEditIdx(null); setDraft(EMPTY_OPTION);
    }
    function moveUp(i) {
        if (i === 0) return;
        const a = [...items]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a);
    }
    function moveDown(i) {
        if (i === items.length - 1) return;
        const a = [...items]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; onChange(a);
    }

    const OptionForm = ({ val, setVal, onSave, onCancel, saveLabel }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                    <label style={labelStyle}>Option Name *</label>
                    <input placeholder="e.g. Downloadable Professional Edition" value={val.name} onChange={e => setVal(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                    <label style={labelStyle}>CTA Text</label>
                    <input placeholder="e.g. Download Now — USD 49.99" value={val.cta_text} onChange={e => setVal(p => ({ ...p, cta_text: e.target.value }))} style={inputStyle} />
                </div>
            </div>
            <div>
                <label style={labelStyle}>Description</label>
                <textarea rows={2} value={val.description} onChange={e => setVal(p => ({ ...p, description: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                <div>
                    <label style={labelStyle}>Price</label>
                    <input type="number" step="0.01" value={val.price} onChange={e => setVal(p => ({ ...p, price: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                    <label style={labelStyle}>Currency</label>
                    <select value={val.currency} onChange={e => setVal(p => ({ ...p, currency: e.target.value }))} style={selectStyle}>
                        <option value="USD">USD</option>
                        <option value="AED">AED</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>Access Type</label>
                    <select value={val.access_type} onChange={e => setVal(p => ({ ...p, access_type: e.target.value, downloadable: e.target.value === 'download' }))} style={selectStyle}>
                        <option value="download">Downloadable</option>
                        <option value="online">Online Access</option>
                        <option value="companion">Companion Pack</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>Status</label>
                    <select value={val.status} onChange={e => setVal(p => ({ ...p, status: e.target.value }))} style={selectStyle}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="coming_soon">Coming Soon</option>
                    </select>
                </div>
            </div>
            <div>
                <label style={labelStyle}>Stripe Product / Price ID (optional)</label>
                <input placeholder="e.g. cff3798b-88bb-41af-8e2a-bc5f7a2a4239 or prod_xxx" value={val.product_id} onChange={e => setVal(p => ({ ...p, product_id: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                <button type="button" onClick={onSave} style={addBtnStyle}><HiOutlineCheck size={13} /> {saveLabel}</button>
                {onCancel && <button type="button" onClick={onCancel} style={{ ...addBtnStyle, background: 'rgba(107,114,128,0.2)' }}>Cancel</button>}
            </div>
        </div>
    );

    return (
        <div>
            <label style={labelStyle}>Access / Purchase Options</label>
            {items.map((opt, i) => (
                <div key={i} style={{ background: '#1a1a2b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                    {editIdx === i ? (
                        <OptionForm val={draft} setVal={setDraft} onSave={() => saveEdit(i)} onCancel={() => { setEditIdx(null); setDraft(EMPTY_OPTION); }} saveLabel="Save Option" />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                                <p style={{ color: '#e5e7eb', fontWeight: 600, fontSize: '0.85rem', marginBottom: 2 }}>{opt.name}</p>
                                <p style={{ color: '#10b981', fontSize: '0.8rem' }}>{opt.currency} {Number(opt.price).toFixed(2)} · {opt.access_type} · {opt.status}</p>
                                {opt.cta_text && <p style={{ color: '#818cf8', fontSize: '0.75rem' }}>CTA: {opt.cta_text}</p>}
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <button type="button" onClick={() => moveUp(i)} style={iconBtnStyle('#a1a1aa')}><HiOutlineChevronUp size={13} /></button>
                                <button type="button" onClick={() => moveDown(i)} style={iconBtnStyle('#a1a1aa')}><HiOutlineChevronDown size={13} /></button>
                                <button type="button" onClick={() => startEdit(i)} style={iconBtnStyle('#818cf8')}><HiOutlinePencil size={13} /></button>
                                <button type="button" onClick={() => remove(i)} style={iconBtnStyle('#ef4444')}><HiOutlineTrash size={13} /></button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
            <div style={{ background: '#1a1a2b', border: '1.5px dashed rgba(16,185,129,0.3)', borderRadius: 8, padding: '12px 14px', marginTop: 6 }}>
                <p style={{ fontSize: '0.78rem', color: '#10b981', marginBottom: 8, fontWeight: 600 }}>Add New Access Option</p>
                <OptionForm val={draft} setVal={setDraft} onSave={add} saveLabel="Add Option" />
            </div>
        </div>
    );
}

/* ─── Section Divider ──────────────────────────────────────────────── */
function SectionDivider({ title }) {
    return (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 18, marginTop: 6 }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#818cf8', marginBottom: 14 }}>{title}</p>
        </div>
    );
}

/* ─── Shared Styles ────────────────────────────────────────────────── */
const inputStyle = { width: '100%', padding: '9px 11px', background: '#28283d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', fontSize: '0.83rem', boxSizing: 'border-box' };
const selectStyle = { ...inputStyle };
const labelStyle = { display: 'block', fontSize: '0.78rem', color: '#a1a1aa', marginBottom: 4, fontWeight: 500 };
const iconBtnStyle = (color) => ({ background: 'transparent', border: 'none', color, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: 4, flexShrink: 0 });
const addBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' };

/* ─── Main Component ───────────────────────────────────────────────── */
export default function DigitalProducts() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [coverImageFile, setCoverImageFile] = useState(null);
    const [coverImagePreview, setCoverImagePreview] = useState('/assets/images/img/30.webp');
    const [productFile, setProductFile] = useState(null);
    const fileInputRef = useRef(null);
    const productFileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        title: '',
        subtitle: '',
        slug: '',
        sku: '',
        product_type: 'ebook',
        publication_status: 'available',
        author: 'M. Q. Siddiqui',
        price: '',
        currency: 'USD',
        format: 'PDF',
        description: '',
        cover_image: '/assets/images/img/30.webp',
        file_path: '',
        download_limit: 3,
        download_expiry_hours: 72,
        active: true,
        // Publication content
        why_this_book_matters: '',
        who_its_for: [],
        what_readers_will_learn: [],
        author_note: '',
        faq: [],
        related_learning: [],
        related_frameworks: [],
        related_blogs: [],
        access_options: [],
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
            product_type: 'ebook',
            publication_status: 'available',
            author: 'M. Q. Siddiqui',
            price: '49',
            currency: 'USD',
            format: 'PDF',
            description: '',
            cover_image: '/assets/images/img/30.webp',
            file_path: '',
            download_limit: 3,
            download_expiry_hours: 72,
            active: true,
            why_this_book_matters: '',
            who_its_for: [],
            what_readers_will_learn: [],
            author_note: '',
            faq: [],
            related_learning: [],
            related_frameworks: [],
            related_blogs: [],
            access_options: [],
        };
    }

    function openCreateModal() {
        setEditingProduct(null);
        setCoverImageFile(null);
        setProductFile(null);
        if (productFileInputRef.current) productFileInputRef.current.value = '';
        setCoverImagePreview('/assets/images/img/30.webp');
        setFormData(buildEmptyForm());
        setModalOpen(true);
    }

    function openEditModal(prod) {
        setEditingProduct(prod);
        setCoverImageFile(null);
        setProductFile(null);
        if (productFileInputRef.current) productFileInputRef.current.value = '';
        const currentCover = prod.cover_image || '/assets/images/img/30.webp';
        setCoverImagePreview(currentCover);
        setFormData({
            title: prod.title || '',
            subtitle: prod.subtitle || '',
            slug: prod.slug || '',
            sku: prod.sku || '',
            product_type: prod.product_type || 'ebook',
            publication_status: prod.publication_status || 'available',
            author: prod.author || 'M. Q. Siddiqui',
            price: prod.price || '',
            currency: prod.currency || 'USD',
            format: prod.format || 'PDF',
            description: prod.description || '',
            cover_image: currentCover,
            file_path: prod.file_path || '',
            download_limit: prod.download_limit || 3,
            download_expiry_hours: prod.download_expiry_hours || 72,
            active: prod.active !== false,
            why_this_book_matters: prod.why_this_book_matters || '',
            who_its_for: safeArray(prod.who_its_for),
            what_readers_will_learn: safeArray(prod.what_readers_will_learn),
            author_note: prod.author_note || '',
            faq: safeArray(prod.faq),
            related_learning: safeArray(prod.related_learning),
            related_frameworks: safeArray(prod.related_frameworks),
            related_blogs: safeArray(prod.related_blogs),
            access_options: safeArray(prod.access_options),
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
        toast.success(`Image selected (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    }

    function handleRemoveSelectedFile() {
        setCoverImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        const fallback = editingProduct?.cover_image || '/assets/images/img/30.webp';
        setCoverImagePreview(fallback);
        setFormData(prev => ({ ...prev, cover_image: fallback }));
    }

    function handleProductFileChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const MAX = 50 * 1024 * 1024;
        if (file.size > MAX) { toast.error(`File too large (max 50MB)`); if (productFileInputRef.current) productFileInputRef.current.value = ''; return; }
        setProductFile(file);
        const ext = file.name.split('.').pop()?.toUpperCase() || 'PDF';
        setFormData(prev => ({ ...prev, format: ext }));
        toast.success(`File selected: ${file.name}`);
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
            // Serialize JSONB array fields to JSON strings for FormData
            const jsonFields = ['who_its_for', 'what_readers_will_learn', 'faq', 'related_learning', 'related_frameworks', 'related_blogs', 'access_options'];

            if (coverImageFile || productFile) {
                const fd = new FormData();
                if (coverImageFile) fd.append('cover_image', coverImageFile);
                if (productFile) fd.append('product_file', productFile);
                fd.append('title', formData.title);
                fd.append('subtitle', formData.subtitle || '');
                fd.append('slug', formData.slug || '');
                fd.append('sku', formData.sku);
                fd.append('product_type', formData.product_type);
                fd.append('publication_status', formData.publication_status || 'available');
                fd.append('author', formData.author);
                fd.append('price', String(Number(formData.price) || 0));
                fd.append('currency', formData.currency);
                fd.append('format', formData.format || 'PDF');
                fd.append('description', formData.description || '');
                fd.append('why_this_book_matters', formData.why_this_book_matters || '');
                fd.append('author_note', formData.author_note || '');
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
                const payload = { ...formData, price: Number(formData.price) || 0, download_limit: Number(formData.download_limit) || 3, download_expiry_hours: Number(formData.download_expiry_hours) || 72 };
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

    return (
        <div className="page">
            <div className="page__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page__title">Publications Management</h1>
                    <p className="page__subtitle">Manage books, digital publications, and all content sections.</p>
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
                                            <img src={p.cover_image || '/assets/images/img/30.webp'} alt={p.title}
                                                style={{ width: 44, height: 58, objectFit: 'cover', borderRadius: 6 }} />
                                        </td>
                                        <td>
                                            <strong style={{ color: '#fff' }}>{p.title}</strong>
                                            {p.subtitle && <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{p.subtitle}</div>}
                                            {p.slug && <div style={{ fontSize: '0.7rem', color: '#6366f1', fontFamily: 'monospace' }}>/publications/{p.slug}</div>}
                                        </td>
                                        <td>
                                            <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: '0.73rem', fontWeight: 700, background: sc.bg, color: sc.color }}>{sc.label}</span>
                                        </td>
                                        <td style={{ fontWeight: 700, color: '#10b981' }}>{p.currency} {Number(p.price).toFixed(2)}</td>
                                        <td style={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>{p.product_type || 'ebook'}</td>
                                        <td>
                                            <button onClick={() => toggleActive(p)} style={{ padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 700, background: p.active !== false ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: p.active !== false ? '#10b981' : '#ef4444' }}>
                                                {p.active !== false ? '● Active' : '○ Inactive'}
                                            </button>
                                        </td>
                                        <td>
                                            <button onClick={() => openEditModal(p)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginRight: 10 }} title="Edit"><HiOutlinePencil size={18} /></button>
                                            <button onClick={() => handleDelete(p)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Delete"><HiOutlineTrash size={18} /></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ─── Publication Editor Modal ─── */}
            {modalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '20px 20px', overflowY: 'auto' }}>
                    <div style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '28px 32px', maxWidth: 780, width: '100%', marginBottom: 40 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                            <h2 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>
                                {editingProduct ? 'Edit Publication' : 'Add New Publication'}
                            </h2>
                            <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><HiOutlineX size={22} /></button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                            {/* ── BOOK INFORMATION ── */}
                            <SectionDivider title="Book Information" />

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ ...labelStyle, color: '#f87171' }}>Title *</label>
                                    <input type="text" required value={formData.title}
                                        onChange={e => {
                                            const title = e.target.value;
                                            setFormData(prev => ({
                                                ...prev, title,
                                                slug: prev.slug || !editingProduct ? slugify(title) : prev.slug
                                            }));
                                        }}
                                        style={inputStyle} placeholder="e.g. Marketing Reclassified: A Principle-First Approach" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Subtitle</label>
                                    <input type="text" value={formData.subtitle}
                                        onChange={e => setFormData(p => ({ ...p, subtitle: e.target.value }))}
                                        style={inputStyle} placeholder="e.g. Rethinking Marketing Through Purpose…" />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={labelStyle}>Slug / URL *</label>
                                    <input type="text" value={formData.slug}
                                        onChange={e => setFormData(p => ({ ...p, slug: slugify(e.target.value) }))}
                                        style={inputStyle} placeholder="marketing-reclassified" />
                                    {formData.slug && <p style={{ fontSize: '0.68rem', color: '#6366f1', marginTop: 3 }}>/publications/{formData.slug}</p>}
                                </div>
                                <div>
                                    <label style={{ ...labelStyle, color: '#f87171' }}>Publication Status *</label>
                                    <select value={formData.publication_status}
                                        onChange={e => setFormData(p => ({ ...p, publication_status: e.target.value }))}
                                        style={selectStyle}>
                                        <option value="available">Available</option>
                                        <option value="coming_soon">Coming Soon</option>
                                        <option value="draft">Draft</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Author</label>
                                    <input type="text" value={formData.author}
                                        onChange={e => setFormData(p => ({ ...p, author: e.target.value }))}
                                        style={inputStyle} />
                                </div>
                            </div>

                            {/* Cover Image */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <label style={{ fontSize: '0.78rem', color: '#a1a1aa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <HiOutlinePhotograph size={15} style={{ color: '#818cf8' }} /> Cover Image
                                    </label>
                                    <span style={{ fontSize: '0.69rem', color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '2px 7px', borderRadius: 4 }}>Max 5MB</span>
                                </div>
                                <div style={{ border: '1.5px dashed rgba(167,139,250,0.3)', borderRadius: 10, padding: 12, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 60, height: 80, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: '#161622', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        <img src={coverImagePreview || '/assets/images/img/30.webp'} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.src = '/assets/images/img/30.webp'; }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <input ref={fileInputRef} id="product-cover-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" onChange={handleCoverImageChange} style={{ display: 'none' }} />
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                            <button type="button" onClick={() => fileInputRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                                                <HiOutlineUpload size={14} /> {coverImageFile ? 'Change' : 'Upload Cover'}
                                            </button>
                                            {coverImageFile && (
                                                <button type="button" onClick={handleRemoveSelectedFile} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 9px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#f87171', fontSize: '0.73rem', cursor: 'pointer' }}>
                                                    <HiOutlineX size={13} /> Clear
                                                </button>
                                            )}
                                        </div>
                                        <p style={{ fontSize: '0.7rem', color: coverImageFile ? '#34d399' : '#9ca3af', marginTop: 5 }}>
                                            {coverImageFile ? `✓ ${coverImageFile.name} (${(coverImageFile.size / 1024 / 1024).toFixed(2)} MB)` : 'JPEG, PNG, WebP, GIF — max 5MB'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>Short Description</label>
                                <textarea rows={3} value={formData.description}
                                    onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                                    style={{ ...inputStyle, resize: 'vertical' }}
                                    placeholder="Brief description shown on listing and book page hero…" />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={labelStyle}>Primary Price</label>
                                    <input type="number" step="0.01" value={formData.price}
                                        onChange={e => setFormData(p => ({ ...p, price: e.target.value }))}
                                        style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Currency</label>
                                    <select value={formData.currency} onChange={e => setFormData(p => ({ ...p, currency: e.target.value }))} style={selectStyle}>
                                        <option value="USD">USD</option>
                                        <option value="AED">AED</option>
                                        <option value="EUR">EUR</option>
                                        <option value="GBP">GBP</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Product Type</label>
                                    <select value={formData.product_type} onChange={e => setFormData(p => ({ ...p, product_type: e.target.value }))} style={selectStyle}>
                                        <option value="ebook">eBook</option>
                                        <option value="publication">Publication</option>
                                        <option value="workbook">Workbook</option>
                                        <option value="report">Report</option>
                                        <option value="companion">Companion Pack</option>
                                    </select>
                                </div>
                            </div>

                            {/* ── BOOK PAGE CONTENT ── */}
                            <SectionDivider title="Book Page Content" />

                            <div>
                                <label style={labelStyle}>Why This Book Matters</label>
                                <textarea rows={5} value={formData.why_this_book_matters}
                                    onChange={e => setFormData(p => ({ ...p, why_this_book_matters: e.target.value }))}
                                    style={{ ...inputStyle, resize: 'vertical' }}
                                    placeholder="Write the main editorial copy explaining why this publication matters…" />
                            </div>

                            <RepeatableStringList
                                label="Who It Is For"
                                items={formData.who_its_for}
                                onChange={list => setFormData(p => ({ ...p, who_its_for: list }))}
                                placeholder="e.g. Marketing Students"
                                hint="Add one audience type per item. Use reorder buttons to arrange."
                            />

                            <RepeatableStringList
                                label="What Readers Will Learn"
                                items={formData.what_readers_will_learn}
                                onChange={list => setFormData(p => ({ ...p, what_readers_will_learn: list }))}
                                placeholder="e.g. Understand marketing beyond promotion"
                                hint="Add one learning point per item."
                            />

                            <div>
                                <label style={labelStyle}>Author Note</label>
                                <textarea rows={4} value={formData.author_note}
                                    onChange={e => setFormData(p => ({ ...p, author_note: e.target.value }))}
                                    style={{ ...inputStyle, resize: 'vertical' }}
                                    placeholder="Personal note from the author displayed on the publication page…" />
                            </div>

                            {/* ── FAQ ── */}
                            <SectionDivider title="FAQ" />
                            <FaqManager
                                items={formData.faq}
                                onChange={list => setFormData(p => ({ ...p, faq: list }))}
                            />

                            {/* ── RELATED CONTENT ── */}
                            <SectionDivider title="Related Content" />

                            <RepeatableStringList
                                label="Related Learning"
                                items={formData.related_learning}
                                onChange={list => setFormData(p => ({ ...p, related_learning: list }))}
                                placeholder="e.g. SF-101 From Purpose to Profit"
                                hint="Enter course/module names. They will link to /courses on the frontend."
                            />

                            <RepeatableStringList
                                label="Related Frameworks"
                                items={formData.related_frameworks}
                                onChange={list => setFormData(p => ({ ...p, related_frameworks: list }))}
                                placeholder="e.g. from-purpose-to-profit (use the framework slug)"
                                hint="Enter framework slugs exactly as they appear in the URL. e.g. adaptive-value-framework"
                            />

                            <RepeatableStringList
                                label="Related Blogs / Articles"
                                items={formData.related_blogs}
                                onChange={list => setFormData(p => ({ ...p, related_blogs: list }))}
                                placeholder="e.g. Blog title or blog ID"
                                hint="Enter blog titles or IDs. These will link to the blog listing page."
                            />

                            {/* ── ACCESS / PRICING OPTIONS ── */}
                            <SectionDivider title="Access & Pricing Options" />
                            <AccessOptionsManager
                                items={formData.access_options}
                                onChange={list => setFormData(p => ({ ...p, access_options: list }))}
                            />

                            {/* ── FILE & DOWNLOAD ── */}
                            <SectionDivider title="File & Download Settings" />

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <label style={{ fontSize: '0.78rem', color: '#a1a1aa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <HiOutlineDocumentText size={15} style={{ color: '#10b981' }} /> Product File / eBook
                                    </label>
                                    <span style={{ fontSize: '0.69rem', color: '#34d399', background: 'rgba(16,185,129,0.1)', padding: '2px 7px', borderRadius: 4 }}>Max 50MB</span>
                                </div>
                                <div style={{ border: '1.5px dashed rgba(16,185,129,0.3)', borderRadius: 9, padding: '10px 12px', background: '#1a1a2b', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <input ref={productFileInputRef} type="file" accept=".pdf,.epub,.mobi,.zip,.docx,application/pdf,application/epub+zip,application/zip" onChange={handleProductFileChange} style={{ display: 'none' }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <button type="button" onClick={() => productFileInputRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                                            <HiOutlineUpload size={14} /> {productFile ? 'Change File' : 'Upload File'}
                                        </button>
                                        {productFile && (
                                            <button type="button" onClick={handleRemoveProductFile} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 9px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#f87171', fontSize: '0.73rem', cursor: 'pointer' }}>
                                                <HiOutlineX size={13} /> Clear
                                            </button>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                                        {productFile ? (
                                            <span style={{ color: '#34d399' }}>✓ {productFile.name} ({(productFile.size / 1024 / 1024).toFixed(2)} MB) — {formData.format}</span>
                                        ) : formData.file_path ? (
                                            <span style={{ color: '#60a5fa' }}>📄 Current: {formData.file_path.split('/').pop()} ({formData.format})</span>
                                        ) : (
                                            'PDF, EPUB, MOBI, ZIP, DOCX — max 50MB'
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={labelStyle}>Download Limit</label>
                                    <input type="number" value={formData.download_limit} onChange={e => setFormData(p => ({ ...p, download_limit: e.target.value }))} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Download Expiry Hours</label>
                                    <input type="number" value={formData.download_expiry_hours} onChange={e => setFormData(p => ({ ...p, download_expiry_hours: e.target.value }))} style={inputStyle} />
                                </div>
                            </div>

                            {/* ── ACTIONS ── */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
                                <button type="button" disabled={saving} onClick={() => setModalOpen(false)}
                                    style={{ padding: '10px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving} className="btn btn--primary"
                                    style={{ padding: '10px 24px', borderRadius: 8, fontWeight: 700, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {saving ? 'Saving…' : editingProduct ? 'Save Changes' : 'Create Publication'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
