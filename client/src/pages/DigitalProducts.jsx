import { useState, useEffect } from 'react';
import { apiRequest } from '../config/api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineCheck, HiOutlineX } from 'react-icons/hi';

export default function DigitalProducts() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        sku: '',
        product_type: 'ebook',
        author: 'Qutub Siddiqui',
        price: '',
        currency: 'AED',
        format: 'PDF',
        description: '',
        cover_image: '/assets/images/img/30.webp',
        download_limit: 3,
        download_expiry_hours: 72,
        active: true
    });

    useEffect(() => {
        fetchProducts();
    }, []);

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

    function openCreateModal() {
        setEditingProduct(null);
        setFormData({
            title: '',
            sku: 'PROD-' + Date.now().toString(36).toUpperCase(),
            product_type: 'ebook',
            author: 'Qutub Siddiqui',
            price: '49',
            currency: 'AED',
            format: 'PDF',
            description: '',
            cover_image: '/assets/images/img/30.webp',
            download_limit: 3,
            download_expiry_hours: 72,
            active: true
        });
        setModalOpen(true);
    }

    function openEditModal(prod) {
        setEditingProduct(prod);
        setFormData({
            title: prod.title || '',
            sku: prod.sku || '',
            product_type: prod.product_type || 'ebook',
            author: prod.author || 'Qutub Siddiqui',
            price: prod.price || '',
            currency: prod.currency || 'AED',
            format: prod.format || 'PDF',
            description: prod.description || '',
            cover_image: prod.cover_image || '/assets/images/img/30.webp',
            download_limit: prod.download_limit || 3,
            download_expiry_hours: prod.download_expiry_hours || 72,
            active: prod.active !== false
        });
        setModalOpen(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            const payload = JSON.stringify({
                ...formData,
                price: Number(formData.price) || 0,
                download_limit: Number(formData.download_limit) || 3,
                download_expiry_hours: Number(formData.download_expiry_hours) || 72,
            });

            if (editingProduct) {
                await apiRequest(`/products/${editingProduct.id}`, {
                    method: 'PUT',
                    body: payload
                });
                toast.success('Product updated successfully');
            } else {
                await apiRequest('/products', {
                    method: 'POST',
                    body: payload
                });
                toast.success('Digital product created');
            }
            setModalOpen(false);
            fetchProducts();
        } catch (err) {
            console.error('Save product error:', err);
            toast.error(err.message || 'Failed to save product');
        }
    }

    async function toggleActive(prod) {
        try {
            await apiRequest(`/products/${prod.id}`, {
                method: 'PUT',
                body: JSON.stringify({ active: !prod.active })
            });
            toast.success(prod.active ? 'Product deactivated' : 'Product activated');
            fetchProducts();
        } catch (err) {
            console.error('Toggle active error:', err);
            toast.error('Failed to update status');
        }
    }

    async function handleDelete(prod) {
        if (!window.confirm(`Are you sure you want to delete "${prod.title}"?`)) return;
        try {
            await apiRequest(`/products/${prod.id}`, { method: 'DELETE' });
            toast.success('Product deleted');
            fetchProducts();
        } catch (err) {
            toast.error('Failed to delete product');
        }
    }

    return (
        <div className="page">
            <div className="page__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page__title">Digital Products Management</h1>
                    <p className="page__subtitle">
                        Manage all digital eBooks, publications, workbooks, and pricing for the store.
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="btn btn--primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', fontWeight: '600' }}
                >
                    <HiOutlinePlus size={18} /> Add Digital Product
                </button>
            </div>

            {loading ? (
                <div className="page-loading"><div className="spinner" /></div>
            ) : (
                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Cover</th>
                                <th>Title & SKU</th>
                                <th>Type</th>
                                <th>Price</th>
                                <th>Format</th>
                                <th>Limits</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((p) => (
                                <tr key={p.id}>
                                    <td>
                                        <img
                                            src={p.cover_image || '/assets/images/img/30.webp'}
                                            alt={p.title}
                                            style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '6px' }}
                                        />
                                    </td>
                                    <td>
                                        <strong style={{ color: '#fff' }}>{p.title}</strong>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                            {p.sku || p.id?.substring(0, 8)}
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{ textTransform: 'capitalize', fontSize: '0.8rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }}>
                                            {p.product_type || 'ebook'}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: '700', color: '#10b981' }}>
                                        {p.currency || 'AED'} {Number(p.price).toFixed(2)}
                                    </td>
                                    <td>{p.format || 'PDF'}</td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {p.download_limit || 3} downloads / {p.download_expiry_hours || 72}h
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => toggleActive(p)}
                                            style={{
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                fontWeight: 'bold',
                                                background: p.active !== false ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                color: p.active !== false ? '#10b981' : '#ef4444'
                                            }}
                                        >
                                            {p.active !== false ? '● Active' : '○ Inactive'}
                                        </button>
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => openEditModal(p)}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginRight: '10px' }}
                                            title="Edit Product"
                                        >
                                            <HiOutlinePencil size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(p)}
                                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                            title="Delete Product"
                                        >
                                            <HiOutlineTrash size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {modalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                    <div style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '28px', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: 16 }}>
                            {editingProduct ? 'Edit Digital Product' : 'Add New Digital Product'}
                        </h2>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: 4 }}>Product Title</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', background: '#28283d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: 4 }}>Price (AED)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', background: '#28283d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: 4 }}>Currency</label>
                                    <select
                                        value={formData.currency}
                                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', background: '#28283d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                                    >
                                        <option value="AED">AED (Dirham)</option>
                                        <option value="USD">USD (Dollar)</option>
                                        <option value="EUR">EUR (Euro)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: 4 }}>Format / Edition</label>
                                <input
                                    type="text"
                                    value={formData.format}
                                    onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                                    placeholder="PDF, ePub, Interactive Workbook"
                                    style={{ width: '100%', padding: '10px 12px', background: '#28283d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: 4 }}>Description</label>
                                <textarea
                                    rows="3"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', background: '#28283d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: 4 }}>Download Limit</label>
                                    <input
                                        type="number"
                                        value={formData.download_limit}
                                        onChange={(e) => setFormData({ ...formData, download_limit: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', background: '#28283d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: 4 }}>Expiry Hours</label>
                                    <input
                                        type="number"
                                        value={formData.download_expiry_hours}
                                        onChange={(e) => setFormData({ ...formData, download_expiry_hours: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', background: '#28283d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    style={{ padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn--primary"
                                    style={{ padding: '10px 20px', borderRadius: 8, fontWeight: '600' }}
                                >
                                    Save Product
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
