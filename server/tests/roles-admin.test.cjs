/**
 * Tests for the ADMIN ROLES (Owner / Editor / Support) and the Team screen's API.  Run (from the server folder):  node --test tests/roles-admin.test.cjs
 * The real src/index.js is started with its Supabase client and mailer replaced by in-memory fakes (tests/helpers/preload-fake-admin-deps.cjs);
 * users there are live, so adding, changing and removing a person really changes what their token may do.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SERVER = path.resolve(__dirname, '..');
const PORT = 58000 + Math.floor(Math.random() * 900);
const LOG = path.join(os.tmpdir(), `admin-roles-${process.pid}-${Date.now()}.log`);
let child;
const readLog = () => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const uuid = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const ID = { owner: 'a0000000-0000-4000-8000-000000000001', editor: 'e0000000-0000-4000-8000-000000000001', support: 'e0000000-0000-4000-8000-000000000002', owner2: 'e0000000-0000-4000-8000-000000000003' };

function call(method, urlPath, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port: PORT, path: urlPath, method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) } }, (res) => {
      let text = ''; res.on('data', (c) => (text += c));
      res.on('end', () => { let json = null; try { json = JSON.parse(text); } catch { /* not json */ } resolve({ status: res.statusCode, json, text }); });
    });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test.before(async () => {
  child = spawn(process.execPath, ['-r', path.join(__dirname, 'helpers', 'preload-fake-admin-deps.cjs'), path.join(SERVER, 'src', 'index.js')], {
    cwd: SERVER, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT), FAKE_CALL_LOG: LOG, FRONTEND_URL: 'https://admin.siddiqui.digital', ADMIN_EMAIL: 'owner@example.com', SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_ROLE_KEY: 'test', SUPABASE_ANON_KEY: 'test', PUBLIC_SITE_ROOT: '', FRONTEND_INDEX_PATH: '' },
  });
  let out = ''; child.stdout.on('data', (d) => (out += d)); child.stderr.on('data', (d) => (out += d));
  for (let i = 0; i < 100; i++) { try { if ((await call('GET', '/api/health')).status === 200) return; } catch { /* starting */ } await sleep(100); }
  throw new Error('admin server did not start:\n' + out.slice(-800));
});
test.after(() => { if (child) child.kill(); if (fs.existsSync(LOG)) fs.unlinkSync(LOG); });

// "allowed" = the role gate let the request through (the route itself may then answer 200, 400, 404 ... but not 401/403)
const allowed = async (token, method, p, body) => { const r = await call(method, p, { token, body }); assert.ok(r.status !== 401 && r.status !== 403, `${token} should be allowed ${method} ${p} but got ${r.status} ${r.text.slice(0, 120)}`); return r; };
const refused = async (token, method, p, body) => { const r = await call(method, p, { token, body }); assert.equal(r.status, 403, `${token} must be refused ${method} ${p} but got ${r.status} ${r.text.slice(0, 120)}`); return r; };

// every dashboard area, with a harmless request for it
const AREAS = {
  dashboard: ['GET', '/api/stats/ebooks'], orders: ['GET', '/api/orders'], 'orders export': ['GET', '/api/orders/export-csv'], coupons: ['GET', '/api/coupons'], products: ['GET', '/api/products'],
  consultations: ['GET', '/api/consultations'], signins: ['GET', '/api/sign-ins-details'], questionnaire: ['GET', '/api/questionnaire/analytics'], metrics: ['GET', '/api/admin/metrics/signins'],
  'launch offer': ['GET', '/api/offer-banner'], customers: ['GET', '/api/entitlements'], 'customers overview': ['GET', '/api/entitlements/overview'], 'audit log': ['GET', '/api/entitlements/audit'],
  webhooks: ['GET', '/api/entitlements/webhooks'], messages: ['GET', '/api/contact-messages'], reading: ['GET', '/api/reading/books'], blog: ['GET', '/api/blogs'], asksid: ['GET', '/api/ask-sid/settings'],
  companion: ['GET', '/api/companion-files'], team: ['GET', '/api/team'],
};
const check = async (token, ok, no) => { for (const k of ok) await allowed(token, ...AREAS[k]); for (const k of no) await refused(token, ...AREAS[k]); };

test('R1. the Owner (every administrator that exists today) can reach every area', async () => {
  await check('admin-token', Object.keys(AREAS), []);
  await check('owner2-token', Object.keys(AREAS), []);
});

test('R2. Editor: Online Reading, Blog, Ask SID settings and Companion Files only', async () => {
  await check('editor-token', ['reading', 'blog', 'asksid', 'companion'], Object.keys(AREAS).filter((k) => !['reading', 'blog', 'asksid', 'companion'].includes(k)));
  // writes inside their own areas pass the gate; everything money-, customer- or settings-related is refused
  await allowed('editor-token', 'PUT', '/api/ask-sid/settings', {});
  await allowed('editor-token', 'POST', '/api/reading/books', { title: '' });
  await allowed('editor-token', 'DELETE', `/api/companion-files/${uuid(1)}`);
  await refused('editor-token', 'PUT', '/api/offer-banner', {});
  await refused('editor-token', 'POST', '/api/entitlements/grant', {});
  await refused('editor-token', 'POST', '/api/orders/remove', {});
  await refused('editor-token', 'POST', '/api/coupons', {});
  await refused('editor-token', 'POST', '/api/team', { email: 'x@example.com', role: 'editor' });
});

test('R3. Support: view orders and customers, grant or revoke reader access, read messages; nothing else', async () => {
  await check('support-token', ['orders', 'customers', 'customers overview', 'messages'], Object.keys(AREAS).filter((k) => !['orders', 'customers', 'customers overview', 'messages'].includes(k)));
  const a = (body) => call('POST', `/api/entitlements/${uuid(5)}/action`, { token: 'support-token', body });
  await allowed('support-token', 'POST', '/api/entitlements/grant', {});                 // reaches the route (it then asks for the details)
  await allowed('support-token', 'POST', '/api/entitlements/reconcile', {});
  assert.notEqual((await a({ action: 'revoke', reason: 'support request' })).status, 403, 'may revoke');
  assert.notEqual((await a({ action: 'restore', reason: 'support request' })).status, 403, 'may restore what they revoked');
  assert.equal((await a({ action: 'extend_months', amount: 3, reason: 'a favour' })).status, 403, 'may NOT extend');
  assert.equal((await a({ action: 'add_questions', amount: 50, reason: 'a favour' })).status, 403, 'may NOT add questions');
  assert.equal((await a({})).status, 403, 'an action they cannot identify is refused');
  await refused('support-token', 'POST', '/api/entitlements/launch', { startsAt: 'now', reason: 'test reason' });
  await refused('support-token', 'POST', '/api/entitlements/import-payhip', { csv: 'x' });
  // cannot change orders or messages, content or settings
  for (const [m, p] of [['POST', '/api/orders/remove'], ['POST', '/api/orders/mark-test'], ['POST', `/api/orders/${uuid(1)}/refund`], ['DELETE', `/api/contact-messages/${uuid(1)}`],
    ['PUT', '/api/reading/books/' + uuid(1)], ['POST', '/api/blogs/' + uuid(1) + '/prerender'], ['PUT', '/api/ask-sid/settings'], ['POST', '/api/companion-files'], ['PUT', '/api/offer-banner'], ['POST', '/api/coupons']]) {
    await refused('support-token', m, p, {});
  }
});

test('R4. customers, people with a user_metadata "admin" claim and anonymous visitors get nothing, including the Team API', async () => {
  for (const t of ['customer-token', 'spoof-token', 'mailbox-token']) { for (const k of ['team', 'orders', 'reading']) await refused(t, ...AREAS[k]); }
  assert.equal((await call('GET', '/api/team')).status, 401);
  assert.equal((await call('POST', '/api/team', { body: { email: 'x@example.com', role: 'editor' } })).status, 401);
});

test('R5. /auth/me tells the dashboard the role and the permissions (the server still checks every request)', async () => {
  const me = async (t) => (await call('GET', '/api/auth/me', { token: t })).json;
  const o = await me('admin-token'); assert.deepEqual([o.isAdmin, o.role, o.roleLabel], [true, 'admin', 'Owner']); assert.ok(o.permissions.includes('team') && o.permissions.includes('orders.manage'));
  const e = await me('editor-token'); assert.deepEqual([e.isAdmin, e.role, e.roleLabel], [true, 'editor', 'Editor']); assert.deepEqual(e.permissions.sort(), ['asksid', 'blog', 'companion', 'reading']);
  const s = await me('support-token'); assert.deepEqual([s.isAdmin, s.role, s.roleLabel], [true, 'support', 'Support']); assert.ok(!s.permissions.includes('coupons') && s.permissions.includes('customers.grant'));
  const c = await me('customer-token'); assert.deepEqual([c.isAdmin, c.role, c.permissions], [false, null, []]);
});

test('R6. Team list: the Owner sees everyone with their role', async () => {
  const r = await call('GET', '/api/team', { token: 'admin-token' });
  assert.equal(r.status, 200);
  const by = Object.fromEntries(r.json.members.map((m) => [m.email, m]));
  assert.equal(by['admin@example.com'].roleLabel, 'Owner'); assert.equal(by['admin@example.com'].isSelf, true);
  assert.equal(by['editor@example.com'].roleLabel, 'Editor'); assert.equal(by['support@example.com'].roleLabel, 'Support'); assert.equal(by['owner2@example.com'].roleLabel, 'Owner');
  assert.ok(!by['cust@example.com'], 'customers are not listed');
  assert.equal(r.json.members[0].role, 'admin', 'owners first');
});

test('R7. adding a person: own account, e-mail to choose their own password, audit entry; only Editor or Support', async () => {
  const before = readLog().length;
  const bad = [{ email: 'nope', role: 'editor' }, { email: 'a@example.com', role: 'admin' }, { email: 'a@example.com', role: 'owner' }, { email: 'a@example.com' }, { role: 'editor' }];
  for (const b of bad) assert.equal((await call('POST', '/api/team', { token: 'admin-token', body: b })).status, 400, JSON.stringify(b));
  const r = await call('POST', '/api/team', { token: 'admin-token', body: { email: '  New.Editor@Example.com ', role: 'editor', redirectTo: 'https://admin.siddiqui.digital' } });
  assert.equal(r.status, 201, r.text);
  assert.deepEqual([r.json.email, r.json.role, r.json.roleLabel, r.json.emailSent, r.json.existingAccount], ['new.editor@example.com', 'editor', 'Editor', true, false]);
  assert.ok(!/password|token_hash/i.test(r.text), 'no password or link is ever returned to the browser');
  const log = readLog().slice(before);
  const mail = log.find((e) => e.call === 'sendMail'); assert.equal(mail.to, 'new.editor@example.com');
  assert.match(mail.html, /https:\/\/admin\.siddiqui\.digital\/reset-password\?token_hash=TOKEN123&type=recovery/, 'a link to choose their own password');
  assert.match(mail.html, /Editor/); assert.doesNotMatch(mail.html, /random|temporary password/i);
  const created = log.find((e) => e.call === 'auth.admin.createUser'); assert.equal(created.email, 'new.editor@example.com');
  const audit = log.find((e) => e.table === 'admin_audit_log' && e.payload && e.payload[0].action === 'team.add');
  assert.ok(audit, 'team.add is in the audit log'); assert.equal(audit.payload[0].actor_label, 'admin@example.com'); assert.equal(audit.payload[0].detail.role, 'editor'); assert.match(audit.payload[0].detail.email, /^n\*\*\*@example\.com$/);
  // the new person can use only the Editor areas, at once
  await check('created:new.editor@example.com', ['reading', 'blog'], ['orders', 'customers', 'coupons', 'team']);
  assert.equal((await call('POST', '/api/team', { token: 'admin-token', body: { email: 'new.editor@example.com', role: 'support' } })).status, 409, 'already has access');
});

test('R8. an existing confirmed account (e.g. a reader) can be given access; an unconfirmed one cannot', async () => {
  const r = await call('POST', '/api/team', { token: 'admin-token', body: { email: 'cust@example.com', role: 'support' } });
  assert.equal(r.status, 201, r.text); assert.equal(r.json.existingAccount, true);
  await check('customer-token', ['orders', 'customers'], ['team', 'reading']);
  assert.equal((await call('POST', '/api/team', { token: 'admin-token', body: { email: 'new@example.com', role: 'editor' } })).status, 409, 'unconfirmed e-mail');
});

test('R9. only an Owner can use the Team API; changing a role takes effect at once; owners and yourself are protected', async () => {
  for (const t of ['editor-token', 'support-token']) {
    await refused(t, 'POST', '/api/team', { email: 'a@example.com', role: 'editor' });
    await refused(t, 'PUT', `/api/team/${ID.editor}`, { role: 'support' });
    await refused(t, 'DELETE', `/api/team/${ID.support}`);
  }
  const r = await call('PUT', `/api/team/${ID.support}`, { token: 'admin-token', body: { role: 'editor' } });
  assert.equal(r.status, 200, r.text);
  await check('support-token', ['reading'], ['orders', 'customers']); // was Support a moment ago: now an Editor
  assert.equal((await call('PUT', `/api/team/${ID.support}`, { token: 'admin-token', body: { role: 'admin' } })).status, 400, 'nobody is made an Owner here');
  assert.equal((await call('PUT', `/api/team/${ID.owner2}`, { token: 'admin-token', body: { role: 'editor' } })).status, 400, "an Owner's role is not changed here");
  assert.equal((await call('PUT', `/api/team/${ID.owner}`, { token: 'admin-token', body: { role: 'editor' } })).status, 400, 'not your own role');
  assert.equal((await call('PUT', `/api/team/${uuid(77)}`, { token: 'admin-token', body: { role: 'editor' } })).status, 404);
  assert.equal((await call('PUT', '/api/team/not-a-uuid', { token: 'admin-token', body: { role: 'editor' } })).status, 400);
});

test('R10. removing a person ends their access at once; you cannot remove yourself; every change is in the audit log', async () => {
  const before = readLog().length;
  assert.equal((await call('DELETE', `/api/team/${ID.owner}`, { token: 'admin-token' })).status, 400, 'not yourself');
  assert.equal((await call('DELETE', `/api/team/${uuid(99)}`, { token: 'admin-token' })).status, 404);
  const r = await call('DELETE', `/api/team/${ID.editor}`, { token: 'admin-token' });
  assert.equal(r.status, 200, r.text);
  const gone = await call('GET', '/api/reading/books', { token: 'editor-token' });
  assert.equal(gone.status, 403, 'the removed Editor is locked out on their very next request'); assert.match(gone.json.error, /Administrator access required/);
  assert.equal((await call('GET', '/api/auth/me', { token: 'editor-token' })).json.isAdmin, false);
  const upd = readLog().slice(before).find((e) => e.call === 'auth.admin.updateUserById' && e.id === ID.editor);
  assert.equal(upd.attrs.app_metadata.role, null, 'the role is cleared with null (Supabase merges app_metadata, so leaving the key out would keep it)');
  // an Owner may be removed by another Owner, and the person is then locked out
  assert.equal((await call('DELETE', `/api/team/${ID.owner2}`, { token: 'admin-token' })).status, 200);
  assert.equal((await call('GET', '/api/orders', { token: 'owner2-token' })).status, 403);
  assert.equal((await call('GET', '/api/team', { token: 'admin-token' })).json.members.some((m) => m.id === ID.owner2), false, 'no longer listed');
  // the last Owner cannot remove themselves
  assert.equal((await call('DELETE', `/api/team/${ID.owner}`, { token: 'admin-token' })).status, 400);
  const actions = readLog().slice(before).filter((e) => e.table === 'admin_audit_log').map((e) => e.payload[0].action);
  assert.ok(actions.filter((a) => a === 'team.remove').length === 2, 'both removals are recorded: ' + actions.join(','));
});

test('R11. the audit log records EVERY change an administrator makes and every refused request, with who and in which role', async () => {
  const before = readLog().length;
  await call('PUT', '/api/ask-sid/settings', { token: 'admin-token', body: {} });                 // a change that has no entry of its own
  await call('POST', `/api/reading/books/${uuid(3)}/chapters`, { token: 'owner2-token', body: {} }); // (owner2 was removed above: refused)
  await call('POST', '/api/orders/remove', { token: 'support-token', body: {} });                  // Editor-now person: refused
  await call('GET', '/api/orders', { token: 'admin-token' });                                       // plain reads are not logged
  await sleep(150);
  const rows = readLog().slice(before).filter((e) => e.table === 'admin_audit_log').map((e) => e.payload[0]);
  const change = rows.find((r) => r.action === 'admin.request' && r.target_id === 'PUT /api/ask-sid/settings');
  assert.ok(change, 'the settings change is logged: ' + JSON.stringify(rows)); assert.equal(change.actor_label, 'admin@example.com'); assert.equal(change.detail.role, 'admin'); assert.equal(change.detail.method, 'PUT');
  const denied = rows.find((r) => r.action === 'admin.denied' && r.target_id === 'POST /api/orders/remove');
  assert.ok(denied, 'the refused attempt is logged'); assert.equal(denied.actor_label, 'support@example.com'); assert.equal(denied.detail.role, 'editor');
  assert.ok(!rows.some((r) => r.target_id === 'GET /api/orders'), 'ordinary reads are not logged');
  assert.ok(rows.every((r) => !('body' in r.detail)), 'request bodies (which may hold personal data) are never stored');
  assert.ok(rows.every((r) => !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(r.target_id)), 'ids are replaced by :id');
});

test('R12. the permission table: Owner has everything; unknown or missing roles have nothing', () => {
  const P = require('../src/utils/permissions');
  for (const p of P.ALL) assert.ok(P.can('admin', p), `owner: ${p}`);
  assert.equal(P.can('editor', 'orders.view'), false); assert.equal(P.can('support', 'reading'), false); assert.equal(P.can(null, 'dashboard'), false); assert.equal(P.can('hacker', 'dashboard'), false);
  assert.equal(P.roleOf({ app_metadata: { role: 'editor' } }), 'editor'); assert.equal(P.roleOf({ app_metadata: { roles: ['admin'] } }), 'admin');
  assert.equal(P.roleOf({ user_metadata: { role: 'admin' } }), null, 'only app_metadata counts'); assert.equal(P.roleOf({ app_metadata: { role: null } }), null);
  assert.equal(P.roleOf({ app_metadata: { role: 'superuser' } }), null);
});
