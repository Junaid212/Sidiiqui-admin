const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { getAskSidSettings, updateAskSidSettings } = require('../utils/askSidSettingsStore');

// GET /api/ask-sid/settings — Read current Ask SID settings & list of products for dropdown
router.get('/settings', async (req, res) => {
  try {
    const settings = await getAskSidSettings();

    // Fetch active digital products to let admin map products dynamically
    let products = [];
    try {
      const { data, error } = await supabaseAdmin
        .from('ebooks')
        .select('id, title, price, currency, slug')
        .order('title', { ascending: true });
      if (!error && data) {
        products = data;
      }
    } catch (dbErr) {
      console.warn('[askSid.js] Could not load products:', dbErr.message);
    }

    return res.json({
      settings,
      products
    });
  } catch (err) {
    console.error('[askSid.js] GET /settings error:', err);
    return res.status(500).json({ error: 'Failed to load Ask SID settings' });
  }
});

// PUT /api/ask-sid/settings — Update Ask SID settings
router.put('/settings', async (req, res) => {
  try {
    const {
      askSidEnabled,
      publicDemoEnabled,
      demoQuestionLimit,
      fullAccessProductId,
      onlineEditionProductId,
      upgradeCtaText,
      upgradeUrl,
      advisoryCtaEnabled,
      advisoryUrl
    } = req.body;

    const updated = await updateAskSidSettings({
      askSidEnabled: askSidEnabled !== undefined ? Boolean(askSidEnabled) : true,
      publicDemoEnabled: publicDemoEnabled !== undefined ? Boolean(publicDemoEnabled) : true,
      demoQuestionLimit: Math.max(1, Number(demoQuestionLimit) || 1),
      fullAccessProductId: fullAccessProductId ? String(fullAccessProductId).trim() : "04b84648-3609-4b31-9ded-2486bacf1e74",
      onlineEditionProductId: onlineEditionProductId ? String(onlineEditionProductId).trim() : "prod_online_reading_001",
      upgradeCtaText: upgradeCtaText ? String(upgradeCtaText).trim() : "Unlock Full Ask SID with the Digital Companion Edition ($49.99)",
      upgradeUrl: upgradeUrl ? String(upgradeUrl).trim() : "/publications/marketing-reclassified-principle-first-approach",
      advisoryCtaEnabled: advisoryCtaEnabled !== undefined ? Boolean(advisoryCtaEnabled) : true,
      advisoryUrl: advisoryUrl ? String(advisoryUrl).trim() : "/consultation"
    });

    return res.json({
      success: true,
      message: 'Ask SID settings updated successfully',
      settings: updated
    });
  } catch (err) {
    console.error('[askSid.js] PUT /settings error:', err);
    return res.status(500).json({ error: 'Failed to update Ask SID settings' });
  }
});

module.exports = router;
