/**
 * offerBannerStore.js - the launch offer shown on the Marketing Reclassified landing page:
 *   (1) the slim "Offer label" banner above the hero, and
 *   (2) the offer on the Digital Companion call-to-action button (offer price, badge, coupon code).
 * Edited by an administrator in the dashboard (Products page); read publicly by the website.
 *
 * Stored in a small JSON file (same pattern as the other local settings), so no database
 * change is needed. If the file is missing the DEFAULT below applies.
 *
 * IMPORTANT: the CHECKOUT price is decided by Payhip, not by this file. The button only shows the offer
 * price and sends the buyer to Payhip with the coupon code; the Payhip coupon must really give that price.
 * That is why the button offer is OFF by default and only the administrator switches it on.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const FILE = process.env.OFFER_BANNER_FILE || path.join(DATA_DIR, 'offer_banner.json');

// Each edition has its OWN offer (they are different products and may have different offers):
//   cta       = Digital Companion edition            onlineCta = Online Reading edition
// Per edition: on/off, offer price, original price, coupon code, badge text, end date (endsAt) and the small line under its button (caption).
// An empty per-edition end date follows the banner's end date (so a setup saved before this existed behaves exactly as before).
const DEFAULT_BANNER = {
  enabled: true,
  text: 'Launch offer: $29.99 (save $20) for the first 100 buyers, until 30 November. Use code **LAUNCH30** at checkout.',
  backgroundColor: '#A3192F',
  textColor: '#FFFFFF',
  endsAt: '2026-11-30', // 'YYYY-MM-DD' - the offer (banner AND buttons) switches itself off after the end of that day, Gulf time (UTC+4). Empty = ends only by hand.
  cta: {
    enabled: false,
    offerPrice: 29.99,
    originalPrice: 49.99,
    couponCode: 'LAUNCH30',
    badgeText: 'LAUNCH OFFER',
    note: 'Online reading and Ask SID: coming soon, free for Companion buyers.',
    caption: 'Book PDF, Companion Pack, online reading and 12 months of Ask SID.',
    endsAt: '',
    autoApply: false, // true only after the administrator has TESTED that the checkout link applies the code by itself
    checkoutUrl: '',
  },
  onlineCta: {
    enabled: false,
    offerPrice: 15,
    originalPrice: 20,
    couponCode: '',
    badgeText: 'LAUNCH OFFER',
    note: '',
    caption: 'Read the complete book online.',
    endsAt: '',
    autoApply: false,
    checkoutUrl: '',
  },
  updatedAt: null,
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COUPON = /^[A-Z0-9_-]{2,40}$/;
const PAYHIP_URL = /^https:\/\/payhip\.com\/b\/[A-Za-z0-9]+(\?[^\s"'<>]*)?$/;

function err(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}

function money(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n >= 100000) return fallback;
  return Math.round(n * 100) / 100;
}

const validDate = (v) => !!v && DATE.test(String(v)) && !Number.isNaN(Date.parse(String(v) + 'T00:00:00Z'));

/** One edition's offer. `d` = that edition's defaults, `label` = how errors name it. */
function normaliseCta(raw, d, label, strict) {
  const c = raw && typeof raw === 'object' ? raw : {};

  const couponRaw = typeof c.couponCode === 'string' ? c.couponCode.trim().toUpperCase() : d.couponCode;
  if (strict && couponRaw && !COUPON.test(couponRaw)) throw err(`${label}: the coupon code may only contain letters, numbers, - and _.`);

  const urlRaw = typeof c.checkoutUrl === 'string' ? c.checkoutUrl.trim() : '';
  if (strict && urlRaw && !PAYHIP_URL.test(urlRaw)) throw err(`${label}: the checkout link must be a Payhip product link such as https://payhip.com/b/2H0Wr`);

  // the edition's own end date; empty = follows the banner's end date
  let endsAt = '';
  if (validDate(c.endsAt)) endsAt = String(c.endsAt);
  else if (strict && c.endsAt) throw err(`${label}: the end date must look like 2026-11-30.`);

  return {
    enabled: c.enabled === true,
    offerPrice: money(c.offerPrice, d.offerPrice),
    originalPrice: money(c.originalPrice, d.originalPrice),
    couponCode: COUPON.test(couponRaw) ? couponRaw : '',
    badgeText: (typeof c.badgeText === 'string' ? c.badgeText.trim() : d.badgeText).slice(0, 30),
    note: (typeof c.note === 'string' ? c.note.trim() : d.note).slice(0, 200),
    caption: (typeof c.caption === 'string' ? c.caption.trim() : d.caption).slice(0, 200),
    endsAt,
    autoApply: c.autoApply === true,
    checkoutUrl: PAYHIP_URL.test(urlRaw) ? urlRaw : '',
  };
}

function normalise(input, { strict = false } = {}) {
  const src = input && typeof input === 'object' ? input : {};

  const text = typeof src.text === 'string' ? src.text.trim() : DEFAULT_BANNER.text;

  // a missing endsAt means the default end date; an explicit empty value (or null) means "no automatic end"
  let endsAt = Object.prototype.hasOwnProperty.call(src, 'endsAt') ? null : DEFAULT_BANNER.endsAt;
  if (validDate(src.endsAt)) endsAt = String(src.endsAt);
  else if (strict && src.endsAt) throw err('The end date must look like 2026-11-30.');

  return {
    enabled: src.enabled !== false,
    text: text.slice(0, 300),
    backgroundColor: HEX.test(src.backgroundColor || '') ? src.backgroundColor : DEFAULT_BANNER.backgroundColor,
    textColor: HEX.test(src.textColor || '') ? src.textColor : DEFAULT_BANNER.textColor,
    endsAt,
    cta: normaliseCta(src.cta, DEFAULT_BANNER.cta, 'Digital Companion offer', strict),
    onlineCta: normaliseCta(src.onlineCta, DEFAULT_BANNER.onlineCta, 'Online Reading offer', strict),
    updatedAt: src.updatedAt || null,
  };
}

function readBanner() {
  try {
    if (fs.existsSync(FILE)) return normalise(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  } catch (e) {
    console.warn('[offerBannerStore] could not read settings, using default:', e.message);
  }
  return normalise({});
}

function saveBanner(input) {
  const next = normalise(input, { strict: true });
  if (next.enabled && !next.text) throw err('Offer label text is required while the banner is switched on.');
  for (const [c, label] of [[next.cta, 'Digital Companion offer'], [next.onlineCta, 'Online Reading offer']]) {
    if (!c.enabled) continue;
    if (c.offerPrice >= c.originalPrice) throw err(`${label}: the offer price must be lower than the original price.`);
    if (!c.couponCode && !c.checkoutUrl) throw err(`${label}: add the coupon code (or a Payhip checkout link) that gives the offer price.`);
  }
  next.updatedAt = new Date().toISOString();
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

/** True once the end date has passed (end of that day, Gulf time UTC+4). */
function isExpired(b, now = new Date()) {
  if (!b.endsAt) return false;
  const end = Date.parse(b.endsAt + 'T23:59:59.999+04:00');
  return Number.isFinite(end) && now.getTime() > end;
}

/** What the PUBLIC website receives. Expired offers are switched off here, so nothing stale is ever shown. */
function publicView(now = new Date()) {
  const b = readBanner();
  const live = !isExpired(b, now);
  // an edition's offer ends on ITS OWN date (or on the banner's date when it has none). The caption (small line under the button) is
  // always sent: it is shown with or without an offer.
  const edition = (c) => ({
    enabled: c.enabled && !isExpired({ endsAt: c.endsAt || b.endsAt }, now),
    offerPrice: c.offerPrice,
    originalPrice: c.originalPrice,
    couponCode: c.couponCode,
    badgeText: c.badgeText,
    note: c.note,
    caption: c.caption,
    autoApply: c.autoApply,
    checkoutUrl: c.checkoutUrl,
  });
  return {
    enabled: live && b.enabled && !!b.text,
    text: b.text,
    backgroundColor: b.backgroundColor,
    textColor: b.textColor,
    cta: edition(b.cta),
    onlineCta: edition(b.onlineCta),
  };
}

module.exports = { readBanner, saveBanner, publicView, isExpired, DEFAULT_BANNER };
