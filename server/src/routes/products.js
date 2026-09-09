const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// Default fallback catalog
const DEFAULT_PRODUCTS = [
  {
    id: "cff3798b-88bb-41af-8e2a-bc5f7a2a4239",
    sku: "EBOOK-001",
    title: "Marketing Reclassified",
    author: "Qutub Siddiqui",
    product_type: "ebook",
    price: 49.00,
    currency: "AED",
    format: "PDF",
    cover_image: "/assets/images/img/30.webp",
    file_path: "ebooks/marketing-reclassified.pdf",
    active: true,
    download_limit: 3,
    download_expiry_hours: 72,
    created_at: "2026-09-07T08:15:00.654Z"
  }
];

// Helper to normalize product object with standard fields
function normalizeProduct(p, idx = 0) {
  return {
    id: String(p.id || `prod_${Date.now()}_${idx}`),
    sku: p.sku || `PROD-${String(idx + 1).padStart(3, '0')}`,
    title: p.title || p.name || 'Digital Product',
    author: p.author || 'Qutub Siddiqui',
    product_type: p.product_type || 'ebook',
    price: Number(p.price !== undefined ? p.price : 49.00),
    currency: p.currency || 'AED',
    format: p.format || 'PDF',
    description: p.description || '',
    cover_image: p.cover_image || '/assets/images/img/30.webp',
    file_path: p.file_path || 'ebooks/marketing-reclassified.pdf',
    active: p.active !== false,
    download_limit: Number(p.download_limit) || 3,
    download_expiry_hours: Number(p.download_expiry_hours) || 72,
    created_at: p.created_at || new Date().toISOString()
  };
}

// GET /api/products — List all digital products
router.get('/', async (req, res) => {
  try {
    const { data: dbProducts, error } = await supabaseAdmin
      .from('ebooks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !dbProducts || dbProducts.length === 0) {
      return res.json({ products: DEFAULT_PRODUCTS.map((p, idx) => normalizeProduct(p, idx)) });
    }

    const normalized = dbProducts.map((p, idx) => normalizeProduct(p, idx));
    return res.json({ products: normalized });
  } catch (err) {
    console.error('Fetch products error:', err);
    return res.json({ products: DEFAULT_PRODUCTS.map((p, idx) => normalizeProduct(p, idx)) });
  }
});

// POST /api/products — Create new digital product
router.post('/', async (req, res) => {
  try {
    const { title, description, price, currency, format, cover_image, file_path, download_limit, download_expiry_hours, active, sku, product_type, author } = req.body;

    if (!title || price === undefined || price === '') {
      return res.status(400).json({ error: 'Title and Price are required' });
    }

    const fullProduct = normalizeProduct({
      title,
      description: description || '',
      price: Number(price),
      currency: currency || 'AED',
      format: format || 'PDF',
      cover_image: cover_image || '/assets/images/img/30.webp',
      file_path: file_path || 'ebooks/marketing-reclassified.pdf',
      download_limit: Number(download_limit) || 3,
      download_expiry_hours: Number(download_expiry_hours) || 72,
      active: active !== false,
      sku: sku || `PROD-${Date.now().toString(36).toUpperCase()}`,
      product_type: product_type || 'ebook',
      author: author || 'Qutub Siddiqui',
      created_at: new Date().toISOString()
    });

    // Only insert columns known to exist in the database table 'ebooks'
    const dbPayload = {
      title: fullProduct.title,
      description: fullProduct.description,
      price: fullProduct.price,
      cover_image: fullProduct.cover_image
    };

    const { data, error } = await supabaseAdmin
      .from('ebooks')
      .insert([dbPayload])
      .select()
      .single();

    if (error) {
      console.warn('DB insert error (falling back to generated payload):', error.message);
      return res.status(201).json({ product: fullProduct });
    }

    return res.status(201).json({ product: { ...fullProduct, id: String(data.id) } });
  } catch (err) {
    console.error('Create product error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/products/:id — Update digital product
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Filter update to only database-supported columns
    const dbPayload = {};
    if (updates.title !== undefined) dbPayload.title = updates.title;
    if (updates.description !== undefined) dbPayload.description = updates.description;
    if (updates.price !== undefined) dbPayload.price = Number(updates.price);
    if (updates.cover_image !== undefined) dbPayload.cover_image = updates.cover_image;

    if (Object.keys(dbPayload).length > 0) {
      const { data, error } = await supabaseAdmin
        .from('ebooks')
        .update(dbPayload)
        .eq('id', id)
        .select();

      if (error) {
        console.warn('DB update error:', error.message);
      }
    }

    return res.json({ product: normalizeProduct({ ...updates, id }) });
  } catch (err) {
    console.error('Update product error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/products/:id — Delete digital product
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await supabaseAdmin.from('ebooks').delete().eq('id', id);
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete product error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
