/**
 * Test-only preload (node -r). Replaces the admin server's Supabase client and nodemailer with in-memory
 * fakes so the REAL src/index.js can be started and exercised over HTTP without any network, database
 * or e-mail account. Nothing here is loaded in production.
 *
 * Fake sessions (Bearer tokens):
 *   admin-token     administrator            (app_metadata.role = 'admin')
 *   customer-token  ordinary customer        (Google sign-in, no role)
 *   spoof-token     customer who put 'admin' in user_metadata (a field a user can edit themselves)
 *   mailbox-token   customer whose e-mail equals ADMIN_EMAIL (e-mail addresses must not grant admin)
 *   editor-token / support-token   dashboard staff (app_metadata.role = 'editor' / 'support')
 *   owner2-token    a second Owner (role 'admin')
 * Users are LIVE: createUser / updateUserById really change them (app_metadata is MERGED, and a null value deletes a key, as in Supabase),
 * so a test can add, change and remove a person and then see the new rights at once.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..'); // .../server
const LOG = process.env.FAKE_CALL_LOG;
const log = (entry) => { if (LOG) fs.appendFileSync(LOG, JSON.stringify(entry) + '\n'); };

let createdSeq = 0;
const USERS = {
  'admin-token': { id: 'a0000000-0000-4000-8000-000000000001', email: 'admin@example.com', email_confirmed_at: '2024-01-01T00:00:00Z', app_metadata: { provider: 'email', role: 'admin' }, user_metadata: {} },
  'customer-token': { id: 'u-cust', email: 'cust@example.com', email_confirmed_at: '2024-01-01T00:00:00Z', app_metadata: { provider: 'google' }, user_metadata: { full_name: 'A Customer' } },
  'spoof-token': { id: 'u-spoof', email: 'spoof@example.com', email_confirmed_at: '2024-01-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: { role: 'admin', account_type: 'admin' } },
  'unconfirmed-token': { id: 'u-unconf', email: 'new@example.com', email_confirmed_at: null, app_metadata: { provider: 'email' }, user_metadata: {} },
  'editor-token': { id: 'e0000000-0000-4000-8000-000000000001', email: 'editor@example.com', email_confirmed_at: '2024-01-01T00:00:00Z', created_at: '2024-02-01T00:00:00Z', last_sign_in_at: '2026-11-01T00:00:00Z', app_metadata: { provider: 'email', role: 'editor' }, user_metadata: {} },
  'support-token': { id: 'e0000000-0000-4000-8000-000000000002', email: 'support@example.com', email_confirmed_at: '2024-01-01T00:00:00Z', app_metadata: { provider: 'email', role: 'support' }, user_metadata: {} },
  'owner2-token': { id: 'e0000000-0000-4000-8000-000000000003', email: 'owner2@example.com', email_confirmed_at: '2024-01-01T00:00:00Z', app_metadata: { provider: 'email', role: 'admin' }, user_metadata: {} },
  'mailbox-token': { id: 'u-mail', email: (process.env.ADMIN_EMAIL || 'owner@example.com'), email_confirmed_at: '2024-01-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {} },
};

// Chainable, awaitable stand-in for supabase.from(table)...  Every chain resolves to an empty result;
// writes are recorded so tests can assert exactly what an endpoint tried to store.
function chain(table) {
  const state = { table, op: 'select' };
  const proxy = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') {
        return (resolve, reject) => {
          if (state.op !== 'select') log({ table: state.table, op: state.op, payload: state.payload });
          const empty = state.single ? { data: null, error: null } : { data: [], error: null, count: 0 };
          return Promise.resolve(empty).then(resolve, reject);
        };
      }
      return (...args) => {
        if (['insert', 'update', 'upsert', 'delete'].includes(String(prop))) { state.op = String(prop); state.payload = args[0]; }
        if (prop === 'single' || prop === 'maybeSingle') state.single = true;
        return proxy;
      };
    },
  });
  return proxy;
}

const supabaseAdmin = {
  from: (table) => chain(table),
  storage: { from: () => ({ upload: async () => ({ data: {}, error: null }), getPublicUrl: () => ({ data: { publicUrl: 'https://example.invalid/x' } }), remove: async () => ({ error: null }), list: async () => ({ data: [], error: null }) }) },
  rpc: async () => ({ data: null, error: null }),
  auth: {
    getUser: async (token) => (USERS[token] ? { data: { user: USERS[token] }, error: null } : { data: { user: null }, error: { message: 'invalid token' } }),
    signInWithPassword: async () => ({ data: {}, error: { message: 'unused on the admin client' } }),
    admin: {
      createUser: async (args) => {
        log({ call: 'auth.admin.createUser', email: args && args.email });
        const dup = Object.values(USERS).find((u) => u.email === (args && args.email));
        if (dup) return { data: { user: null }, error: { message: 'A user with this email address has already been registered' } };
        const user = { id: 'c0000000-0000-4000-8000-' + String(++createdSeq).padStart(12, '0'), email: args && args.email, email_confirmed_at: args && args.email_confirm ? '2026-11-19T00:00:00Z' : null, created_at: '2026-11-19T00:00:00Z', app_metadata: { provider: 'email', ...((args && args.app_metadata) || {}) }, user_metadata: (args && args.user_metadata) || {} };
        USERS['created:' + user.email] = user;
        return { data: { user }, error: null };
      },
      listUsers: async () => ({ data: { users: Object.values(USERS) }, error: null }),
      updateUserById: async (id, attrs) => {
        log({ call: 'auth.admin.updateUserById', id, attrs });
        const u = Object.values(USERS).find((x) => x.id === id);
        if (u && attrs && attrs.app_metadata) { for (const [k, v] of Object.entries(attrs.app_metadata)) { if (v === null) delete u.app_metadata[k]; else u.app_metadata[k] = v; } }
        return { data: {}, error: null };
      },
      generateLink: async () => ({ data: { properties: { action_link: 'https://project.supabase.co/auth/v1/verify?token=TOKEN123&type=recovery' } }, error: null }),
    },
  },
};

// The anon client is what /api/auth/sign-in uses.
const supabase = {
  auth: {
    signInWithPassword: async ({ email, password }) =>
      (email === 'admin@example.com' && password === 'correct-password')
        ? { data: { user: USERS['admin-token'], session: { access_token: 'admin-token' } }, error: null }
        : { data: {}, error: { message: 'Invalid login credentials' } },
  },
};

function stub(request, exports_) {
  const resolved = require.resolve(request, { paths: [root] });
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exports_, children: [], paths: [] };
}

stub(path.join(root, 'src', 'config', 'supabase.js'), { supabaseAdmin, supabase });
stub('nodemailer', { createTransport: () => ({ sendMail: async (opts) => { log({ call: 'sendMail', to: opts.to, subject: opts.subject, html: opts.html }); return {}; } }) });
