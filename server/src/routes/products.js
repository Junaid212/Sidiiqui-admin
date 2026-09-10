const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabaseAdmin } = require('../config/supabase');

// Configure multer for memory storage (5MB limit for cover images)
// Configure multer for memory storage (up to 50MB for digital products/ebooks, 5MB for images)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max limit
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'cover_image' || file.fieldname === 'image') {
      const allowedImgTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
      if (allowedImgTypes.includes(file.mimetype)) {
        return cb(null, true);
      }
      return cb(new Error('Invalid image type. Only JPEG, PNG, WebP, GIF, and SVG are allowed.'));
    }
    // Ebook / Product file: allow any document, publication, or zip file
    cb(null, true);
  },
});

// Middleware supporting cover_image, product_file, and aliases
const uploadProductMiddleware = (req, res, next) => {
  upload.fields([
    { name: 'cover_image', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'product_file', maxCount: 1 },
    { name: 'ebook_file', maxCount: 1 },
    { name: 'file', maxCount: 1 }
  ])(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File exceeds maximum upload size limit (max 50MB).' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    // Normalize single cover file to req.file for backward compatibility
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

// Helper: Upload product/ebook file to Supabase Storage (digital-products bucket)
async function uploadEbookFile(file) {
  const ext = (file.originalname.split('.').pop() || 'pdf').toLowerCase();
  const cleanBase = file.originalname
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
  const fileName = `ebooks/${Date.now()}-${cleanBase}.${ext}`;

  // Try digital-products bucket first, fallback to product-covers or blogs
  let bucket = 'digital-products';
  let { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype || 'application/octet-stream',
      upsert: true,
    });

  if (error) {
    console.warn(`Upload to ${bucket} failed, falling back to product-covers:`, error.message);
    bucket = 'product-covers';
    const fallbackRes = await supabaseAdmin.storage
      .from(bucket)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: true,
      });

    if (fallbackRes.error) {
      bucket = 'blogs';
      const fallbackBlogs = await supabaseAdmin.storage
        .from(bucket)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype || 'application/octet-stream',
          upsert: true,
        });
      if (fallbackBlogs.error) throw fallbackBlogs.error;
    }
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return {
    path: fileName,
    url: urlData.publicUrl,
    bucket,
    format: ext.toUpperCase()
  };
}

const { setProductFile, getProductFile, getAllProductFiles } = require('../utils/productFileStore');

// Default fallback catalog
const DEFAULT_PRODUCTS = [
  {
    id: "04b84648-3609-4b31-9ded-2486bacf1e74",
    sku: "EBOOK-001",
    title: "Marketing Reclassified",
    author: "M. Q. Siddiqui",
    product_type: "ebook",
    price: 99.00,
    currency: "AED",
    format: "PDF",
    cover_image: "https://cneariiepqywvjpmznqn.supabase.co/storage/v1/object/public/product-covers/1788934311298-book1.webp",
    file_path: "ebooks/marketing-reclassified.pdf",
    active: true,
    download_limit: 3,
    download_expiry_hours: 72,
    created_at: "2026-09-08T09:26:18.984Z"
  }
];

// Helper to normalize product object with standard fields
function normalizeProduct(p, idx = 0, fallbackData = {}) {
  const prodId = String(p?.id || fallbackData?.id || '');
  const fileInfo = getProductFile(prodId);
  const resolvedFilePath = p?.file_path || fileInfo?.filePath || fallbackData?.file_path || (prodId === "04b84648-3609-4b31-9ded-2486bacf1e74" || p?.title?.toLowerCase()?.includes("marketing reclassified") ? "ebooks/marketing-reclassified.pdf" : null);
  const resolvedFormat = p?.format || fileInfo?.format || fallbackData?.format || 'PDF';

  return {
    id: prodId || `prod_${Date.now()}_${idx}`,
    sku: p?.sku || fallbackData?.sku || `PROD-${String(idx + 1).padStart(3, '0')}`,
    title: p?.title || fallbackData?.title || p?.name || 'Digital Product',
    author: p?.author || fallbackData?.author || 'M. Q. Siddiqui',
    product_type: p?.product_type || fallbackData?.product_type || 'ebook',
    price: Number(p?.price !== undefined ? p.price : (fallbackData?.price !== undefined ? fallbackData.price : 49.00)),
    currency: p?.currency || fallbackData?.currency || 'AED',
    format: resolvedFormat,
    description: p?.description !== undefined ? p.description : (fallbackData?.description || ''),
    cover_image: p?.cover_image || fallbackData?.cover_image || '/assets/images/img/30.webp',
    file_path: resolvedFilePath,
    active: (p?.active !== undefined ? p.active !== false : (fallbackData?.active !== undefined ? fallbackData.active !== false : true)),
    download_limit: Number(p?.download_limit || fallbackData?.download_limit || 3),
    download_expiry_hours: Number(p?.download_expiry_hours || fallbackData?.download_expiry_hours || 72),
    created_at: p?.created_at || fallbackData?.created_at || new Date().toISOString()
  };
}

// Helper to safely execute database operations even if some optional columns do not yet exist in Supabase schema cache
async function executeWithSchemaFallback(operationFn, payload) {
  let currentPayload = { ...payload };
  while (true) {
    const res = await operationFn(currentPayload);
    if (!res.error) {
      return res;
    }

    // Check if error is due to a missing column in Supabase schema cache
    // e.g. "Could not find the 'active' column of 'ebooks' in the schema cache"
    // or Postgres code 42703 (undefined column)
    const match = res.error.message?.match(/Could not find the '([^']+)' column/i) ||
                  res.error.message?.match(/column ['"]?([a-zA-Z0-9_]+)['"]? of ['"]?ebooks['"]? does not exist/i) ||
                  res.error.message?.match(/column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i);

    if (match && match[1] && currentPayload.hasOwnProperty(match[1])) {
      const badCol = match[1];
      console.warn(`[Products] Column '${badCol}' missing in 'ebooks' schema, omitting and retrying.`);
      delete currentPayload[badCol];
      if (Object.keys(currentPayload).length === 0) {
        return res;
      }
      continue;
    }

    // If unhandled error, return it
    return res;
  }
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
router.post('/upload-cover', uploadProductMiddleware, async (req, res) => {
  try {
    const coverFile = (req.files && (req.files.cover_image?.[0] || req.files.image?.[0])) || req.file;
    if (!coverFile) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const result = await uploadProductCover(coverFile);
    return res.status(200).json({ url: result.url, path: result.path });
  } catch (err) {
    console.error('Upload cover image error:', err);
    return res.status(500).json({ error: err.message || 'Failed to upload cover image' });
  }
});

// POST /api/products/upload-file — Dedicated upload endpoint for product/ebook files (< 50MB)
router.post('/upload-file', uploadProductMiddleware, async (req, res) => {
  try {
    const productDoc = req.files && (req.files.product_file?.[0] || req.files.ebook_file?.[0] || req.files.file?.[0]);
    if (!productDoc) {
      return res.status(400).json({ error: 'No product/ebook file uploaded' });
    }
    const result = await uploadEbookFile(productDoc);
    return res.status(200).json({ path: result.path, url: result.url, format: result.format });
  } catch (err) {
    console.error('Upload product file error:', err);
    return res.status(500).json({ error: err.message || 'Failed to upload product file' });
  }
});

// POST /api/products — Create new digital product
router.post('/', uploadProductMiddleware, async (req, res) => {
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
    const coverFile = (req.files && (req.files.cover_image?.[0] || req.files.image?.[0])) || req.file;
    if (coverFile) {
      const uploadRes = await uploadProductCover(coverFile);
      cover_image = uploadRes.url;
    }

    // Upload product/ebook file if provided
    const productDoc = req.files && (req.files.product_file?.[0] || req.files.ebook_file?.[0] || req.files.file?.[0]);
    if (productDoc) {
      const fileRes = await uploadEbookFile(productDoc);
      file_path = fileRes.path;
      if (!format || format === 'PDF') {
        format = fileRes.format;
      }
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

    const { data, error } = await executeWithSchemaFallback(
      (payload) => supabaseAdmin.from('ebooks').insert([payload]).select().single(),
      dbPayload
    );

    if (error) {
      console.error('DB insert error:', error);

      return res.status(500).json({
        error: error.message || 'Failed to create product'
      });
    }

    if (data?.id && (file_path || dbPayload.file_path)) {
      setProductFile(data.id, file_path || dbPayload.file_path, format);
    }

    return res.status(201).json({
      product: normalizeProduct(data, 0, dbPayload)
    });

  } catch (err) {
    console.error('Create product error:', err);

    return res.status(500).json({
      error: err.message || 'Internal server error'
    });
  }
});

// PUT /api/products/:id — Update digital product
router.put('/:id', uploadProductMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const updates = { ...req.body };

    // Upload new cover image if provided
    const coverFile = (req.files && (req.files.cover_image?.[0] || req.files.image?.[0])) || req.file;
    if (coverFile) {
      const uploadRes = await uploadProductCover(coverFile);
      updates.cover_image = uploadRes.url;
    }

    // Upload new product/ebook file if provided
    const productDoc = req.files && (req.files.product_file?.[0] || req.files.ebook_file?.[0] || req.files.file?.[0]);
    if (productDoc) {
      const fileRes = await uploadEbookFile(productDoc);
      updates.file_path = fileRes.path;
      if (!updates.format) {
        updates.format = fileRes.format;
      }
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

    const { data, error } = await executeWithSchemaFallback(
      (payload) => supabaseAdmin.from('ebooks').update(payload).eq('id', id).select().single(),
      dbPayload
    );

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

    if (updates.file_path || dbPayload.file_path) {
      setProductFile(id, updates.file_path || dbPayload.file_path, updates.format);
    }

    return res.json({
      product: normalizeProduct(data, 0, { ...updates, id })
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
