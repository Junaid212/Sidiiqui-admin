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
      res.on('end', () => { const text = Buffer.concat(chunks).toString('utf8'); let json = null; try { json = JSON.parse(text); } catch { /* not json */ } resolve({ status: res.statusCode, json, text, headers: res.headers }); });
    });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}
const api = (method, p, body) => raw(method, p, { token: 'admin-token', body });
const sql = async (query, params) => { const r = await raw('POST', '/', { port: DBG, body: { sql: query, params } }); if (r.json.error) throw new Error(r.json.error); return r.json.rows; };

test.before(async () => {
  child = spawn(process.execPath, ['-r', path.join(__dirname, 'helpers', 'preload-fake-admin-features.cjs'), path.join(SERVER, 'src', 'index.js')], { cwd: SERVER, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, COUPONS_FILE: path.join(require('node:os').tmpdir(), `coupons-test-${PORT}.json`), PORT: String(PORT), FAKE_PG_DEBUG_PORT: String(DBG), FAKE_LAUNCH_OPEN: '0', FRONTEND_URL: 'https://admin.siddiqui.digital', ADMIN_EMAIL: 'owner@example.com', SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_ROLE_KEY: 'test', SUPABASE_ANON_KEY: 'test', PUBLIC_SITE_ROOT: '', FRONTEND_INDEX_PATH: '' } });
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

test('B8. only real headings stay headings: sentences and Heading 4-6 become normal paragraphs, on import and for chapters already imported', async () => {
  const { demoteParagraphHeadings: d } = require('../src/utils/readerContent');
  const longH = 'The Sid definition does not replace earlier definitions of marketing; it builds on them. Table 3.1 shows what each influential definition emphasizes and what the Sid definition adds.';
  const quote = 'Leaders start asking: “What must we change upstream (segment, target, position, offer, price, channel access, or experience) before we amplify?”';
  const html = `<h2>1.1 What This Book Is (and Is Not)</h2><p>x</p><h2>${longH}</h2><h3>${quote}</h3><h2>Field Note: Higher Education</h2><h3>3.2 The Operating Loop: Sense–Shape–Scale–Experience</h3><h3>1. Introduction</h3><h4>Minor</h4><h1>Chapter 6: Downstream by Design: How Marketing Was Misclassified and How to Reclassify It</h1><table><tbody><tr><td>cell one</td><td>cell two</td></tr></tbody></table><figure><img src="https://example.com/a.png" alt="figure a"><figcaption>Figure caption</figcaption></figure><blockquote>A boxed quote</blockquote>`;
  const r = d(html);
  for (const same of ['<table><tbody><tr><td>cell one</td><td>cell two</td></tr></tbody></table>', '<figure><img src="https://example.com/a.png" alt="figure a"><figcaption>Figure caption</figcaption></figure>', '<blockquote>A boxed quote</blockquote>']) assert.ok(r.html.includes(same), `untouched: ${same}`);
  assert.ok(r.samples.length === 3 && r.samples.every((s) => s.text), 'the preview shows which paragraphs would change');
  assert.equal(r.demoted, 3, 'the two long sentences and the Heading 4');
  for (const keep of ['<h2>1.1 What This Book Is (and Is Not)</h2>', '<h2>Field Note: Higher Education</h2>', '<h3>3.2 The Operating Loop: Sense–Shape–Scale–Experience</h3>', '<h3>1. Introduction</h3>', '<h1>Chapter 6: Downstream by Design']) assert.ok(r.html.includes(keep), `kept: ${keep}`);
  assert.ok(r.html.includes(`<p>${longH}</p>`) && r.html.includes(`<p>${quote}</p>`) && r.html.includes('<p>Minor</p>') && !/<h4/.test(r.html));
  assert.equal(d('<h2>Short heading</h2><p>Body.</p>').demoted, 0, 'ordinary content is untouched');
  // chapters that were imported earlier are repaired by the tool: report first, reason needed, published chapters re-indexed
  const made = await api('POST', `/api/reading/books/${bookId}/chapters`, { title: 'Repair me', content_html: html });
  assert.equal(made.status, 201); const chId = made.json.chapter.id;
  const dry = await api('POST', `/api/reading/books/${bookId}/repair-headings`, {}); assert.equal(dry.status, 200); assert.equal(dry.json.dryRun, true);
  assert.equal(dry.json.chapters.find((c) => c.title === 'Repair me').demoted, 3);
  assert.ok(/<h2>The Sid definition/.test((await api('GET', `/api/reading/chapters/${chId}`)).json.chapter.content_html), 'the report changed nothing');
  assert.equal((await api('POST', `/api/reading/books/${bookId}/repair-headings`, { apply: true })).status, 400, 'a reason is required');
  const fixed = await api('POST', `/api/reading/books/${bookId}/repair-headings`, { apply: true, reason: 'long paragraphs were imported as headings' });
  assert.equal(fixed.status, 200, JSON.stringify(fixed.json));
  const after = (await api('GET', `/api/reading/chapters/${chId}`)).json.chapter.content_html; assert.ok(!/<h2>The Sid definition/.test(after) && /<h2>1\.1 What This Book Is/.test(after));
  assert.equal((await api('POST', `/api/reading/books/${bookId}/repair-headings`, {})).json.chapters.some((c) => c.title === 'Repair me'), false, 'repairing twice finds nothing more');
  assert.equal((await raw('POST', `/api/reading/books/${bookId}/repair-headings`, { token: 'customer-token', body: {} })).status, 403);
  // tables, figures and boxes survive the repair byte for byte
  for (const same of ['<table>', 'cell one', '<figcaption>Figure caption</figcaption>', 'https://example.com/a.png', '<blockquote>A boxed quote</blockquote>']) assert.ok(after.includes(same), `still there: ${same}`);
  // UNDO: the chapter goes back exactly to what it was; a second undo has nothing to do
  const upre = await api('POST', `/api/reading/books/${bookId}/repair-headings/undo`, {}); assert.equal(upre.status, 200); assert.equal(upre.json.dryRun, true); assert.equal(upre.json.willRestore >= 1, true);
  assert.equal((await api('POST', `/api/reading/books/${bookId}/repair-headings/undo`, { apply: true })).status, 400, 'a reason is required');
  const undone = await api('POST', `/api/reading/books/${bookId}/repair-headings/undo`, { apply: true, reason: 'checking the undo' }); assert.equal(undone.status, 200, JSON.stringify(undone.json)); assert.ok(undone.json.restored >= 1);
  const back = (await api('GET', `/api/reading/chapters/${chId}`)).json.chapter.content_html; assert.ok(/<h2>The Sid definition/.test(back) && /<table>/.test(back), 'the original text is back');
  assert.equal((await api('POST', `/api/reading/books/${bookId}/repair-headings/undo`, {})).status, 404, 'nothing left to undo');
  // a chapter edited after a fix is NOT overwritten by an undo
  assert.equal((await api('POST', `/api/reading/books/${bookId}/repair-headings`, { apply: true, reason: 'second fix for the edit test' })).status, 200);
  const cur = (await api('GET', `/api/reading/chapters/${chId}`)).json.chapter;
  assert.equal((await api('PUT', `/api/reading/chapters/${chId}`, { content_html: cur.content_html + '<p>An edit made after the fix</p>', expectedVersion: cur.version })).status, 200);
  const skip = await api('POST', `/api/reading/books/${bookId}/repair-headings/undo`, { apply: true, reason: 'edit protection check' }); assert.equal(skip.status, 200);
  assert.equal(skip.json.chapters.find((c) => c.title === 'Repair me').restore, false, 'the edited chapter is left alone');
  assert.ok(/An edit made after the fix/.test((await api('GET', `/api/reading/chapters/${chId}`)).json.chapter.content_html), 'the later edit is still there');
  await api('DELETE', `/api/reading/chapters/${chId}`, { confirm: true });
});

// ---------------------------------------------------------------------------------------------------------------------
// G. Grant by hand, import the Payhip export, remove test orders
// ---------------------------------------------------------------------------------------------------------------------
test('G1. grant access by hand: needs a reason; the person gets the Companion entitlement; no double grants; audited', async () => {
  await sql('alter table public.orders add column if not exists payhip_transaction_id text');
  await sql('alter table public.orders add column if not exists raw_metadata jsonb');
  const g = (b) => api('POST', '/api/entitlements/grant', b);
  // complimentary grant: custom questions and duration, NO launch position (the offer is open at this point of the suite), not counted as a sale
  assert.equal((await api('GET', '/api/entitlements/overview')).json.launchOffer.open, true, 'precondition: the launch offer is open');
  const posBefore = (await sql('select count(*)::int n from public.launch_allocations'))[0].n; const salesBefore = (await api('GET', '/api/stats/ebooks')).json.count;
  assert.equal((await g({ email: 'gift.reader@example.com', edition: 'online', questions: 50, reason: 'a gift for a reviewer' })).status, 400, 'Online has no question limit');
  assert.equal((await g({ email: 'gift.reader@example.com', edition: 'companion', questions: 0, reason: 'a gift for a reviewer' })).status, 400);
  assert.equal((await g({ email: 'gift.reader@example.com', edition: 'companion', months: 99, reason: 'a gift for a reviewer' })).status, 400);
  const gift = await g({ email: 'gift.reader@example.com', edition: 'companion', questions: 250, months: 24, reason: 'a gift for a reviewer' });
  assert.equal(gift.status, 201, JSON.stringify(gift.json));
  const ge = (await api('GET', '/api/entitlements?q=gift.reader')).json.items[0];
  assert.equal(ge.launchPosition, null, 'a complimentary grant never takes a launch position'); assert.equal(ge.allowance.total_limit, 250);
  assert.equal((await sql('select count(*)::int n from public.launch_allocations'))[0].n, posBefore, 'the launch counter did not move');
  const monthsAway = (new Date(ge.askSidExpiresAt).getTime() - Date.now()) / (30.4 * 24 * 3600 * 1000); assert.ok(monthsAway > 23.5 && monthsAway < 24.5, `Ask SID lasts about 24 months (got ${monthsAway.toFixed(2)})`);
  assert.equal((await api('GET', '/api/stats/ebooks')).json.count, salesBefore, 'a complimentary grant is not a sale');
  assert.equal((await api('GET', '/api/orders')).json.orders.find((o) => o.email === 'gift.reader@example.com').is_complimentary, true);
  const rv = await api('POST', `/api/entitlements/${ge.id}/action`, { action: 'revoke', reason: 'gift period over' }); assert.equal(rv.status, 200);
  assert.equal((await api('GET', '/api/entitlements?q=gift.reader')).json.items[0].accessStatus, 'revoked', 'Revoke works on a complimentary grant');
  assert.equal((await g({ email: 'owner.test@example.com', edition: 'companion' })).status, 400, 'no reason');
  assert.equal((await g({ email: 'not-an-email', edition: 'companion', reason: 'owner testing' })).status, 400);
  assert.equal((await g({ email: 'owner.test@example.com', edition: 'gold', reason: 'owner testing' })).status, 400);
  const ok = await g({ email: 'Owner.Test@Example.com', edition: 'companion', reason: 'owner testing' });
  assert.equal(ok.status, 201, JSON.stringify(ok.json)); assert.equal(ok.json.ok, true);
  const e = (await api('GET', '/api/entitlements?q=owner.test')).json.items[0];
  assert.equal(e.edition, 'companion'); assert.equal(e.accessStatus, 'active'); assert.equal(e.email, 'owner.test@example.com'); assert.ok(e.allowance.total_limit >= 100);
  assert.equal((await g({ email: 'owner.test@example.com', edition: 'companion', reason: 'owner testing' })).status, 409, 'already has access');
  assert.equal((await g({ email: 'owner.test@example.com', edition: 'online', reason: 'owner testing' })).status, 409, 'Companion already includes the reader');
  const a = await sql("select detail from public.admin_audit_log where action='entitlement.manual_grant' order by id");
  assert.equal(a.length, 2, 'the gift and the owner grant'); const mine = a.find((x) => x.detail.reason === 'owner testing'); assert.ok(mine);
  assert.ok(!JSON.stringify(a).includes('owner.test@') && !JSON.stringify(a).includes('gift.reader@'), 'the audit log does not keep the full e-mail');
  assert.equal((await raw('POST', '/api/entitlements/grant', { body: { email: 'a@b.co', edition: 'online', reason: 'abcdef' } })).status, 401);
});

const CSV = [
  'Order ID,Date,Customer Email,Customer Name,Product Name,Total,Currency,Status',
  'XB0Jkl88WL,2026-11-16 09:00:00,qutub.siddiqui92@gmail.com,Qutub,"Marketing Reclassified: Digital Companion Edition",0.00,USD,Completed',
  '8B1EaZQrBZ,2026-11-12 10:30:00,mmoin58@yahoo.com,Moin,"Marketing Reclassified: Digital Companion Edition",0.00,USD,Completed',
  'OLD111,2026-11-10 08:00:00,reader@example.com,Rita,"Marketing Reclassified: Online Reading Edition",0.00,USD,Completed',
  'UPG222,2026-11-11 08:00:00,reader@example.com,Rita,"Marketing Reclassified: Upgrade to Digital Companion",0.00,USD,Completed',
  'TST333,2026-11-13 08:00:00,tester@example.com,T,"$1 Test product",1.00,USD,Completed',
  'REF444,2026-11-13 09:00:00,refunded@example.com,R,"Marketing Reclassified: Digital Companion Edition",49.99,USD,Refunded',
  'BAD555,2026-11-14 09:00:00,not-an-email,B,"Marketing Reclassified: Digital Companion Edition",49.99,USD,Completed',
].join('\r\n');

test('G2. Payhip import: the check changes nothing; unrelated, refunded and invalid rows are skipped; $0 orders are accepted; re-import is a no-op', async () => {
  const imp = (b) => api('POST', '/api/entitlements/import-payhip', b);
  assert.equal((await imp({})).status, 400); assert.equal((await imp({ csv: 'Name,Product\nA,B,C,D,E,F' })).status, 400, 'no e-mail column');
  const before = (await sql('select count(*)::int n from public.orders'))[0].n;
  const pre = await imp({ csv: CSV }); assert.equal(pre.status, 200); assert.equal(pre.json.dryRun, true);
  assert.equal(pre.json.summary.toImport, 4); assert.equal(pre.json.summary.skipped, 3);
  const why = Object.fromEntries(pre.json.items.map((i) => [i.txid, i.reason || i.action]));
  assert.match(why.TST333, /not one of the three/); assert.match(why.REF444, /refunded/); assert.match(why.BAD555, /valid e-mail/);
  assert.equal((await sql('select count(*)::int n from public.orders'))[0].n, before, 'checking saved nothing');
  assert.equal((await imp({ csv: CSV, apply: true })).status, 400, 'confirming needs a reason');
  const done = await imp({ csv: CSV, apply: true, reason: 'webhook never reached the site; importing the Payhip export' });
  assert.equal(done.status, 200, JSON.stringify(done.json)); assert.equal(done.json.summary.imported, 4); assert.equal(done.json.summary.failed, 0);
  const ents = (await api('GET', '/api/entitlements?pageSize=100')).json.items;
  const by = Object.fromEntries(ents.filter((i) => i.accessStatus === 'active').map((i) => [i.email, i.edition]));
  assert.equal(by['qutub.siddiqui92@gmail.com'], 'companion'); assert.equal(by['mmoin58@yahoo.com'], 'companion');
  assert.equal(by['reader@example.com'], 'companion', 'the later upgrade replaced the earlier Online purchase');
  assert.equal(by['tester@example.com'], undefined); assert.equal(by['refunded@example.com'], undefined);
  const rit = ents.filter((i) => i.email === 'reader@example.com'); assert.equal(rit.length, 2, 'both purchases stay in the history');
  const again = await imp({ csv: CSV, apply: true, reason: 'second run to prove it is safe' });
  assert.equal(again.json.summary.imported, 0, 'nothing is imported twice'); assert.equal(again.json.summary.toImport, 0);
  assert.equal((await sql("select count(*)::int n from public.admin_audit_log where action='entitlement.import_payhip'"))[0].n, 2);
});

const REAL_HEADER = '"Order ID",Email,"First Name","Last Name",Currency,"Amount Gross","Amount Net",Status,"Num of Items In Cart","Items In Cart","Payment Type","PayPal/Stripe Fee","Payhip Fee","Unsubscribed From Email Updates","Unconsented From Emails (EU GDPR)","Payhip Collected Sales Tax On Your Behalf","Payhip Collected Sales Tax Amount","Payhip Collected Sales Tax In Country","Sales Tax Included In Price","Custom VAT Applied","Custom VAT Amount","Custom VAT Included In Price","Custom VAT Country Name","Company VAT Number","Checkout Questions Enabled","Checkout Responses","Intake Form","Coupon Code Applied","Coupon Code","Coupon Percentage Off","Coupon Discount Amount","Shipping Address","Address Line 1","Address Line 2",City,"State Name","ZIP / Postcode","Country Name","Phone Number","Fulfillment Type","Fulfillment Status","Shipping Rate Name","Shipping Profile Name","Number Of Downloads","License Key",Additional,Notes,Date';
const realRow = (id, email, first, last, product, pay, gross, coupon, date) => `${id},${email},${first},${last},USD,${gross},${gross},COMPLETED,1,"${product}",${pay},,0.00,0,0,0,0.00,,0,0,0.00,0,,,1,"I agree to the Terms of Use, Refund Policy and Privacy Policy.: ""Agreed""",,${coupon ? 1 : 0},${coupon},100,49.99,,,,,,,"United Arab Emirates",,,,,,2,,,,${date}`;
test('G4. the real Payhip export layout: product read from "Items In Cart", names joined, quoted fields kept, test product skipped, only ticked rows imported', async () => {
  const csv = [REAL_HEADER,
    realRow('RR0001', 'buyer.one@yahoo.com', '', '', 'Marketing Reclassified: Digital Companion Edition', 'free', '0.00', 'SIDDIQUI12', '2026-11-12'),
    realRow('RR0002', 'buyer.two@gmail.com', 'Amal', 'Rahman', 'Marketing Reclassified: Online Reading Edition.', 'free', '0.00', 'TESTINGREADER', '2026-11-16'),
    realRow('RR0003', 'tester.three@gmail.com', 'Test', 'Er', 'Marketing Reclassified: Digital Companion Edition', 'free', '0.00', 'TESTING8', '2026-11-16'),
    realRow('RR0004', 'dev@example.com', 'Dev', 'One', 'Test product', 'free', '0.00', 'TESTING_1', '2026-11-03'),
    realRow('RR0005', 'paid.test@example.com', '', '', 'Test product', 'paypal', '1.00', '', '2026-11-03'),
  ].join('\r\n');
  const imp = (b) => api('POST', '/api/entitlements/import-payhip', b);
  const pre = await imp({ csv }); assert.equal(pre.status, 200, JSON.stringify(pre.json));
  assert.equal(pre.json.columns.product, 'Items In Cart'); assert.equal(pre.json.columns.email, 'Email'); assert.equal(pre.json.columns.date, 'Date'); assert.equal(pre.json.columns.amount, 'Amount Gross'); assert.equal(pre.json.columns.status, 'Status');
  assert.equal(pre.json.summary.toImport, 3); assert.equal(pre.json.summary.skipped, 2);
  const byTx = Object.fromEntries(pre.json.items.map((i) => [i.txid, i]));
  assert.equal(byTx.RR0001.edition, 'companion'); assert.equal(byTx.RR0001.coupon, 'SIDDIQUI12'); assert.equal(byTx.RR0001.name, 'Valued Reader');
  assert.equal(byTx.RR0002.edition, 'online'); assert.equal(byTx.RR0002.name, 'Amal Rahman');
  assert.equal(byTx.RR0004.action, 'skip'); assert.equal(byTx.RR0005.action, 'skip');
  assert.equal((await imp({ csv, apply: true, reason: 'only the real buyers', lines: [] })).status, 400, 'nothing selected');
  const done = await imp({ csv, apply: true, reason: 'only the real buyers', lines: [byTx.RR0001.line, byTx.RR0002.line] });
  assert.equal(done.status, 200, JSON.stringify(done.json)); assert.equal(done.json.summary.imported, 2); assert.equal(done.json.summary.selected, 2);
  const act = Object.fromEntries((await api('GET', '/api/entitlements?pageSize=100')).json.items.filter((i) => i.accessStatus === 'active').map((i) => [i.email, i.edition]));
  assert.equal(act['buyer.one@yahoo.com'], 'companion'); assert.equal(act['buyer.two@gmail.com'], 'online'); assert.equal(act['tester.three@gmail.com'], undefined, 'the unticked test row was not imported');
  const again = await imp({ csv }); assert.equal(again.json.summary.toImport, 1, 'only the unticked row is still importable; the two done rows are recognised');
});

test('G5. marking orders as test: the order and its access stay, but sales, order counts and statistics no longer include it; reversible; needs a reason; audited', async () => {
  await sql('alter table public.orders add column if not exists raw_metadata jsonb');
  await addOrder(951, 'keeps.reading@example.com', { amount: 49.99 }); await grant(951, 'keeps.reading@example.com', 'companion');
  await addOrder(952, 'real.buyer@example.com', { amount: 30 });
  const stats = async () => (await api('GET', '/api/stats/ebooks')).json;
  const before = await stats(); const tlBefore = (await api('GET', '/api/stats/timeline')).status;
  const mark = (b) => api('POST', '/api/orders/mark-test', b);
  assert.equal((await mark({ ids: [uuid(951)] })).status, 400, 'no reason'); assert.equal((await mark({ ids: [], reason: 'client tester' })).status, 400); assert.equal((await mark({ ids: ['x'], reason: 'client tester' })).status, 400);
  const ok = await mark({ ids: [uuid(951)], reason: 'client tester who is also reading the book' });
  assert.equal(ok.status, 200, JSON.stringify(ok.json)); assert.equal(ok.json.updated, 1);
  const after = await stats();
  assert.equal(after.count, before.count - 1, 'the order is no longer counted'); assert.ok(Math.abs((before.total - after.total) - 49.99) < 0.001, 'its amount left the sales total');
  const list = (await api('GET', '/api/orders')).json.orders; assert.equal(list.find((o) => o.id === uuid(951)).is_test, true); assert.equal(list.find((o) => o.id === uuid(952)).is_test, false, 'other orders are unaffected');
  const ent = (await api('GET', '/api/entitlements?q=keeps.reading')).json.items[0]; assert.equal(ent.accessStatus, 'active', 'the access is untouched'); assert.equal(ent.edition, 'companion');
  // (the timeline page needs tables this small test database does not have; what matters is that flagging changes nothing about how it answers)
  assert.equal((await api('GET', '/api/stats/timeline')).status, tlBefore, 'the timeline answers the same way as before');
  assert.equal((await mark({ ids: [uuid(951)], test: false, reason: 'counts again' })).status, 200);
  assert.equal((await stats()).count, before.count, 'switching it back restores the totals');
  const a = await sql("select action from public.admin_audit_log where action in ('order.mark_test','order.unmark_test') order by id"); assert.deepEqual(a.map((x) => x.action), ['order.mark_test', 'order.unmark_test']);
  assert.equal((await raw('POST', '/api/orders/mark-test', { body: {} })).status, 401); assert.equal((await raw('POST', '/api/orders/mark-test', { token: 'customer-token', body: {} })).status, 403);
});

test('K1. coupons "Applies to": LAUNCH30 works only for the Digital Companion; other products are refused; ordinary coupons are unchanged; admin-only to change', async () => {
  const COMP = { productId: uuid(11), accessType: 'companion' }, ONL = { productId: uuid(11), accessType: 'online' }, OTHER = { productId: uuid(12), accessType: 'download' };
  const pub = (b) => raw('POST', '/api/public/coupons/validate', { body: b });
  const create = (b) => api('POST', '/api/coupons', b);
  assert.equal((await raw('POST', '/api/coupons', { body: { code: 'X1', discount_percentage: 10 } })).status, 401); assert.equal((await raw('POST', '/api/coupons', { token: 'customer-token', body: { code: 'X1', discount_percentage: 10 } })).status, 403, 'only an administrator can change coupons');
  const made = await create({ code: 'launch30', discount_percentage: 30, applies_to: ['companion', 'bogus', 'companion', 'product:not-a-uuid'] });
  assert.equal(made.status, 201, JSON.stringify(made.json)); assert.deepEqual(made.json.coupon.applies_to, ['companion'], 'unknown and duplicate keys are dropped');
  assert.deepEqual((await api('GET', '/api/coupons')).json.coupons.find((c) => c.code === 'LAUNCH30').applies_to, ['companion'], 'the list shows it (the admin screen reads this)');
  const ok = await pub({ code: 'LAUNCH30', subtotal: 49.99, items: [COMP] }); assert.equal(ok.status, 200, JSON.stringify(ok.json)); assert.equal(ok.json.valid, true); assert.deepEqual(ok.json.discount.applies_to, ['companion']);
  assert.equal((await pub({ code: 'LAUNCH30', subtotal: 20, items: [ONL] })).status, 400, 'Online Reading is not covered');
  const no = await pub({ code: 'LAUNCH30', subtotal: 20, items: [ONL] }); assert.match(no.json.error, /applies only to the Digital Companion Edition/);
  assert.equal((await pub({ code: 'LAUNCH30', subtotal: 20, items: [OTHER] })).status, 400, 'another book is not covered');
  assert.equal((await pub({ code: 'LAUNCH30', subtotal: 70, items: [ONL, COMP] })).status, 200, 'a cart holding the Companion qualifies (only that item is reduced by the site)');
  assert.equal((await pub({ code: 'LAUNCH30', subtotal: 49.99 })).status, 400, 'no cart given: a restricted coupon cannot be confirmed, so it is refused');
  assert.equal((await pub({ code: 'LAUNCH30', subtotal: 49.99, items: [{ productId: uuid(11), accessType: 'upgrade' }] })).status, 200, 'the Upgrade is the Companion at a difference price');
  // an ordinary coupon (no restriction) behaves exactly as before, with or without a cart
  assert.equal((await create({ code: 'WELCOME5', discount_percentage: 5 })).status, 201);
  assert.equal((await pub({ code: 'WELCOME5', subtotal: 20 })).status, 200); assert.equal((await pub({ code: 'WELCOME5', subtotal: 20, items: [OTHER] })).status, 200); assert.deepEqual((await pub({ code: 'WELCOME5', subtotal: 20 })).json.discount.applies_to, []);
  // changing it: tick Online as well, then back to all products
  const id = made.json.coupon.id;
  assert.equal((await api('PUT', `/api/coupons/${id}`, { applies_to: ['companion', 'online'] })).status, 200); assert.equal((await pub({ code: 'LAUNCH30', subtotal: 20, items: [ONL] })).status, 200);
  assert.equal((await api('PUT', `/api/coupons/${id}`, { applies_to: [] })).status, 200); assert.equal((await pub({ code: 'LAUNCH30', subtotal: 20, items: [OTHER] })).status, 200, 'nothing ticked = every product');
  assert.equal((await api('PUT', `/api/coupons/${id}`, { description: 'renamed' })).json.coupon.applies_to.length, 0, 'editing something else leaves "Applies to" alone');
  // a specific product
  assert.equal((await api('PUT', `/api/coupons/${id}`, { applies_to: [`product:${uuid(12)}`] })).status, 200); assert.equal((await pub({ code: 'LAUNCH30', subtotal: 20, items: [OTHER] })).status, 200); assert.equal((await pub({ code: 'LAUNCH30', subtotal: 49.99, items: [COMP] })).status, 400);
});

test('N1. everything the website reads under /api/public is never cached (offer, prices, settings, coupons)', async () => {
  for (const p of ['/api/public/offer-banner', '/api/public/products', '/api/public/ask-sid-config', '/api/public/products/by-slug/marketing-reclassified']) {
    const r = await raw('GET', p); assert.match(String(r.headers['cache-control'] || ''), /no-store/, `${p} must say no-store (status ${r.status})`); assert.ok(!/max-age=[1-9]/.test(String(r.headers['cache-control'])), `${p} has no max-age`);
  }
  assert.match(String((await raw('POST', '/api/public/coupons/validate', { body: { code: 'NOPE' } })).headers['cache-control'] || ''), /no-store/);
});

test('G3. removing test orders: reason + safety copy first; orders that give access are refused unless access is ended; the rest is untouched', async () => {
  const rm = (b) => api('POST', '/api/orders/remove', b);
  await addOrder(901, 'oldtest@example.com'); await addOrder(902, 'oldtest2@example.com');
  const total = (await sql('select count(*)::int n from public.orders'))[0].n;
  assert.equal((await rm({ ids: [uuid(901)] })).status, 400, 'no reason'); assert.equal((await rm({ ids: [], reason: 'test orders' })).status, 400); assert.equal((await rm({ ids: ['nope'], reason: 'test orders' })).status, 400);
  const r = await rm({ ids: [uuid(901), uuid(902)], reason: '26 October test scenarios' });
  assert.equal(r.status, 200, JSON.stringify(r.json)); assert.equal(r.json.removed, 2);
  assert.equal((await sql('select count(*)::int n from public.orders'))[0].n, total - 2);
  const copies = await sql("select detail from public.admin_audit_log where action='order.remove'"); assert.equal(copies.length, 2); assert.ok(copies.every((c) => c.detail.order && c.detail.order.email && c.detail.reason));
  const live = (await sql("select id from public.orders where email='qutub.siddiqui92@gmail.com'"))[0].id;
  const blocked = await rm({ ids: [live], reason: 'owner test order' }); assert.equal(blocked.status, 409); assert.equal(blocked.json.activeCount, 1);
  assert.equal((await sql('select count(*)::int n from public.orders where id=$1', [live]))[0].n, 1, 'still there');
  const ended = await rm({ ids: [live], reason: 'owner test order', revokeAccess: true }); assert.equal(ended.status, 200); assert.equal(ended.json.accessEnded, 1);
  const q = (await api('GET', '/api/entitlements?q=qutub')).json.items[0]; assert.equal(q.accessStatus, 'revoked');
  assert.equal((await rm({ ids: [uuid(5000)], reason: 'does not exist' })).status, 404);
  assert.equal((await raw('POST', '/api/orders/remove', { body: {} })).status, 401); assert.equal((await raw('POST', '/api/orders/remove', { token: 'customer-token', body: {} })).status, 403);
});

test('G6. complimentary grant with NO END DATE: Ask SID access has no end, takes no launch position, is not a sale; "months" and "no end date" cannot be combined', async () => {
  const g = (b) => api('POST', '/api/entitlements/grant', b);
  const salesBefore = (await api('GET', '/api/stats/ebooks')).json.count; const posBefore = (await sql('select count(*)::int n from public.launch_allocations'))[0].n;
  assert.equal((await g({ email: 'forever.reader@example.com', edition: 'companion', months: 12, noEnd: true, reason: 'a friend of the book' })).status, 400, 'months OR no end date');
  const r = await g({ email: 'Forever.Reader@Example.com', edition: 'companion', noEnd: true, questions: 300, reason: 'a lifelong friend of the book' });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const e = (await api('GET', '/api/entitlements?q=forever.reader')).json.items[0];
  const years = (new Date(e.askSidExpiresAt).getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000);
  assert.ok(years > 99 && years < 101, `the end date is about 100 years away, which the screens show as "No end date" (got ${years.toFixed(1)} years)`);
  assert.equal(e.accessStatus, 'active'); assert.equal(e.launchPosition, null); assert.equal(e.allowance.total_limit, 300);
  assert.equal((await sql('select count(*)::int n from public.launch_allocations'))[0].n, posBefore, 'no launch position taken');
  assert.equal((await api('GET', '/api/stats/ebooks')).json.count, salesBefore, 'not a sale');
  assert.equal((await api('GET', '/api/orders')).json.orders.find((o) => o.email === 'forever.reader@example.com').is_complimentary, true);
  const a = await sql("select detail from public.admin_audit_log where action='entitlement.manual_grant' and detail->>'reason'='a lifelong friend of the book'");
  assert.equal(a.length, 1); assert.equal(a[0].detail.noEnd, true);
  // Online Reading has no end date anyway: the option is simply ignored for it
  const on = await g({ email: 'forever.online@example.com', edition: 'online', noEnd: true, reason: 'reader copy for a reviewer' }); assert.equal(on.status, 201, JSON.stringify(on.json));
  // a customer with that e-mail can be revoked at once
  const rv = await api('POST', `/api/entitlements/${e.id}/action`, { action: 'revoke', reason: 'no longer needed' }); assert.equal(rv.status, 200);
});
