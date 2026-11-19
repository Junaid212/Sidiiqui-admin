const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'offer-')), 'offer_banner.json');
process.env.OFFER_BANNER_FILE = tmp;
const store = require('../src/utils/offerBannerStore');
const router = require('../src/routes/offerBanner');

function start() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const r = req.headers['x-test-role']; req.user = r ? { app_metadata: { role: r } } : { app_metadata: {} }; next(); });
  app.use('/api/offer-banner', router);
  app.get('/api/public/offer-banner', (req, res) => res.json(store.publicView()));
  return new Promise((r) => { const s = app.listen(0, () => r(s)); });
}
const put = (base, b, role = 'admin') => fetch(`${base}/api/offer-banner`, { method: 'PUT', headers: { 'content-type': 'application/json', ...(role ? { 'x-test-role': role } : {}) }, body: JSON.stringify(b) });
const pub = async (base) => (await fetch(`${base}/api/public/offer-banner`)).json();
const reset = () => { try { fs.unlinkSync(tmp); } catch { /* none */ } };

test('OB1. default: the agreed launch text in maroon, coupon marked bold, button offer OFF', async () => {
  reset();
  const s = await start(); const base = `http://127.0.0.1:${s.address().port}`;
  const j = await pub(base);
  assert.strictEqual(j.enabled, true);
  assert.match(j.text, /Launch offer: \$29\.99 \(save \$20\) for the first 100 buyers, until 30 November\. Use code \*\*LAUNCH30\*\* at checkout\./);
  assert.strictEqual(j.backgroundColor, '#A3192F');
  assert.strictEqual(j.textColor, '#FFFFFF');
  assert.strictEqual(j.cta.enabled, false, 'the button offer must be switched on deliberately by the administrator');
  assert.strictEqual(j.cta.autoApply, false, 'the button must say "with code" until the administrator has tested automatic application');
  assert.ok(store.readBanner().endsAt === '2026-11-30', 'ends by itself at the end of 30 November unless the administrator changes it');
  assert.strictEqual(j.cta.offerPrice, 29.99); assert.strictEqual(j.cta.originalPrice, 49.99); assert.strictEqual(j.cta.couponCode, 'LAUNCH30');
  s.close();
});

test('OB2. admin can edit text/colour and switch it off; public sees it; bad input is sanitised', async () => {
  reset();
  const s = await start(); const base = `http://127.0.0.1:${s.address().port}`;
  let r = await put(base, { enabled: true, text: '  New offer  ', backgroundColor: 'red', textColor: '#000000' });
  assert.strictEqual(r.status, 200);
  let j = await pub(base);
  assert.strictEqual(j.text, 'New offer');
  assert.strictEqual(j.backgroundColor, '#A3192F', 'invalid colour falls back to maroon');
  assert.strictEqual(j.textColor, '#000000');
  r = await put(base, { enabled: true, text: '   ' });
  assert.strictEqual(r.status, 400, 'empty text refused while on');
  r = await put(base, { enabled: false, text: 'x'.repeat(500) });
  assert.strictEqual(r.status, 200);
  j = await pub(base);
  assert.strictEqual(j.enabled, false);
  assert.strictEqual(j.text.length, 300);
  s.close();
});

test('OB3. a signed-in non-administrator can read but cannot change the offer', async () => {
  reset();
  const s = await start(); const base = `http://127.0.0.1:${s.address().port}`;
  const r = await put(base, { enabled: true, text: 'hacked' }, null);
  assert.strictEqual(r.status, 403);
  const r2 = await put(base, { enabled: true, text: 'hacked' }, 'customer');
  assert.strictEqual(r2.status, 403);
  assert.notStrictEqual((await pub(base)).text, 'hacked');
  s.close();
});

test('OB4. button offer: validated, stored, shown publicly', async () => {
  reset();
  const s = await start(); const base = `http://127.0.0.1:${s.address().port}`;
  const good = { enabled: true, text: 'Offer **SAVE**', endsAt: null, cta: { enabled: true, offerPrice: '29.99', originalPrice: 49.99, couponCode: ' launch30 ', badgeText: 'LAUNCH OFFER', note: 'Coming soon', checkoutUrl: '' } };
  let r = await put(base, good);
  assert.strictEqual(r.status, 200, await r.clone().text());
  let j = await pub(base);
  assert.deepStrictEqual({ e: j.cta.enabled, p: j.cta.offerPrice, o: j.cta.originalPrice, c: j.cta.couponCode }, { e: true, p: 29.99, o: 49.99, c: 'LAUNCH30' });
  r = await put(base, { ...good, cta: { ...good.cta, offerPrice: 49.99 } }); assert.strictEqual(r.status, 400, 'offer price must be lower');
  r = await put(base, { ...good, cta: { ...good.cta, offerPrice: 60 } }); assert.strictEqual(r.status, 400);
  r = await put(base, { ...good, cta: { ...good.cta, couponCode: '', checkoutUrl: '' } }); assert.strictEqual(r.status, 400, 'a coupon or checkout link is needed');
  r = await put(base, { ...good, cta: { ...good.cta, checkoutUrl: 'https://evil.example/b/abc' } }); assert.strictEqual(r.status, 400, 'only Payhip links');
  r = await put(base, { ...good, cta: { ...good.cta, checkoutUrl: 'javascript:alert(1)' } }); assert.strictEqual(r.status, 400);
  r = await put(base, { ...good, cta: { ...good.cta, couponCode: 'A B<script>' } }); assert.strictEqual(r.status, 400, 'bad coupon characters');
  assert.strictEqual((await pub(base)).cta.couponCode, 'LAUNCH30', 'refused attempts changed nothing');
  r = await put(base, { ...good, cta: { ...good.cta, checkoutUrl: 'https://payhip.com/b/2H0Wr?coupon=LAUNCH30' } }); assert.strictEqual(r.status, 200);
  assert.strictEqual((await pub(base)).cta.checkoutUrl, 'https://payhip.com/b/2H0Wr?coupon=LAUNCH30');
  s.close();
});

test('OB5. the offer switches itself off after its end date (end of day, Gulf time) - banner and button', () => {
  reset();
  store.saveBanner({ enabled: true, text: 'x', endsAt: '2026-11-30', cta: { enabled: true, offerPrice: 29.99, originalPrice: 49.99, couponCode: 'LAUNCH30' } });
  const before = store.publicView(new Date('2026-11-30T19:59:00Z')); // 23:59 Gulf time
  assert.strictEqual(before.enabled, true); assert.strictEqual(before.cta.enabled, true);
  const after = store.publicView(new Date('2026-11-30T20:00:30Z')); // 00:00:30 on 1 Dec Gulf time
  assert.strictEqual(after.enabled, false); assert.strictEqual(after.cta.enabled, false);
  assert.throws(() => store.saveBanner({ enabled: true, text: 'x', endsAt: '30/11/2026' }), /end date/);
  reset();
});

test('OB7. each edition has its OWN offer: Online and Companion are saved, validated and published separately', async () => {
  reset();
  const s = await start(); const base = `http://127.0.0.1:${s.address().port}`;
  const d = await pub(base);
  assert.strictEqual(d.onlineCta.enabled, false, 'the Online offer is OFF until the administrator switches it on');
  assert.strictEqual(d.onlineCta.caption, 'Read the complete book online.');
  assert.strictEqual(d.cta.caption, 'Book PDF, Companion Pack, online reading and 12 months of Ask SID.');
  const body = {
    enabled: true, text: 'x', endsAt: '2026-11-30',
    cta: { enabled: true, offerPrice: 29.99, originalPrice: 49.99, couponCode: 'LAUNCH30', badgeText: 'LAUNCH OFFER' },
    onlineCta: { enabled: true, offerPrice: '15', originalPrice: 20, couponCode: ' online15 ', badgeText: 'ONLINE OFFER' },
  };
  let r = await put(base, body); assert.strictEqual(r.status, 200, await r.clone().text());
  let j = await pub(base);
  assert.deepStrictEqual({ e: j.onlineCta.enabled, p: j.onlineCta.offerPrice, o: j.onlineCta.originalPrice, c: j.onlineCta.couponCode, b: j.onlineCta.badgeText }, { e: true, p: 15, o: 20, c: 'ONLINE15', b: 'ONLINE OFFER' });
  assert.deepStrictEqual({ p: j.cta.offerPrice, c: j.cta.couponCode, b: j.cta.badgeText }, { p: 29.99, c: 'LAUNCH30', b: 'LAUNCH OFFER' }, 'the Companion offer is untouched by the Online one');
  // switching ONE edition off leaves the other on
  r = await put(base, { ...body, onlineCta: { ...body.onlineCta, enabled: false } }); assert.strictEqual(r.status, 200);
  j = await pub(base); assert.strictEqual(j.onlineCta.enabled, false); assert.strictEqual(j.cta.enabled, true);
  // each edition is validated on its own, and the message names it
  r = await put(base, { ...body, onlineCta: { ...body.onlineCta, offerPrice: 20 } }); assert.strictEqual(r.status, 400);
  assert.match((await r.json()).error, /Online Reading offer: the offer price must be lower/);
  r = await put(base, { ...body, onlineCta: { ...body.onlineCta, couponCode: '' } }); assert.strictEqual(r.status, 400, 'an Online offer needs its own coupon code');
  r = await put(base, { ...body, onlineCta: { ...body.onlineCta, couponCode: 'A B<x>' } }); assert.strictEqual(r.status, 400);
  r = await put(base, { ...body, cta: { ...body.cta, offerPrice: 60 } }); assert.strictEqual(r.status, 400);
  assert.match((await r.json()).error, /Digital Companion offer/);
  // a switched-off edition is not validated (nothing is shown for it)
  r = await put(base, { ...body, onlineCta: { enabled: false, offerPrice: 99, originalPrice: 1, couponCode: '' } }); assert.strictEqual(r.status, 200);
  s.close();
});

test('OB8. each edition ends on its own date; with no date of its own it follows the banner date', () => {
  reset();
  store.saveBanner({
    enabled: true, text: 'x', endsAt: '2026-11-30',
    cta: { enabled: true, offerPrice: 29.99, originalPrice: 49.99, couponCode: 'LAUNCH30', endsAt: '' },
    onlineCta: { enabled: true, offerPrice: 15, originalPrice: 20, couponCode: 'ONLINE15', endsAt: '2026-12-15' },
  });
  const nov30 = store.publicView(new Date('2026-11-30T19:59:00Z'));
  assert.strictEqual(nov30.cta.enabled, true); assert.strictEqual(nov30.onlineCta.enabled, true);
  const dec1 = store.publicView(new Date('2026-12-01T10:00:00Z'));
  assert.strictEqual(dec1.enabled, false, 'banner over');
  assert.strictEqual(dec1.cta.enabled, false, 'Companion has no date of its own: follows the banner');
  assert.strictEqual(dec1.onlineCta.enabled, true, 'Online runs to its own later date');
  const dec16 = store.publicView(new Date('2026-12-15T20:00:30Z'));
  assert.strictEqual(dec16.onlineCta.enabled, false);
  // an EARLIER edition date ends that edition first while the other carries on
  store.saveBanner({ enabled: true, text: 'x', endsAt: '2026-11-30', cta: { enabled: true, offerPrice: 29.99, originalPrice: 49.99, couponCode: 'LAUNCH30', endsAt: '2026-11-20' }, onlineCta: { enabled: true, offerPrice: 15, originalPrice: 20, couponCode: 'O15' } });
  const nov21 = store.publicView(new Date('2026-11-21T10:00:00Z'));
  assert.strictEqual(nov21.cta.enabled, false); assert.strictEqual(nov21.onlineCta.enabled, true);
  assert.throws(() => store.saveBanner({ enabled: true, text: 'x', onlineCta: { enabled: true, offerPrice: 15, originalPrice: 20, couponCode: 'O15', endsAt: '15/12/2026' } }), /Online Reading offer: the end date/);
  reset();
});

test('OB9. a setup saved BEFORE the Online offer existed still works: Companion unchanged, Online off, captions filled in', () => {
  reset();
  fs.writeFileSync(tmp, JSON.stringify({ enabled: true, text: 'Old', endsAt: '2026-11-30', cta: { enabled: true, offerPrice: 29.99, originalPrice: 49.99, couponCode: 'LAUNCH30', badgeText: 'LAUNCH OFFER', note: 'n', autoApply: false, checkoutUrl: 'https://payhip.com/b/2H0Wr?coupon=LAUNCH30' } }));
  const v = store.publicView(new Date('2026-11-18T10:00:00Z'));
  assert.strictEqual(v.cta.enabled, true); assert.strictEqual(v.cta.checkoutUrl, 'https://payhip.com/b/2H0Wr?coupon=LAUNCH30');
  assert.strictEqual(v.onlineCta.enabled, false);
  assert.strictEqual(v.cta.caption, 'Book PDF, Companion Pack, online reading and 12 months of Ask SID.');
  assert.strictEqual(v.onlineCta.caption, 'Read the complete book online.');
  reset();
});

test('OB6. autoApply is stored only when explicitly true; an empty end date means "no automatic end"', async () => {
  reset();
  const s = await start(); const base = `http://127.0.0.1:${s.address().port}`;
  let r = await put(base, { enabled: true, text: 'x', endsAt: '', cta: { enabled: true, offerPrice: 29.99, originalPrice: 49.99, couponCode: 'LAUNCH30', autoApply: 'yes' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual((await pub(base)).cta.autoApply, false, 'only a real true counts');
  assert.strictEqual(store.readBanner().endsAt, null);
  r = await put(base, { enabled: true, text: 'x', endsAt: '', cta: { enabled: true, offerPrice: 29.99, originalPrice: 49.99, couponCode: 'LAUNCH30', autoApply: true } });
  assert.strictEqual((await pub(base)).cta.autoApply, true);
  s.close();
});
