/**
 * Stage 0 security tests for the ADMIN server.  Run (from the server folder):  node --test tests/*.test.cjs
 *
 * The real src/index.js is started (random port) with its Supabase client and mailer replaced by
 * in-memory fakes (tests/helpers/preload-fake-admin-deps.cjs). No network, database or e-mail is used.
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
const INDEX_SRC = fs.readFileSync(path.join(SERVER, 'src', 'index.js'), 'utf8');
const PORT = 56000 + Math.floor(Math.random() * 1000);
const LOG = path.join(os.tmpdir(), `admin-stage0-${process.pid}-${Date.now()}.log`);
let child;

const readLog = () => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

function call(method, urlPath, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port: PORT, path: urlPath, method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) },
    }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => { let json = null; try { json = JSON.parse(text); } catch { /* not json */ } resolve({ status: res.statusCode, json, text }); });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

test.before(async () => {
  child = spawn(process.execPath, ['-r', path.join(__dirname, 'helpers', 'preload-fake-admin-deps.cjs'), path.join(SERVER, 'src', 'index.js')], {
    cwd: SERVER,
    env: {
      ...process.env, PORT: String(PORT), FAKE_CALL_LOG: LOG, FRONTEND_URL: 'https://admin.siddiqui.digital',
      ADMIN_EMAIL: 'owner@example.com', SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_ROLE_KEY: 'test', SUPABASE_ANON_KEY: 'test',
      PUBLIC_SITE_ROOT: '', FRONTEND_INDEX_PATH: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  for (let i = 0; i < 100; i++) {
    try { const r = await call('GET', '/api/health'); if (r.status === 200) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('admin server did not start:\n' + out.slice(-800));
});
test.after(() => { if (child) child.kill(); if (fs.existsSync(LOG)) fs.unlinkSync(LOG); });

// ---------------------------------------------------------------------------------------------
// A. Administrator authorisation
// ---------------------------------------------------------------------------------------------
// A dashboard mount is guarded either by requireAdmin directly, or by the `staff` list (requireAdmin + the audit log) followed by a role permission (utils/permissions.js).
const STAFF_LIST = /^const staff = \[requireAdmin,/m.test(INDEX_SRC);
const mounts = [...INDEX_SRC.matchAll(/^app\.use\('(\/api\/[^']+)',\s*(requireAdmin|requireAuth|\.\.\.staff)\s*,/gm)].map((m) => ({ route: m[1], guard: m[2] === '...staff' && STAFF_LIST ? 'requireAdmin' : m[2] }));

test('A0. every dashboard mount in index.js is guarded by requireAdmin (never plain requireAuth)', () => {
  assert.ok(mounts.length >= 13, `found ${mounts.length} guarded mounts`);
  assert.deepEqual(mounts.filter((m) => m.guard !== 'requireAdmin'), []);
  assert.ok(!/const \{[^}]*requireAuth[^}]*\} = require\('\.\/middleware\/auth'\)/.test(INDEX_SRC), 'index.js no longer imports requireAuth');
});

test('A1. isAdminUser trusts only app_metadata (server-controlled), nothing a user can edit', () => {
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'; process.env.SUPABASE_ANON_KEY = 'x';
  const { isAdminUser } = require('../src/middleware/auth');
  assert.equal(isAdminUser({ app_metadata: { role: 'admin' } }), true);
  assert.equal(isAdminUser({ app_metadata: { roles: ['editor', 'admin'] } }), true);
  assert.equal(isAdminUser({ app_metadata: {}, user_metadata: { role: 'admin' } }), false);
  assert.equal(isAdminUser({ app_metadata: { role: 'customer' } }), false);
  assert.equal(isAdminUser({ email: 'owner@example.com', app_metadata: {} }), false);
  assert.equal(isAdminUser(null), false);
  assert.equal(isAdminUser({}), false);
});

for (const { route } of mounts) {
  test(`A2. ${route}: no token -> 401, customer -> 403, user_metadata spoof -> 403, ADMIN_EMAIL mailbox -> 403, administrator -> allowed`, async () => {
    assert.equal((await call('GET', route)).status, 401, 'no token');
    assert.equal((await call('GET', route, { token: 'garbage' })).status, 401, 'invalid token');
    for (const token of ['customer-token', 'spoof-token', 'mailbox-token']) {
      const r = await call('GET', route, { token });
      assert.equal(r.status, 403, `${token} must be refused`);
      assert.equal(r.json && r.json.error, 'Administrator access required');
    }
    const ok = await call('GET', route, { token: 'admin-token' });
    assert.ok(![401, 403].includes(ok.status), `administrator must pass the guard (got ${ok.status})`);
  });
}

test('A3. write methods are refused for a customer on the most sensitive routes', async () => {
  for (const [method, p] of [['POST', '/api/products'], ['DELETE', '/api/products/1'], ['POST', '/api/coupons'], ['DELETE', '/api/coupons/1'], ['POST', '/api/blogs'], ['DELETE', '/api/blogs/1'], ['POST', '/api/orders/1/refund'], ['PATCH', '/api/consultations/1']]) {
    const r = await call(method, p, { token: 'customer-token', body: {} });
    assert.equal(r.status, 403, `${method} ${p}`);
  }
  assert.deepEqual(readLog().filter((e) => e.op), [], 'nothing was written by a refused request');
});

test('A4. administrator login flow still works (sign-in route, /me reports isAdmin)', async () => {
  const bad = await call('POST', '/api/auth/sign-in', { body: { email: 'admin@example.com', password: 'wrong' } });
  assert.equal(bad.status, 400);
  const good = await call('POST', '/api/auth/sign-in', { body: { email: 'admin@example.com', password: 'correct-password' } });
  assert.equal(good.status, 200);
  assert.ok(good.json.session && good.json.session.access_token);
  const meAdmin = await call('GET', '/api/auth/me', { token: 'admin-token' });
  assert.equal(meAdmin.status, 200); assert.equal(meAdmin.json.isAdmin, true);
  const meCust = await call('GET', '/api/auth/me', { token: 'customer-token' });
  assert.equal(meCust.status, 200); assert.equal(meCust.json.isAdmin, false);
  assert.equal((await call('GET', '/api/auth/me')).status, 401);
});

// ---------------------------------------------------------------------------------------------
// B. Public admin sign-up is closed
// ---------------------------------------------------------------------------------------------
test('B1. POST /api/auth/sign-up is disabled and never creates a user or session', async () => {
  const before = readLog().filter((e) => e.call === 'auth.admin.createUser').length;
  const r = await call('POST', '/api/auth/sign-up', { body: { email: 'attacker@example.com', password: 'Passw0rd!x', full_name: 'x' } });
  assert.equal(r.status, 403);
  assert.match(r.json.error, /registration is disabled/i);
  assert.equal(r.json.session, undefined);
  assert.equal(readLog().filter((e) => e.call === 'auth.admin.createUser').length, before, 'createUser must not be called');
});

// ---------------------------------------------------------------------------------------------
// C. Coupons: only validation is public
// ---------------------------------------------------------------------------------------------
test('C1. /api/public/coupons exposes ONLY /validate (no list / create / update / delete)', async () => {
  for (const [method, p] of [['GET', '/api/public/coupons'], ['POST', '/api/public/coupons'], ['PUT', '/api/public/coupons/1'], ['DELETE', '/api/public/coupons/1'], ['GET', '/api/public/coupons/1']]) {
    const r = await call(method, p, { body: {} });
    assert.equal(r.status, 404, `${method} ${p} must not exist publicly (got ${r.status})`);
  }
  const v = await call('POST', '/api/public/coupons/validate', { body: {} });
  assert.equal(v.status, 400, 'validate is reachable by the public checkout');
  assert.match(v.json.error, /coupon code/i);
  assert.equal((await call('GET', '/api/coupons')).status, 401);
  assert.equal((await call('GET', '/api/coupons', { token: 'customer-token' })).status, 403);
  assert.notEqual((await call('GET', '/api/coupons', { token: 'admin-token' })).status, 403);
  assert.deepEqual(readLog().filter((e) => e.table === 'coupons' && e.op), [], 'no coupon was written');
});

// ---------------------------------------------------------------------------------------------
// D. Password-reset link cannot be pointed at another site
// ---------------------------------------------------------------------------------------------
test('D1. reset e-mail links only ever use a trusted host (token cannot be sent to an attacker site)', async () => {
  const cases = [
    ['https://evil.example/reset-password', 'https://admin.siddiqui.digital'],
    ['https://admin.siddiqui.digital.evil.example/reset-password', 'https://admin.siddiqui.digital'],
    ['javascript:alert(1)', 'https://admin.siddiqui.digital'],
    ['not a url', 'https://admin.siddiqui.digital'],
    [undefined, 'https://admin.siddiqui.digital'],
    ['https://admin.siddiqui.digital/reset-password', 'https://admin.siddiqui.digital'],
    ['http://localhost:5173/reset-password', 'http://localhost:5173'],
  ];
  for (const [redirectTo, expectedBase] of cases) {
    const before = readLog().filter((e) => e.call === 'sendMail').length;
    const r = await call('POST', '/api/auth/reset-password', { body: { email: 'someone@example.com', redirectTo } });
    assert.equal(r.status, 200, `reset for redirectTo=${redirectTo}`);
    const mail = readLog().filter((e) => e.call === 'sendMail').slice(before)[0];
    assert.ok(mail.html.includes(`${expectedBase}/reset-password?token_hash=TOKEN123`), `link host for ${redirectTo}`);
    assert.ok(!/evil\.example/.test(mail.html), 'attacker host must not appear in the e-mail');
  }
});

// ---------------------------------------------------------------------------------------------
// E. Refund revokes access
// ---------------------------------------------------------------------------------------------
test('E1. admin refund endpoint clears the download token and records the refund', async () => {
  const r = await call('POST', '/api/orders/11111111-1111-4111-8111-111111111111/refund', { token: 'admin-token' });
  assert.equal(r.status, 200);
  const w = readLog().filter((e) => e.table === 'orders' && e.op === 'update').pop();
  assert.equal(w.payload.status, 'refunded');
  assert.equal(w.payload.refund_status, 'refunded');
  assert.equal(w.payload.download_token, null);
});

// ---------------------------------------------------------------------------------------------
// F. Administrator provisioning script
// ---------------------------------------------------------------------------------------------
test('F1. grant-admin-role: grants, revokes, preserves provider data, supports dry-run and pagination', async () => {
  const { setAdminRole, listAdmins, findUserByEmail } = require('../scripts/grant-admin-role.js');
  const users = Array.from({ length: 1500 }, (_, i) => ({ id: `u${i}`, email: `user${i}@example.com`, email_confirmed_at: '2024-01-01T00:00:00Z', app_metadata: { provider: 'google', providers: ['google'] } }));
  users[1400].app_metadata.role = 'admin';
  const updates = [];
  const client = { auth: { admin: {
    listUsers: async ({ page, perPage }) => ({ data: { users: users.slice((page - 1) * perPage, page * perPage) }, error: null }),
    updateUserById: async (id, attrs) => { updates.push({ id, attrs }); return { data: {}, error: null }; },
  } } };
  assert.equal((await findUserByEmail(client, 'USER1450@example.com')).id, 'u1450', 'found on page 2, case-insensitive');
  assert.deepEqual((await listAdmins(client)).map((a) => a.email), ['user1400@example.com']);
  assert.equal((await setAdminRole(client, 'nobody@example.com')).reason, 'user_not_found');
  const dry = await setAdminRole(client, 'user5@example.com', { dryRun: true });
  assert.equal(dry.changed, false); assert.equal(updates.length, 0);
  const grant = await setAdminRole(client, 'user5@example.com');
  assert.equal(grant.changed, true);
  assert.deepEqual(updates[0].attrs.app_metadata, { provider: 'google', providers: ['google'], role: 'admin' }, 'provider data preserved');
  assert.equal((await setAdminRole(client, 'user1400@example.com')).changed, false, 'already an administrator');
  const revoke = await setAdminRole(client, 'user1400@example.com', { revoke: true });
  assert.equal(revoke.changed, true);
  assert.equal(updates.at(-1).attrs.app_metadata.role, undefined);
  assert.equal(updates.at(-1).attrs.app_metadata.provider, 'google');
});

test('F2. inspect / candidates: read-only, masked e-mail, surfaces customers and unconfirmed accounts', async () => {
  const { inspectUser, listCandidates, maskEmail, setAdminRole } = require('../scripts/grant-admin-role.js');
  assert.equal(maskEmail('jane.doe@example.com'), 'j***@example.com');
  assert.equal(maskEmail('nonsense'), '(no email)');
  const users = [
    { id: 'staff-1', email: 'staff.one@example.com', email_confirmed_at: '2024-01-01', created_at: '2024-02-03T00:00:00Z', last_sign_in_at: '2026-10-01T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] } },
    { id: 'buyer-1', email: 'buyer@example.com', email_confirmed_at: '2024-01-01', app_metadata: { provider: 'google' } },
    { id: 'new-1', email: 'new.person@example.com', email_confirmed_at: null, app_metadata: { provider: 'email' } },
    { id: 'staff-2', email: 'already@example.com', email_confirmed_at: '2024-01-01', app_metadata: { provider: 'email', role: 'admin' } },
  ];
  const writes = [];
  const tables = { blogs: [{ admin_id: 'staff-1' }, { admin_id: 'staff-1' }, { admin_id: 'staff-2' }, { admin_id: 'ghost' }, { admin_id: null }], blog_comments: [{ admin_id: 'staff-1', is_admin: true }, { admin_id: 'buyer-1', is_admin: false }], orders: [{ id: 'o1', user_id: 'buyer-1', email: 'buyer@example.com' }] };
  const query = (table) => { const q = { f: [], select() { return q; }, eq(c, v) { q.f.push((r) => String(r[c]) === String(v)); return q; }, ilike(c, p) { const v = String(p).split(String.fromCharCode(92)).join('').toLowerCase(); q.f.push((r) => String(r[c] || '').toLowerCase() === v); return q; },
    then(res, rej) { return Promise.resolve({ data: (tables[table] || []).filter((r) => q.f.every((f) => f(r))), error: null }).then(res, rej); } }; return q; };
  const client = { from: query, auth: { admin: { listUsers: async () => ({ data: { users }, error: null }), updateUserById: async (id, a) => { writes.push({ id, a }); return { data: {}, error: null }; } } } };

  const cands = await listCandidates(client);
  assert.deepEqual(cands.map((c) => c.email), ['s***@example.com', 'a***@example.com', '(account no longer exists)'], 'ordered by activity, masked, ghost account flagged');
  assert.equal(cands[0].blogs, 2); assert.equal(cands[0].adminComments, 1);
  assert.equal(cands.find((c) => c.email.startsWith('a***')).isAdmin, true);
  assert.ok(!JSON.stringify(cands).includes('staff.one@example.com'), 'no full address in the report');

  const buyer = await inspectUser(client, 'buyer@example.com');
  assert.equal(buyer.customerOrders, 1, 'flags that this account also has customer orders');
  assert.equal(buyer.email, 'b***@example.com');
  assert.equal((await inspectUser(client, 'nobody@example.com')).found, false);

  const refused = await setAdminRole(client, 'new.person@example.com');
  assert.equal(refused.ok, false); assert.equal(refused.reason, 'email_not_confirmed');
  assert.equal(writes.length, 0, 'nothing was written by any read-only call or refusal');
});

test('F3. grant-admin-role CLI: previews by default, changes only with --apply, never prints a full address', async () => {
  const run = (...args) => new Promise((resolve) => {
    const p = spawn(process.execPath, ['-r', path.join(__dirname, 'helpers', 'preload-fake-admin-deps.cjs'), path.join(SERVER, 'scripts', 'grant-admin-role.js'), ...args],
      { cwd: SERVER, env: { ...process.env, FAKE_CALL_LOG: LOG, SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_ROLE_KEY: 'x' } });
    let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d)); p.on('close', (code) => resolve({ code, out }));
  });
  const updates = () => readLog().filter((e) => e.call === 'auth.admin.updateUserById');
  const before = updates().length;

  const preview = await run('cust@example.com');
  assert.equal(preview.code, 0);
  assert.ok(preview.out.includes('[preview] c***@example.com: the administrator role WOULD be granted'), preview.out);
  assert.ok(preview.out.includes('Nothing was changed'));
  assert.equal(updates().length, before, 'default run changes nothing');

  const insp = await run('--inspect', 'cust@example.com');
  assert.equal(insp.code, 0); assert.ok(insp.out.includes('Nothing was changed')); assert.ok(!insp.out.includes('cust@example.com'), 'masked');

  const cand = await run('--candidates');
  assert.equal(cand.code, 0); assert.ok(cand.out.includes('No dashboard authors found'));

  const unconf = await run('new@example.com', '--apply');
  assert.equal(unconf.code, 1); assert.ok(unconf.out.includes('not confirmed'));
  assert.equal(updates().length, before, 'an unconfirmed account is never granted');

  const apply = await run('cust@example.com', '--apply');
  assert.equal(apply.code, 0); assert.ok(apply.out.includes('c***@example.com: administrator role granted'), apply.out);
  const w = updates().slice(before);
  assert.equal(w.length, 1); assert.equal(w[0].id, 'u-cust'); assert.equal(w[0].attrs.app_metadata.role, 'admin'); assert.equal(w[0].attrs.app_metadata.provider, 'google');

  const list = await run('--list');
  assert.ok(list.out.includes('a***@example.com') && !list.out.includes('admin@example.com'), '--list masks addresses');
});
