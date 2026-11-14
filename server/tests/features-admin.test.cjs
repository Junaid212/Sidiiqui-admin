/**
 * Feature tests for the ADMIN server: Online Reading content management, entitlement management, Companion PDF files.
 * The real src/index.js runs over HTTP against the REAL SQL migration on an in-memory PostgreSQL engine (PGlite).
 * Run from the server folder:  npm i --no-save @electric-sql/pglite pdfjs-dist@3.11.174  &&  node --test tests/features-admin.test.cjs
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const SERVER = path.resolve(__dirname, '..');
const PORT = 57000 + Math.floor(Math.random() * 900);
const DBG = PORT + 1000;
let child;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MR = '04b84648-3609-4b31-9ded-2486bacf1e74';
const uuid = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

function raw(method, urlPath, { token, body, headers = {}, port = PORT } = {}) {
  return new Promise((resolve, reject) => {
    const isBuf = Buffer.isBuffer(body);
    const data = body === undefined ? null : isBuf ? body : JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { 'Content-Type': isBuf ? headers['Content-Type'] : 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...headers } }, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(c));
      res.on('end', () => { const text = Buffer.concat(chunks).toString('utf8'); let json = null; try { json = JSON.parse(text); } catch { /* not json */ } resolve({ status: res.statusCode, json, text }); });
    });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}
const api = (method, p, body) => raw(method, p, { token: 'admin-token', body });
const sql = async (query, params) => { const r = await raw('POST', '/', { port: DBG, body: { sql: query, params } }); if (r.json.error) throw new Error(r.json.error); return r.json.rows; };

test.before(async () => {
  child = spawn(process.execPath, ['-r', path.join(__dirname, 'helpers', 'preload-fake-admin-features.cjs'), path.join(SERVER, 'src', 'index.js')], { cwd: SERVER, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT), FAKE_PG_DEBUG_PORT: String(DBG), FAKE_LAUNCH_OPEN: '0', FRONTEND_URL: 'https://admin.siddiqui.digital', ADMIN_EMAIL: 'owner@example.com', SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_ROLE_KEY: 'test', SUPABASE_ANON_KEY: 'test', PUBLIC_SITE_ROOT: '', FRONTEND_INDEX_PATH: '' } });
  let out = ''; child.stdout.on('data', (d) => (out += d)); child.stderr.on('data', (d) => (out += d));
  for (let i = 0; i < 200; i++) { try { if ((await raw('GET', '/api/health')).status === 200) { await sql('select 1'); return; } } catch { /* starting */ } await sleep(100); }
  throw new Error('admin server did not start:\n' + out.slice(-1500));
});
test.after(() => { if (child) child.kill(); });

// ---------------------------------------------------------------------------------------------------------------------
test('S1. every new endpoint refuses anonymous visitors (401) and ordinary customers (403)', async () => {
  const routes = [['GET', '/api/reading/books'], ['POST', '/api/reading/books'], ['PUT', `/api/reading/books/${uuid(1)}`], ['DELETE', `/api/reading/books/${uuid(1)}`], ['GET', `/api/reading/books/${uuid(1)}/chapters`],
    ['POST', `/api/reading/books/${uuid(1)}/chapters`], ['GET', `/api/reading/chapters/${uuid(1)}`], ['PUT', `/api/reading/chapters/${uuid(1)}`], ['POST', `/api/reading/chapters/${uuid(1)}/publish`], ['DELETE', `/api/reading/chapters/${uuid(1)}`],
    ['PUT', `/api/reading/books/${uuid(1)}/order`], ['GET', '/api/entitlements'], ['GET', '/api/entitlements/overview'], ['GET', `/api/entitlements/${uuid(1)}`], ['POST', `/api/entitlements/${uuid(1)}/action`], ['POST', '/api/entitlements/launch'],
    ['POST', '/api/entitlements/reconcile'], ['GET', '/api/entitlements/webhooks'], ['GET', '/api/entitlements/audit'], ['GET', '/api/companion-files'], ['POST', '/api/companion-files'], ['POST', `/api/companion-files/${uuid(1)}/retry`], ['POST', `/api/companion-files/${uuid(1)}/make-current`]];
  for (const [m, p] of routes) {
    assert.equal((await raw(m, p, { body: m === 'GET' ? undefined : {} })).status, 401, `anonymous ${m} ${p}`);
    assert.equal((await raw(m, p, { token: 'customer-token', body: m === 'GET' ? undefined : {} })).status, 403, `customer ${m} ${p}`);
    assert.equal((await raw(m, p, { token: 'spoof-token', body: m === 'GET' ? undefined : {} })).status, 403, `user_metadata admin ${m} ${p}`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------
let bookId, ch1, ch2, ch3;
test('B1. create a book and chapters; titles are required; slugs are unique', async () => {
  assert.equal((await api('POST', '/api/reading/books', { title: '  ' })).status, 400);
  const b = await api('POST', '/api/reading/books', { title: 'Marketing Reclassified', subtitle: 'Online Reading Edition' });
  assert.equal(b.status, 201); assert.equal(b.json.book.status, 'draft'); assert.equal(b.json.book.slug, 'marketing-reclassified'); bookId = b.json.book.id;
  assert.equal((await api('POST', '/api/reading/books', { title: 'Marketing Reclassified' })).json.book.slug, 'marketing-reclassified-2');
  const c1 = await api('POST', `/api/reading/books/${bookId}/chapters`, { title: 'The Principle-First Mandate', content_html: '<h2>Why</h2><p>Profit is an outcome.</p>' });
  assert.equal(c1.status, 201); assert.equal(c1.json.chapter.status, 'draft'); assert.equal(c1.json.chapter.position, 1); ch1 = c1.json.chapter.id;
  ch2 = (await api('POST', `/api/reading/books/${bookId}/chapters`, { title: 'Marketing as a Discipline', content_html: '<p>Second.</p>' })).json.chapter.id;
  ch3 = (await api('POST', `/api/reading/books/${bookId}/chapters`, { title: 'Third', content_html: '<p>Third.</p>' })).json.chapter.id;
  assert.equal((await api('POST', `/api/reading/books/${bookId}/chapters`, { title: '' })).status, 400);
  assert.equal((await api('POST', `/api/reading/books/${uuid(9)}/chapters`, { title: 'x' })).status, 404);
  assert.equal((await api('GET', '/api/reading/books/not-a-uuid/chapters')).status, 400);
});

test('B2. rich text is sanitised on the server: scripts, handlers, javascript: links and unsafe images never reach the database', async () => {
  const evil = '<h2 onclick="x()">Title</h2><script>alert(1)</script><p style="position:fixed;text-align:center">Hello <a href="javascript:alert(1)">bad</a> <a href="https://ok.example/x">good</a></p>'
    + '<img src="http://insecure.example/a.png" onerror="x()"><img src="https://img.example/a.png" alt="ok"><iframe src="https://evil.example"></iframe><style>body{display:none}</style>'
    + '<table><tbody><tr><td colspan="2">cell</td></tr></tbody></table><blockquote>quote</blockquote><ul><li>one</li></ul><svg onload="x()"></svg>';
  const r = await api('PUT', `/api/reading/chapters/${ch1}`, { content_html: evil });
  assert.equal(r.status, 200);
  const html = r.json.chapter.content_html;
  for (const bad of ['<script', 'onclick', 'onerror', 'javascript:', '<iframe', '<style', '<svg', 'position:fixed', 'http://insecure', 'display:none', 'alert(1)']) assert.ok(!html.includes(bad), 'removed: ' + bad);
  for (const good of ['<h2>Title</h2>', 'text-align:center', 'href="https://ok.example/x"', 'rel="noopener noreferrer nofollow"', 'src="https://img.example/a.png"', '<table>', 'colspan="2"', '<blockquote>', '<li>one</li>']) assert.ok(html.includes(good), 'kept: ' + good);
  assert.equal((await api('PUT', `/api/reading/chapters/${ch1}`, { content_html: '<h2>Why</h2><p>Profit is an outcome, never the starting point of a business.</p>' })).status, 200);
});

test('B3. drafts can be previewed by the administrator; publishing needs content; edits are version-checked', async () => {
  const prev = await api('GET', `/api/reading/chapters/${ch1}`); assert.equal(prev.status, 200); assert.equal(prev.json.chapter.status, 'draft'); assert.match(prev.json.chapter.content_html, /Profit is an outcome/);
  const empty = (await api('POST', `/api/reading/books/${bookId}/chapters`, { title: 'Empty', content_html: '<p> </p>' })).json.chapter.id;
  assert.equal((await api('POST', `/api/reading/chapters/${empty}/publish`)).status, 400);
  const v = prev.json.chapter.version;
  assert.equal((await api('PUT', `/api/reading/chapters/${ch2}`, { title: 'Marketing as a Strategic Discipline', expectedVersion: 1 })).status, 200);
  assert.equal((await api('PUT', `/api/reading/chapters/${ch2}`, { title: 'Stale edit', expectedVersion: 1 })).status, 409, 'a stale editor cannot overwrite a newer save');
  assert.ok(v >= 1);
  await api('DELETE', `/api/reading/chapters/${empty}`, { confirm: true });
});

test('B4. publish / unpublish: status changes, Ask SID book knowledge follows the published chapters, nothing is indexed for drafts', async () => {
  assert.equal((await sql("select count(*)::int n from public.knowledge_chunks where source='book'"))[0].n, 0);
  assert.equal((await api('POST', `/api/reading/chapters/${ch1}/publish`)).json.chapter.status, 'published');
  assert.equal((await sql("select count(*)::int n from public.knowledge_chunks where reader_chapter_id=$1", [ch1]))[0].n, 0, 'the BOOK is still a draft, so nothing may be quoted yet');
  const pb = await api('PUT', `/api/reading/books/${bookId}`, { status: 'published' }); assert.equal(pb.status, 200);
  const rows = await sql("select source, concept, chapter_ref from public.knowledge_chunks where reader_chapter_id=$1", [ch1]);
  assert.ok(rows.length >= 1); assert.equal(rows[0].source, 'book'); assert.equal(rows[0].chapter_ref, 'The Principle-First Mandate'); assert.equal(rows[0].concept, 'Why');
  await api('PUT', `/api/reading/chapters/${ch1}`, { content_html: '<h2>Why</h2><p>Revised text about purpose.</p>' });
  assert.match((await sql("select content from public.knowledge_chunks where reader_chapter_id=$1", [ch1]))[0].content, /Revised text/, 'editing a published chapter re-indexes it');
  assert.equal((await api('POST', `/api/reading/chapters/${ch1}/unpublish`)).json.chapter.status, 'unpublished');
  assert.equal((await sql("select count(*)::int n from public.knowledge_chunks where reader_chapter_id=$1", [ch1]))[0].n, 0, 'unpublishing removes the knowledge');
  await api('POST', `/api/reading/chapters/${ch1}/publish`);
  await api('PUT', `/api/reading/books/${bookId}`, { status: 'unpublished' });
  assert.equal((await sql("select count(*)::int n from public.knowledge_chunks where reader_chapter_id=$1", [ch1]))[0].n, 0, 'an unpublished book is not quoted');
  await api('PUT', `/api/reading/books/${bookId}`, { status: 'published' });
});

test('B5. reordering is atomic and validated; deleting needs confirmation and removes the knowledge', async () => {
  assert.equal((await api('PUT', `/api/reading/books/${bookId}/order`, { chapterIds: [ch3, ch1, ch2] })).status, 200);
  assert.deepEqual((await api('GET', `/api/reading/books/${bookId}/chapters`)).json.chapters.map((c) => c.id), [ch3, ch1, ch2]);
  assert.equal((await api('PUT', `/api/reading/books/${bookId}/order`, { chapterIds: [ch3, ch1] })).status, 409);
  assert.equal((await api('PUT', `/api/reading/books/${bookId}/order`, { chapterIds: ['x'] })).status, 400);
  assert.deepEqual((await api('GET', `/api/reading/books/${bookId}/chapters`)).json.chapters.map((c) => c.id), [ch3, ch1, ch2], 'a rejected order changes nothing');
  assert.equal((await api('DELETE', `/api/reading/chapters/${ch1}`, {})).status, 400, 'no confirmation, no delete');
  assert.equal((await api('DELETE', `/api/reading/chapters/${ch1}`, { confirm: true })).status, 200);
  assert.equal((await sql("select count(*)::int n from public.knowledge_chunks where reader_chapter_id=$1", [ch1]))[0].n, 0);
  assert.equal((await api('DELETE', `/api/reading/books/${bookId}`, { confirm: true, confirmTitle: 'Marketing Reclassified' })).status, 409, 'a published book cannot be deleted');
  assert.equal((await api('GET', `/api/reading/chapters/${ch1}`)).status, 404);
});

test('B6. every content change is in the audit log', async () => {
  const actions = (await sql('select action from public.admin_audit_log order by id')).map((r) => r.action);
  for (const a of ['reading.book.create', 'reading.chapter.create', 'reading.chapter.update', 'reading.chapter.publish', 'reading.chapter.unpublish', 'reading.chapter.reorder', 'reading.chapter.delete', 'reading.book.update']) assert.ok(actions.includes(a), a);
  assert.ok((await sql('select actor_label from public.admin_audit_log limit 1'))[0].actor_label === 'admin@example.com');
});

// ---------------------------------------------------------------------------------------------------------------------
const addOrder = (n, email, over = {}) => sql(`insert into public.orders (id, email, order_number, payment_provider, amount, status, product_id, book_name, access_tier, is_upgrade, created_at)
  values ($1,$2,$3,'payhip',$4,'paid',$5,$6,$7,$8, now()) returning id`, [uuid(n), email, 'ORD-' + n, over.amount || 49.99, MR, over.book || 'Marketing Reclassified — Digital Companion Edition', over.tier || 'companion', over.upgrade || false]);
const grant = (n, email, edition, upg = false) => sql('select public.grant_entitlement_for_order($1,$2,null,$3,$4,now()) r', [uuid(n), email, edition, upg]).then((r) => r[0].r);

test('E1. list, search and filter customers by edition; purchase, access status, expiry, launch position, usage and refund status are shown', async () => {
  await addOrder(101, 'ann@example.com', { tier: 'online', book: 'Marketing Reclassified — Online Reading Edition', amount: 20 }); await grant(101, 'ann@example.com', 'online');
  await addOrder(102, 'ben@example.com'); await grant(102, 'ben@example.com', 'companion');
  await addOrder(103, 'cat@example.com', { tier: 'online', book: 'Marketing Reclassified — Online Reading Edition', amount: 20 }); await grant(103, 'cat@example.com', 'online');
  await addOrder(104, 'cat@example.com', { tier: 'companion', upgrade: true, amount: 30 }); await grant(104, 'cat@example.com', 'companion', true);
  assert.equal((await api('GET', '/api/entitlements/overview')).json.launchOffer.open, false, 'the launch offer starts CLOSED');
  assert.equal((await api('POST', '/api/entitlements/launch', { startsAt: 'now', reason: 'launch day' })).status, 200); // the owner opens it; the next grants take positions
  await addOrder(105, 'dan@example.com'); await grant(105, 'dan@example.com', 'companion');
  const all = await api('GET', '/api/entitlements'); assert.equal(all.status, 200); assert.equal(all.json.total, 5);
  assert.deepEqual((await api('GET', '/api/entitlements?group=online')).json.items.map((i) => i.email), ['ann@example.com']);
  assert.deepEqual((await api('GET', '/api/entitlements?group=upgraded')).json.items.map((i) => i.email), ['cat@example.com']);
  assert.deepEqual((await api('GET', '/api/entitlements?group=companion')).json.items.map((i) => i.email).sort(), ['ben@example.com', 'dan@example.com']);
  assert.deepEqual((await api('GET', '/api/entitlements?q=ANN@')).json.items.map((i) => i.email), ['ann@example.com'], 'case-insensitive search');
  assert.equal((await api('GET', '/api/entitlements?q=%25')).json.total, 0, 'a % in the search is literal, not a wildcard');
  const dan = (await api('GET', '/api/entitlements?q=dan')).json.items[0];
  assert.equal(dan.edition, 'companion'); assert.equal(dan.accessStatus, 'active'); assert.equal(dan.launchPosition, 1); assert.equal(dan.allowance.total_limit, 150); assert.equal(dan.allowance.daily_limit, 5); assert.ok(dan.askSidExpiresAt); assert.equal(dan.order.order_number, 'ORD-105');
  const ben = (await api('GET', '/api/entitlements?q=ben')).json.items[0]; assert.equal(ben.launchPosition, null, 'bought before the launch offer opened');
  assert.equal(ben.allowance.total_limit, 100);
});

test('E2. customer detail: original purchase + upgrade transactions, events, replaced entitlement and usage', async () => {
  const cat = (await api('GET', '/api/entitlements?q=cat&group=upgraded')).json.items[0];
  const d = await api('GET', `/api/entitlements/${cat.id}`); assert.equal(d.status, 200);
  assert.deepEqual(d.json.orders.map((o) => o.order_number), ['ORD-103', 'ORD-104'], 'both transactions stay visible');
  assert.equal(d.json.replacedEntitlement.edition, 'online'); assert.equal(d.json.replacedEntitlement.revoke_reason, 'upgraded');
  assert.deepEqual(d.json.events.map((e) => e.event_type), ['granted_companion_upgrade']);
  assert.equal((await api('GET', `/api/entitlements/${uuid(777)}`)).status, 404); assert.equal((await api('GET', '/api/entitlements/zzz')).status, 400);
});

test('E3. administrative corrections need a written reason, are validated, audited, and a refunded purchase cannot be restored', async () => {
  const ben = (await api('GET', '/api/entitlements?q=ben')).json.items[0];
  const act = (body) => api('POST', `/api/entitlements/${ben.id}/action`, body);
  assert.equal((await act({ action: 'add_questions', amount: 10 })).status, 400, 'no reason');
  assert.equal((await act({ action: 'add_questions', amount: 10, reason: 'ok' })).status, 400, 'reason too short');
  assert.equal((await act({ action: 'delete', reason: 'because' })).status, 400, 'unknown action');
  assert.equal((await act({ action: 'add_questions', amount: 'x', reason: 'because I said' })).status, 400);
  assert.equal((await act({ action: 'add_questions', amount: 25, reason: 'goodwill after the outage' })).status, 200);
  assert.equal((await act({ action: 'extend_months', amount: 3, reason: 'support request #12' })).status, 200);
  assert.equal((await api('GET', `/api/entitlements/${ben.id}`)).json.allowance.total_limit, 125);
  assert.equal((await act({ action: 'revoke', reason: 'chargeback dispute opened' })).status, 200);
  assert.equal((await act({ action: 'revoke', reason: 'again please' })).status, 409);
  assert.equal((await act({ action: 'restore', reason: 'dispute was won' })).status, 200);
  const audit = await sql("select actor_label, detail from public.admin_audit_log where action like 'entitlement.%' order by id");
  assert.ok(audit.length >= 4 && audit.every((a) => a.actor_label === 'admin@example.com' && a.detail.reason));
  assert.equal((await api('POST', `/api/entitlements/${ben.id}/action`, { action: 'restore', reason: 'no longer revoked' })).status, 409);
});

test('E4. refunding an order in the dashboard ends the customer\'s entitlement; the refunded purchase can never be restored', async () => {
  const dan = (await api('GET', '/api/entitlements?q=dan')).json.items[0];
  const r = await api('POST', `/api/orders/${uuid(105)}/refund`); assert.equal(r.status, 200); assert.equal(r.json.entitlementRevoked, true);
  const after = (await api('GET', '/api/entitlements?q=dan')).json.items[0]; assert.equal(after.accessStatus, 'revoked'); assert.equal(after.revokeReason, 'full_refund'); assert.equal(after.launchPosition, 1, 'the launch position is kept');
  assert.equal((await api('POST', `/api/entitlements/${dan.id}/action`, { action: 'restore', reason: 'customer asked nicely' })).status, 409);
  assert.equal((await api('GET', '/api/entitlements?group=refunded')).json.total, 1);
  assert.equal((await sql("select count(*)::int n from public.orders where id=$1", [uuid(105)]))[0].n, 1, 'the order stays in the history');
});

test('E5. overview, launch offer control, reconcile and webhook log', async () => {
  const o = await api('GET', '/api/entitlements/overview'); assert.equal(o.status, 200);
  assert.deepEqual([o.json.counts.onlineActive, o.json.counts.companionActive, o.json.counts.upgradedActive, o.json.counts.refunded], [1, 2, 1, 1]);
  assert.equal(o.json.limits.daily, 5); assert.equal(o.json.limits.launchTotal, 150); assert.equal(o.json.launchOffer.open, true);
  assert.equal((await api('POST', '/api/entitlements/launch', { startsAt: 'now' })).status, 400, 'reason required');
  const future = new Date(Date.now() + 86400e3).toISOString();
  assert.equal((await api('POST', '/api/entitlements/launch', { startsAt: 'nonsense', reason: 'testing the validation' })).status, 400);
  assert.equal((await api('POST', '/api/entitlements/launch', { startsAt: future, reason: 'schedule not allowed to move later after allocations' })).status, 409, 'cannot be moved later once positions exist');
  assert.equal((await api('POST', '/api/entitlements/launch', { startsAt: 'now', reason: 'moving it later again' })).status, 409, 'positions exist: the start can only move earlier');
  // reconcile repairs a missed webhook: an order exists but its entitlement does not
  await addOrder(106, 'eli@example.com');
  const rc = await api('POST', '/api/entitlements/reconcile', { email: 'ELI@example.com' }); assert.equal(rc.status, 200); assert.equal(rc.json.ok, true);
  assert.equal((await api('GET', '/api/entitlements?q=eli')).json.total, 1);
  assert.equal((await api('POST', '/api/entitlements/reconcile', { email: 'nope' })).status, 400);
  assert.equal((await api('POST', '/api/entitlements/reconcile', { email: 'eli@example.com' })).json.results[0].result, 'already_processed', 'idempotent');
  await sql("insert into public.webhook_events (provider,event_key,event_type,outcome,http_status) values ('payhip','paid:T1','paid','failed',500),('payhip','paid:T2','paid','processed',200)");
  const failed = await api('GET', '/api/entitlements/webhooks?outcome=failed'); assert.equal(failed.json.total, 1); assert.equal(failed.json.items[0].http_status, 500);
  assert.equal((await api('GET', '/api/entitlements/webhooks')).json.total, 2);
  assert.ok((await api('GET', '/api/entitlements/audit')).json.items.length > 5);
});

// ---------------------------------------------------------------------------------------------------------------------
function makePdf(pages) {
  const esc = (s) => s.replace(/[()\\]/g, '\\$&');
  const objs = []; const kids = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>'; objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pages.forEach((lines, i) => {
    const content = lines.length ? `BT /F1 12 Tf 72 720 Td 16 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET` : '';
    objs[4 + 2 * i] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    objs[5 + 2 * i] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${4 + 2 * i} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
    kids.push(`${5 + 2 * i} 0 R`);
  });
  objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  let out = '%PDF-1.4\n'; const offs = [];
  for (let n = 1; n < objs.length; n++) { offs[n] = out.length; out += `${n} 0 obj\n${objs[n]}\nendobj\n`; }
  const xref = out.length; out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let n = 1; n < objs.length; n++) out += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
  return Buffer.from(out + `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`, 'latin1');
}
function multipart(filename, buffer, fields = {}) {
  const b = '----feat' + Math.random().toString(16).slice(2);
  const parts = Object.entries(fields).map(([k, v]) => Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`), buffer, Buffer.from(`\r\n--${b}--\r\n`));
  return { body: Buffer.concat(parts), headers: { 'Content-Type': `multipart/form-data; boundary=${b}` } };
}
const uploadPdf = (filename, buf, fields) => { const m = multipart(filename, buf, fields); return raw('POST', '/api/companion-files', { token: 'admin-token', body: m.body, headers: m.headers }); };
async function waitFor(id, want) { for (let i = 0; i < 100; i++) { const f = (await api('GET', '/api/companion-files')).json.files.find((x) => x.id === id); if (f && want.includes(f.status)) return f; await sleep(100); } throw new Error('file never reached ' + want); }

const PDF1 = makePdf([['Chapter 1 Value Drift', '', 'Value drift is the gradual gap between what customers expect and what a growing firm delivers.', 'The worksheet scores each segment on care, relevance and trust every quarter.'], ['Chapter 2 Pricing', '', 'Price is the exchange mechanism for perceived value and should never be cut to match a competitor.']]);
const PDF2 = makePdf([['Chapter 1 Value Drift Revised', '', 'The revised worksheet adds a fourth score for transparency to the original three scores.']]);
let f1, f2;

test('C1. upload a Companion PDF: validated by content, stored privately, processed, indexed with chapter references, made the current download', async () => {
  assert.equal((await uploadPdf('fake.pdf', Buffer.from('this is not a pdf at all'))).status, 400);
  const r = await uploadPdf('Companion Pack v1.pdf', PDF1); assert.equal(r.status, 202); f1 = r.json.id;
  const done = await waitFor(f1, ['indexed', 'failed']); assert.equal(done.status, 'indexed', done.errorMessage); assert.ok(done.chunkCount >= 2); assert.equal(done.isCurrent, true); assert.equal(done.version, 1);
  const chunks = await sql("select chapter_ref, concept, source, content from public.knowledge_chunks where file_id=$1 order by position", [f1]);
  assert.ok(chunks.every((c) => c.source === 'companion')); assert.ok(chunks.some((c) => /^Chapter 1/.test(c.chapter_ref)) && chunks.some((c) => /^Chapter 2/.test(c.chapter_ref)), JSON.stringify(chunks.map((c) => c.chapter_ref)));
  assert.ok(chunks.some((c) => /worksheet/i.test(c.content)));
  assert.match((await sql("select file_path from public.ebooks where id=$1", [MR]))[0].file_path, /^companion\/marketing-reclassified\/v1-/, 'customers now download this file');
  assert.equal((await uploadPdf('again.pdf', PDF1)).status, 409, 'the identical file is not stored twice');
});

test('C2. replacing: the new version becomes current only after it was indexed; old knowledge is replaced; the old file stays available', async () => {
  const r = await uploadPdf('Companion Pack v2.pdf', PDF2); f2 = r.json.id;
  const done = await waitFor(f2, ['indexed', 'failed']); assert.equal(done.status, 'indexed'); assert.equal(done.version, 2); assert.equal(done.isCurrent, true);
  const list = (await api('GET', '/api/companion-files')).json.files; assert.equal(list.find((f) => f.id === f1).isCurrent, false);
  assert.equal((await sql("select count(*)::int n from public.knowledge_chunks where file_id=$1", [f1]))[0].n, 0, 'old Companion knowledge is removed');
  assert.match((await sql("select content from public.knowledge_chunks where source='companion'"))[0].content, /fourth score/);
  assert.match((await sql("select file_path from public.ebooks where id=$1", [MR]))[0].file_path, /^companion\/marketing-reclassified\/v2-/);
  // roll back to version 1: it is re-indexed from storage and becomes current again
  const mc = await api('POST', `/api/companion-files/${f1}/make-current`); assert.equal(mc.status, 200);
  assert.equal((await api('GET', '/api/companion-files')).json.files.find((f) => f.id === f1).isCurrent, true);
  assert.match((await sql("select content from public.knowledge_chunks where source='companion' limit 1"))[0].content, /worksheet scores|exchange mechanism|gradual gap/);
});

test('C3. a PDF without readable text FAILS visibly, never replaces the current file, and can be retried', async () => {
  const before = (await sql("select file_path from public.ebooks where id=$1", [MR]))[0].file_path;
  const r = await uploadPdf('scan.pdf', makePdf([[]])); const done = await waitFor(r.json.id, ['indexed', 'failed']);
  assert.equal(done.status, 'failed'); assert.match(done.errorMessage, /No readable text/); assert.equal(done.isCurrent, false); assert.equal(done.attempts, 1);
  assert.equal((await sql("select file_path from public.ebooks where id=$1", [MR]))[0].file_path, before, 'customers keep the working file');
  assert.equal((await api('POST', `/api/companion-files/${r.json.id}/make-current`)).status, 409, 'a failed file cannot be made current');
  const retry = await api('POST', `/api/companion-files/${r.json.id}/retry`); assert.equal(retry.status, 202);
  const again = await waitFor(r.json.id, ['failed']); await sleep(200); assert.equal((await api('GET', '/api/companion-files')).json.files.find((f) => f.id === r.json.id).attempts, 2);
  assert.equal(again.status, 'failed');
});

test('C4. oversized files are refused; bad ids are refused; files are in a private bucket path', async () => {
  const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(31 * 1024 * 1024, 0x20)]);
  assert.equal((await uploadPdf('huge.pdf', big)).status, 413);
  assert.equal((await api('POST', '/api/companion-files/not-a-uuid/retry')).status, 400);
  assert.equal((await api('POST', `/api/companion-files/${uuid(55)}/make-current`)).status, 404);
  assert.ok((await sql("select count(*)::int n from public.companion_files where storage_path not like 'companion/%' or storage_bucket <> 'digital-products'"))[0].n === 0);
});

// ---------------------------------------------------------------------------------------------------------------------
function makeDocx(paragraphs) {
  const AdmZip = require('adm-zip'); const z = new AdmZip();
  z.addFile('[Content_Types].xml', Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'));
  z.addFile('_rels/.rels', Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'));
  z.addFile('word/_rels/document.xml.rels', Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'));
  z.addFile('word/styles.xml', Buffer.from('<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/></w:style></w:styles>'));
  const body = paragraphs.map(([style, t]) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t>${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:t></w:r></w:p>`).join('');
  z.addFile('word/document.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`));
  return z.toBuffer();
}
test('B7. import a book from Word: every "Heading 1" becomes a DRAFT chapter; dry-run first; nothing is published; bad files are refused', async () => {
  const docx = makeDocx([['Heading1', 'The First Chapter'], [null, 'Opening paragraph about purpose & profit.'], [null, 'Second paragraph.'], ['Heading1', 'The Second Chapter'], [null, 'Closing text <b>not bold</b>.']]);
  const post = (buf, fields) => { const m = multipart('book.docx', buf, fields); return raw('POST', `/api/reading/books/${bookId}/import-docx`, { token: 'admin-token', body: m.body, headers: m.headers }); };
  const before = (await api('GET', `/api/reading/books/${bookId}/chapters`)).json.chapters.length;
  const dry = await post(docx, { dryRun: 'true' }); assert.equal(dry.status, 200); assert.deepEqual(dry.json.chapters.map((c) => c.title), ['The First Chapter', 'The Second Chapter']); assert.ok(dry.json.chapters[0].words >= 8);
  assert.equal((await api('GET', `/api/reading/books/${bookId}/chapters`)).json.chapters.length, before, 'a dry run writes nothing');
  const done = await post(docx, {}); assert.equal(done.status, 201); assert.equal(done.json.created, 2);
  const list = (await api('GET', `/api/reading/books/${bookId}/chapters`)).json.chapters;
  assert.equal(list.length, before + 2); const mine = list.slice(-2); assert.deepEqual(mine.map((c) => c.title), ['The First Chapter', 'The Second Chapter']); assert.ok(mine.every((c) => c.status === 'draft'), 'imported chapters are drafts');
  const full = (await api('GET', `/api/reading/chapters/${mine[0].id}`)).json.chapter; assert.match(full.content_html, /Opening paragraph about purpose &amp; profit/);
  assert.ok(!/<b>/.test((await api('GET', `/api/reading/chapters/${mine[1].id}`)).json.chapter.content_html.replace(/<strong>/g, '')), 'literal angle brackets stay text');
  assert.equal((await post(Buffer.from('not a docx at all'), {})).status, 400);
  assert.equal((await post(Buffer.concat([Buffer.from('PK'), Buffer.from('garbage')]), {})).status, 422);
  assert.ok((await sql("select count(*)::int n from public.admin_audit_log where action='reading.book.import_docx'"))[0].n === 1);
  assert.equal((await raw('POST', `/api/reading/books/${bookId}/import-docx`, { token: 'customer-token', body: Buffer.from('x'), headers: { 'Content-Type': 'application/octet-stream' } })).status, 403);
});
