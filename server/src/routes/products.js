const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabaseAdmin } = require('../config/supabase');

// Configure multer for memory storage (5MB limit for cover images)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, GIF, and SVG are allowed.'));
    }
  },
});

// Middleware supporting either 'cover_image' or 'image' field and catching Multer errors
const uploadCoverMiddleware = (req, res, next) => {
  upload.fields([
    { name: 'cover_image', maxCount: 1 },
    { name: 'image', maxCount: 1 }
  ])(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Cover image must be less than 5MB.' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    // Normalize single file to req.file
    if (req.files) {
      if (req.files.cover_image && req.files.cover_image[0]) {
        req.file = req.files.cover_image[0];
      } else if (req.files.image && req.files.image[0]) {
        req.file = req.files.image[0];
      }
    }
    next();
  });
};

// Helper: Upload product cover image to Supabase Storage
async function uploadProductCover(file) {
  const ext = (file.originalname.split('.').pop() || 'png').toLowerCase();
  const cleanBase = file.originalname
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
  const fileName = `${Date.now()}-${cleanBase}.${ext}`;
  const filePath = `product-covers/${fileName}`;

  // Try product-covers bucket first, fallback to blogs bucket
  let bucket = 'product-covers';
  let { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    console.warn(`Upload to ${bucket} failed, falling back to blogs bucket:`, error.message);
    bucket = 'blogs';
    const fallbackRes = await supabaseAdmin.storage
      .from(bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
    if (fallbackRes.error) throw fallbackRes.error;
    const { data: urlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(filePath);
    return { path: filePath, url: urlData.publicUrl, bucket };
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return { path: fileName, url: urlData.publicUrl, bucket };
}

// Default fallback catalog
const DEFAULT_PRODUCTS = [
  {
    id: "cff3798b-88bb-41af-8e2a-bc5f7a2a4239",
    sku: "EBOOK-001",
    title: "Marketing Reclassified",
    author: "M. Q. Siddiqui",
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
    author: p.author || 'M. Q. Siddiqui',
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

// POST /api/products/upload-cover — Dedicated upload endpoint for cover images (< 5MB)
router.post('/upload-cover', uploadCoverMiddleware, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const result = await uploadProductCover(req.file);
    return res.status(200).json({ url: result.url, path: result.path });
  } catch (err) {
    console.error('Upload cover image error:', err);
    return res.status(500).json({ error: err.message || 'Failed to upload cover image' });
  }
});

// POST /api/products — Create new digital product
router.post('/', uploadCoverMiddleware, async (req, res) => {
  try {
    let {
      title,
      description,
      price,
      currency,
      format,
      cover_image,
      file_path,
      download_limit,
      download_expiry_hours,
      active,
      sku,
      product_type,
      author
    } = req.body;

    if (!title || price === undefined || price === '') {
      return res.status(400).json({
        error: 'Title and Price are required'
      });
    }

    // Upload cover image if provided
    if (req.file) {
      const uploadRes = await uploadProductCover(req.file);
      cover_image = uploadRes.url;
    }

    const dbPayload = {
      title: String(title).trim(),
      description: description || '',
      price: Number(price),
      currency: currency || 'AED',
      format: format || 'PDF',
      cover_image: cover_image || '/assets/images/img/30.webp',
      file_path: file_path || 'ebooks/marketing-reclassified.pdf',
      download_limit: Number(download_limit) || 3,
      download_expiry_hours: Number(download_expiry_hours) || 72,
      active: active !== 'false' && active !== false,
      sku: sku || `PROD-${Date.now().toString(36).toUpperCase()}`,
      product_type: product_type || 'ebook',
      author: author || 'M. Q. Siddiqui'
    };

    const { data, error } = await supabaseAdmin
      .from('ebooks')
      .insert([dbPayload])
      .select()
      .single();

    if (error) {
      console.error('DB insert error:', error);

      return res.status(500).json({
        error: error.message || 'Failed to create product'
      });
    }

    return res.status(201).json({
      product: normalizeProduct(data)
    });

  } catch (err) {
    console.error('Create product error:', err);

    return res.status(500).json({
      error: err.message || 'Internal server error'
    });
  }
});

// PUT /api/products/:id — Update digital product
router.put('/:id', uploadCoverMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const updates = { ...req.body };

    // Upload new cover image if provided
    if (req.file) {
      const uploadRes = await uploadProductCover(req.file);
      updates.cover_image = uploadRes.url;
    }

    const dbPayload = {};

    if (updates.title !== undefined) {
      dbPayload.title = String(updates.title).trim();
    }

    if (updates.description !== undefined) {
      dbPayload.description = updates.description;
    }

    if (updates.price !== undefined) {
      dbPayload.price = Number(updates.price);
    }

    if (updates.currency !== undefined) {
      dbPayload.currency = updates.currency;
    }

    if (updates.format !== undefined) {
      dbPayload.format = updates.format;
    }

    if (updates.cover_image !== undefined) {
      dbPayload.cover_image = updates.cover_image;
    }

    if (updates.file_path !== undefined) {
      dbPayload.file_path = updates.file_path;
    }

    if (updates.download_limit !== undefined) {
      dbPayload.download_limit = Number(updates.download_limit);
    }

    if (updates.download_expiry_hours !== undefined) {
      dbPayload.download_expiry_hours =
        Number(updates.download_expiry_hours);
    }

    if (updates.active !== undefined) {
      dbPayload.active =
        updates.active !== 'false' &&
        updates.active !== false;
    }

    if (updates.sku !== undefined) {
      dbPayload.sku = updates.sku;
    }

    if (updates.product_type !== undefined) {
      dbPayload.product_type = updates.product_type;
    }

    if (updates.author !== undefined) {
      dbPayload.author = updates.author;
    }

    if (Object.keys(dbPayload).length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update'
      });
    }

    const { data, error } = await supabaseAdmin
      .from('ebooks')
      .update(dbPayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('DB update error:', error);

      return res.status(500).json({
        error: error.message || 'Failed to update product'
      });
    }

    if (!data) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    return res.json({
      product: normalizeProduct(data)
    });

  } catch (err) {
    console.error('Update product error:', err);

    return res.status(500).json({
      error: err.message || 'Internal server error'
    });
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
