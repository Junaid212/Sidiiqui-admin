const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('../config/supabase');
const { cleanAppliesTo, appliesToLabel, couponCoversItems } = require('../utils/couponScope');

const DATA_FILE = process.env.COUPONS_FILE || path.join(__dirname, '../data/coupons.json'); // COUPONS_FILE: only for tests, so they never touch the real coupons

// Helper: load local coupons
function loadLocalCoupons() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            const initial = [
                {
                    id: 'coup_launch20',
                    code: 'LAUNCH20',
                    discount_percentage: 20,
                    discount_type: 'percentage',
                    description: 'Launch promotion — 20% off all publications',
                    min_order_amount: 0,
                    max_uses: null,
                    times_used: 14,
                    is_active: true,
                    expires_at: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                {
                    id: 'coup_welcome10',
                    code: 'WELCOME10',
                    discount_percentage: 10,
                    discount_type: 'percentage',
                    description: 'New reader welcome gift — 10% off',
                    min_order_amount: 0,
                    max_uses: null,
                    times_used: 8,
                    is_active: true,
                    expires_at: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                {
                    id: 'coup_reader15',
                    code: 'READER15',
                    discount_percentage: 15,
                    discount_type: 'percentage',
                    description: 'Exclusive subscriber discount — 15% off',
                    min_order_amount: 0,
                    max_uses: 100,
                    times_used: 23,
                    is_active: true,
                    expires_at: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                {
                    id: 'coup_books25',
                    code: 'BOOKS25',
                    discount_percentage: 25,
                    discount_type: 'percentage',
                    description: 'Special book bundle discount — 25% off',
                    min_order_amount: 50,
                    max_uses: 50,
                    times_used: 5,
                    is_active: true,
                    expires_at: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ];
            fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
            fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
            return initial;
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (err) {
        console.error('[Coupons] Failed to load local coupons:', err.message);
        return [];
    }
}

// Helper: save local coupons
function saveLocalCoupons(coupons) {
    try {
        fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify(coupons, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('[Coupons] Failed to save local coupons:', err.message);
        return false;
    }
}

// Helper: sync coupon to Supabase if table exists
async function syncToSupabase(coupon, action = 'upsert') {
    try {
        if (!supabaseAdmin) return;
        if (action === 'delete') {
            await supabaseAdmin.from('coupons').delete().eq('id', coupon.id);
        } else {
            await supabaseAdmin.from('coupons').upsert(coupon);
        }
    } catch (_) {
        // Table might not exist yet, suppress error
    }
}

// ── GET /api/coupons — Get all coupons with stats ──
router.get('/', async (req, res) => {
    try {
        let coupons = [];
        // Try fetching from Supabase first
        try {
            const { data, error } = await supabaseAdmin
                .from('coupons')
                .select('*')
                .order('created_at', { ascending: false });
            if (!error && Array.isArray(data) && data.length > 0) {
                // the Supabase table may not have the "Applies to" column: keep what the local store holds for the same coupon
                const local = loadLocalCoupons();
                coupons = data.map((c) => {
                    if (Array.isArray(c.applies_to)) return c;
                    const mine = local.find((l) => l.id === c.id || String(l.code).toUpperCase() === String(c.code).toUpperCase());
                    return mine && Array.isArray(mine.applies_to) ? { ...c, applies_to: mine.applies_to } : c;
                });
            }
        } catch (_) {}

        // Fallback to local store
        if (coupons.length === 0) {
            coupons = loadLocalCoupons();
        }

        const total = coupons.length;
        const active = coupons.filter(c => c.is_active !== false).length;
        const totalRedemptions = coupons.reduce((sum, c) => sum + (Number(c.times_used) || 0), 0);
        const maxDiscount = coupons.reduce((max, c) => Math.max(max, Number(c.discount_percentage) || 0), 0);

        return res.json({
            coupons,
            stats: {
                total,
                active,
                totalRedemptions,
                maxDiscount,
            }
        });
    } catch (err) {
        console.error('[Coupons GET] Error:', err);
        return res.status(500).json({ error: 'Failed to retrieve coupons' });
    }
});

// ── POST /api/coupons — Create a new coupon code ──
router.post('/', async (req, res) => {
    try {
        let {
            code,
            discount_percentage,
            discount_type = 'percentage',
            description = '',
            min_order_amount = 0,
            max_uses = null,
            expires_at = null,
            is_active = true,
            applies_to = [],
        } = req.body;

        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: 'Coupon code is required.' });
        }

        code = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        if (code.length < 2) {
            return res.status(400).json({ error: 'Coupon code must be at least 2 characters long.' });
        }

        const percentage = Number(discount_percentage);
        if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
            return res.status(400).json({ error: 'Discount percentage must be a number between 1 and 100.' });
        }

        const coupons = loadLocalCoupons();
        const existing = coupons.find(c => c.code.toUpperCase() === code);
        if (existing) {
            return res.status(400).json({ error: `Coupon code '${code}' already exists.` });
        }

        const newCoupon = {
            id: `coup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            code,
            discount_percentage: percentage,
            discount_type: discount_type || 'percentage',
            description: description ? description.trim() : `${percentage}% discount`,
            min_order_amount: Number(min_order_amount) || 0,
            max_uses: max_uses ? Number(max_uses) : null,
            times_used: 0,
            is_active: Boolean(is_active),
            applies_to: cleanAppliesTo(applies_to), // [] = all products
            expires_at: expires_at ? new Date(expires_at).toISOString() : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        coupons.unshift(newCoupon);
        saveLocalCoupons(coupons);

        // Async sync to Supabase
        syncToSupabase(newCoupon, 'upsert');

        return res.status(201).json({
            message: 'Coupon code created successfully',
            coupon: newCoupon,
        });
    } catch (err) {
        console.error('[Coupons POST] Error:', err);
        return res.status(500).json({ error: 'Failed to create coupon code' });
    }
});

// ── PUT /api/coupons/:id — Update coupon ──
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            code,
            discount_percentage,
            description,
            min_order_amount,
            max_uses,
            expires_at,
            is_active,
            applies_to,
        } = req.body;

        const coupons = loadLocalCoupons();
        const index = coupons.findIndex(c => c.id === id);

        if (index === -1) {
            return res.status(404).json({ error: 'Coupon not found' });
        }

        const target = coupons[index];

        if (code) {
            const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
            const duplicate = coupons.find(c => c.id !== id && c.code.toUpperCase() === cleanCode);
            if (duplicate) {
                return res.status(400).json({ error: `Coupon code '${cleanCode}' is already used by another coupon.` });
            }
            target.code = cleanCode;
        }

        if (discount_percentage !== undefined) {
            const p = Number(discount_percentage);
            if (isNaN(p) || p <= 0 || p > 100) {
                return res.status(400).json({ error: 'Discount percentage must be between 1 and 100.' });
            }
            target.discount_percentage = p;
        }

        if (description !== undefined) target.description = description.trim();
        if (min_order_amount !== undefined) target.min_order_amount = Number(min_order_amount) || 0;
        if (max_uses !== undefined) target.max_uses = max_uses ? Number(max_uses) : null;
        if (expires_at !== undefined) target.expires_at = expires_at ? new Date(expires_at).toISOString() : null;
        if (is_active !== undefined) target.is_active = Boolean(is_active);
        if (applies_to !== undefined) target.applies_to = cleanAppliesTo(applies_to);

        target.updated_at = new Date().toISOString();
        coupons[index] = target;
        saveLocalCoupons(coupons);

        syncToSupabase(target, 'upsert');

        return res.json({
            message: 'Coupon updated successfully',
            coupon: target,
        });
    } catch (err) {
        console.error('[Coupons PUT] Error:', err);
        return res.status(500).json({ error: 'Failed to update coupon' });
    }
});

// ── DELETE /api/coupons/:id — Delete coupon ──
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const coupons = loadLocalCoupons();
        const target = coupons.find(c => c.id === id);

        if (!target) {
            return res.status(404).json({ error: 'Coupon not found' });
        }

        const filtered = coupons.filter(c => c.id !== id);
        saveLocalCoupons(filtered);

        syncToSupabase(target, 'delete');

        return res.json({ message: 'Coupon deleted successfully' });
    } catch (err) {
        console.error('[Coupons DELETE] Error:', err);
        return res.status(500).json({ error: 'Failed to delete coupon' });
    }
});

// ── POST /api/coupons/validate (or /api/public/coupons/validate) ──
// Matches coupon code case-insensitively, checks is_active and expiry,
// returns discount percentage.
const validateCoupon = async (req, res) => {
    try {
        const { code, subtotal = 0, items } = req.body;
        if (!code || typeof code !== 'string') {
            return res.status(400).json({ valid: false, error: 'Please enter a coupon code.' });
        }

        const cleanCode = code.trim().toUpperCase();
        let coupons = loadLocalCoupons();

        // Also check Supabase if table exists
        try {
            const { data } = await supabaseAdmin
                .from('coupons')
                .select('*')
                .ilike('code', cleanCode)
                .limit(1);
            if (data && data[0]) {
                const found = data[0];
                const existingIndex = coupons.findIndex(c => c.code.toUpperCase() === cleanCode);
                if (existingIndex >= 0) {
                    // the Supabase row may lack the "Applies to" column: never lose a restriction the local store has
                    if (!Array.isArray(found.applies_to) && Array.isArray(coupons[existingIndex].applies_to)) found.applies_to = coupons[existingIndex].applies_to;
                    coupons[existingIndex] = found;
                } else coupons.push(found);
            }
        } catch (_) {}

        const coupon = coupons.find(c => c.code.toUpperCase() === cleanCode);

        if (!coupon) {
            return res.status(404).json({
                valid: false,
                error: `Coupon code '${cleanCode}' is invalid. Please check and try again.`
            });
        }

        if (coupon.is_active === false) {
            return res.status(400).json({
                valid: false,
                error: `Coupon code '${cleanCode}' is currently disabled.`
            });
        }

        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
            return res.status(400).json({
                valid: false,
                error: `Coupon code '${cleanCode}' has expired.`
            });
        }

        if (coupon.max_uses && coupon.times_used >= coupon.max_uses) {
            return res.status(400).json({
                valid: false,
                error: `Coupon code '${cleanCode}' has reached its maximum usage limit.`
            });
        }

        if (coupon.min_order_amount && subtotal > 0 && subtotal < coupon.min_order_amount) {
            return res.status(400).json({
                valid: false,
                error: `Coupon code '${cleanCode}' requires a minimum order of USD ${coupon.min_order_amount}.`
            });
        }

        // "Applies to": a restricted coupon is valid only when the cart holds at least one product it covers.
        const appliesTo = cleanAppliesTo(coupon.applies_to);
        if (!couponCoversItems(appliesTo, items)) {
            return res.status(400).json({
                valid: false,
                error: `Coupon code '${cleanCode}' applies only to the ${appliesToLabel(appliesTo)}.`
            });
        }

        const percentage = Number(coupon.discount_percentage);

        return res.json({
            valid: true,
            discount: {
                id: coupon.id,
                code: coupon.code,
                type: 'percentage',
                value: percentage,
                discount_percentage: percentage,
                applies_to: appliesTo,
                description: coupon.description || `${percentage}% off your order`,
            }
        });
    } catch (err) {
        console.error('[Coupons VALIDATE] Error:', err);
        return res.status(500).json({ valid: false, error: 'Failed to validate coupon code' });
    }
};

// Admin surface: mounted at /api/coupons behind requireAdmin (list / create / update / delete / validate).
router.post('/validate', validateCoupon);

// Public surface: mounted at /api/public/coupons. It exposes ONLY coupon validation, which the
// checkout needs. It must never share the admin router, which has no authentication of its own.
const publicRouter = express.Router();
publicRouter.post('/validate', validateCoupon);

module.exports = router;
module.exports.publicRouter = publicRouter;
