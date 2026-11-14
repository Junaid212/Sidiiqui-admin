/**
 * Test-only preload for the feature tests of the admin server. Loads the standard admin fakes (sessions, mail), then replaces
 * the Supabase admin client with one backed by a REAL PostgreSQL engine (PGlite) that has the feature migration applied, plus
 * minimal orders / ebooks tables and an in-memory storage. A small debug HTTP port (FAKE_PG_DEBUG_PORT) lets the tests run SQL.
 */
'use strict';
const path = require('path');
const http = require('http');
require('./preload-fake-admin-deps.cjs');
const root = path.resolve(__dirname, '..', '..');
const { createPgSupabase } = require('./pglite-supabase.cjs');

const cfgPath = require.resolve(path.join(root, 'src', 'config', 'supabase.js'));
const base = require.cache[cfgPath].exports;
const pg = createPgSupabase({ migrationPath: path.resolve(root, '..', 'supabase', 'migrations', '20261110_features_foundation.sql'), launchOpen: process.env.FAKE_LAUNCH_OPEN !== '0' });
const ready = pg.ready.then(() => pg.db.exec(`
  CREATE TABLE public.orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, email text, order_number text, payment_provider text, amount numeric, currency text DEFAULT 'USD',
    status text, refund_status text, download_token text, product_id text, book_name text, access_tier text, is_upgrade boolean DEFAULT false, created_at timestamptz DEFAULT now());
  CREATE TABLE public.ebooks (id uuid PRIMARY KEY, title text, file_path text);
  INSERT INTO public.ebooks (id, title, file_path) VALUES ('04b84648-3609-4b31-9ded-2486bacf1e74', 'Marketing Reclassified', 'ebooks/marketing-reclassified.pdf');
`));
pg.ready = ready;

const files = new Map();
const storage = { from: (bucket) => ({
  upload: async (p, buf) => { if (files.has(bucket + '/' + p)) return { data: null, error: { message: 'The resource already exists' } }; files.set(bucket + '/' + p, Buffer.from(buf)); return { data: { path: p }, error: null }; },
  download: async (p) => (files.has(bucket + '/' + p) ? { data: new Blob([files.get(bucket + '/' + p)]), error: null } : { data: null, error: { message: 'Object not found' } }),
  remove: async (list) => { for (const p of list) files.delete(bucket + '/' + p); return { data: {}, error: null }; },
  getPublicUrl: (p) => ({ data: { publicUrl: 'https://example.invalid/' + p } }),
}) };

// Real Supabase user ids are uuids (the feature tables store them); the standard fakes use short ids, so map them to uuid-shaped ones.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const origAuth = base.supabaseAdmin.auth;
const auth = { ...origAuth, getUser: async (token) => { const r = await origAuth.getUser(token); if (r.data && r.data.user && !UUID_RE.test(r.data.user.id)) r.data.user = { ...r.data.user, id: '00000000-0000-4000-8000-' + Buffer.from(String(r.data.user.id)).toString('hex').padStart(12, '0').slice(0, 12) }; return r; } };
base.supabaseAdmin = { from: (t) => pg.from(t), rpc: (fn, a) => pg.rpc(fn, a || {}), storage, auth };

if (process.env.FAKE_PG_DEBUG_PORT) {
  http.createServer((req, res) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', async () => {
    try { await ready; const { sql, params } = JSON.parse(b || '{}'); const r = await pg.db.query(sql, params || []); res.end(JSON.stringify({ rows: r.rows })); }
    catch (e) { res.statusCode = 400; res.end(JSON.stringify({ error: e.message })); } }); }).listen(Number(process.env.FAKE_PG_DEBUG_PORT), '127.0.0.1');
}
