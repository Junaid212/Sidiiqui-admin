const express = require('express');
const { readBanner, saveBanner } = require('../utils/offerBannerStore');

// Mounted behind requireAdmin at /api/offer-banner
const router = express.Router();

router.get('/', (req, res) => {
  res.json(readBanner());
});

// Writing needs the administrator role (app_metadata.role = 'admin'). This holds even if the login check in front of the
// router only proves "a signed-in user", because customers share this Supabase project.
function requireAdminRole(req, res, next) {
  const role = req.user && req.user.app_metadata && req.user.app_metadata.role;
  if (role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  next();
}

router.put('/', requireAdminRole, (req, res) => {
  try {
    const body = req.body || {};
    res.json(saveBanner({
      enabled: body.enabled,
      text: body.text,
      backgroundColor: body.backgroundColor,
      textColor: body.textColor,
      endsAt: body.endsAt,
      cta: body.cta,
      onlineCta: body.onlineCta,
    }));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Could not save the offer label.' });
  }
});

module.exports = router;
