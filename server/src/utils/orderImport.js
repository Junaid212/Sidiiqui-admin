/**
 * orderImport.js - building order rows for two administrator tools:
 *   1. "Grant access" (a person who should have the book without a Payhip order, e.g. the owner testing);
 *   2. "Import Payhip orders" (the CSV from Payhip > Customers > Export), for purchases whose webhook never arrived.
 * The rows look exactly like the ones the Payhip webhook writes, so My Orders, downloads, the reader and Ask SID treat them the same.
 * Nothing here talks to Payhip; the CSV is read as text. Nothing is written until the caller says so.
 */
const crypto = require('crypto');

const MR_PRODUCT_ID = String(process.env.MR_PRODUCT_ID || '04b84648-3609-4b31-9ded-2486bacf1e74').toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** CSV text -> array of rows (arrays of strings). Handles quotes, escaped quotes, CRLF, a BOM and comma / semicolon / tab separators. */
function parseCsv(text) {
    let t = String(text || '').replace(/^﻿/, '');
    const first = t.split(/\r?\n/, 1)[0] || '';
    const delim = [',', ';', '\t'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = []; let cell = ''; let q = false;
    for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (q) {
            if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
        } else if (c === '"') q = true;
        else if (c === delim) { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = []; }
        else cell += c;
    }
    row.push(cell); if (row.some((x) => x.trim() !== '')) rows.push(row);
    return rows;
}

function findCol(headers, wanted, avoid = []) {
    const h = headers.map(norm);
    for (const w of wanted) { const i = h.findIndex((x, idx) => x === w && !avoid.some((a) => h[idx].includes(a))); if (i >= 0) return i; }
    for (const w of wanted) { const i = h.findIndex((x) => x.includes(w) && !avoid.some((a) => x.includes(a))); if (i >= 0) return i; }
    return -1;
}

function editionOf(text) {
    const s = String(text || '');
    if (/IpN7k/i.test(s) || /upgrade/i.test(s)) return { edition: 'companion', isUpgrade: true };
    if (/2H0Wr/i.test(s) || /companion/i.test(s)) return { edition: 'companion', isUpgrade: false };
    if (/Nr3Tp/i.test(s) || /online/i.test(s)) return { edition: 'online', isUpgrade: false };
    return null;
}

/** The Payhip export -> one entry per row, each with an `action` of import / skip, and the reason. Pure: reads nothing, writes nothing. */
function interpretPayhipCsv(csvText, { maxRows = 500 } = {}) {
    const rows = parseCsv(csvText);
    if (rows.length < 2) return { ok: false, error: 'The file has no data rows.' };
    const headers = rows[0].map((h) => String(h).trim());
    const col = {
        email: findCol(headers, ['email', 'customeremail', 'buyeremail']),
        tx: findCol(headers, ['orderid', 'transactionid', 'saleid', 'purchaseid', 'transaction', 'order', 'id']),
        product: findCol(headers, ['productname', 'product', 'itemsincart', 'items', 'item', 'title'], ['num', 'count', 'quantity']),
        name: findCol(headers, ['customername', 'buyername']),
        first: findCol(headers, ['firstname']),
        last: findCol(headers, ['lastname']),
        date: findCol(headers, ['date', 'createdat', 'purchasedat', 'purchasedate', 'time']),
        amount: findCol(headers, ['total', 'amount', 'price', 'paid', 'revenue'], ['tax', 'fee', 'discount', 'coupon', 'refund']),
        currency: findCol(headers, ['currency']),
        status: findCol(headers, ['status', 'refunded', 'refund']),
    };
    if (col.email < 0) return { ok: false, error: 'No e-mail column found. The first row must contain a column named like "Email". Columns seen: ' + headers.join(', ') };
    if (rows.length - 1 > maxRows) return { ok: false, error: `Too many rows (${rows.length - 1}); the limit is ${maxRows} per import.` };
    const items = [];
    for (let i = 1; i < rows.length; i++) {
        const r = rows[i]; const get = (k) => (col[k] >= 0 ? String(r[col[k]] || '').trim() : '');
        const email = get('email').toLowerCase();
        const product = get('product');
        // look at the product cell first; if it names nothing we know, look at the whole row (a product link or key may be elsewhere)
        const ed = editionOf(product) || editionOf(r.join(' '));
        let d = get('date') ? new Date(get('date')) : null; const dateOk = !!d && !Number.isNaN(d.getTime()); if (!dateOk) d = null;
        const amountStr = get('amount').replace(/[^0-9.\-]/g, ''); const amount = amountStr === '' || Number.isNaN(Number(amountStr)) ? 0 : Math.max(0, Number(amountStr));
        let tx = get('tx').replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 60);
        const fullName = (get('name') || `${get('first')} ${get('last')}`).trim().slice(0, 120);
        const it = { line: i + 1, email, name: fullName || 'Valued Reader', coupon: findCol(headers, ['couponcode']) >= 0 ? String(r[findCol(headers, ['couponcode'])] || '').trim().slice(0, 40) : '', product, txid: tx, date: d ? d.toISOString() : null, amount, currency: (get('currency') || 'USD').toUpperCase().slice(0, 3), edition: ed ? ed.edition : null, isUpgrade: ed ? ed.isUpgrade : false, action: 'import', reason: '' };
        if (!EMAIL_RE.test(email)) { it.action = 'skip'; it.reason = 'no valid e-mail address'; }
        else if (!ed) { it.action = 'skip'; it.reason = 'not one of the three Marketing Reclassified products'; }
        else if (/refund|chargeback|dispute/i.test(get('status'))) { it.action = 'skip'; it.reason = 'refunded in Payhip'; }
        if (!it.txid) it.txid = 'IMP' + crypto.createHash('sha1').update([email, product, it.date || '', i].join('|')).digest('hex').slice(0, 12).toUpperCase();
        if (!it.date) it.dateMissing = true;
        items.push(it);
    }
    return { ok: true, columns: Object.fromEntries(Object.entries(col).map(([k, v]) => [k, v >= 0 ? headers[v] : null])), items };
}

/** An orders row shaped like the webhook's. provider: 'payhip' (imports) or 'manual' (grants). */
function buildOrderRow({ email, name, edition, isUpgrade = false, txid, amount = 0, currency = 'USD', createdAt, provider = 'payhip', actor, reason }) {
    const online = edition === 'online';
    const id = crypto.randomUUID();
    const title = `Marketing Reclassified — ${online ? 'Online Reading Edition' : isUpgrade ? 'Digital Companion Edition (Upgrade)' : 'Digital Companion Edition'}`;
    const exact = Number(amount || 0).toFixed(2);
    const row = {
        id, user_id: null, email: String(email).toLowerCase(), customer_name: name || 'Valued Reader', product_id: MR_PRODUCT_ID,
        order_number: `ORD-${provider === 'manual' ? 'MANUAL' : 'PAYHIP'}-${txid}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        book_name: title, amount: Number(exact), currency: currency || 'USD', status: 'paid', payment_provider: provider,
        access_tier: online ? 'online' : 'companion', is_upgrade: !!isUpgrade,
        download_token: online ? null : crypto.randomBytes(32).toString('hex'),
        download_expires_at: online ? null : new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
        download_count: 0, download_limit: online ? 0 : 3,
        raw_metadata: { exact_amount: exact, [provider === 'manual' ? 'manual_grant' : 'imported_by_admin']: { by: actor || null, at: new Date().toISOString(), reason: reason || null } },
        created_at: createdAt || new Date().toISOString(),
    };
    if (provider === 'payhip') { row.payhip_transaction_id = txid; row.provider_transaction_id = txid; }
    return row;
}

/**
 * Insert with the same tolerance the webhook has for older database layouts: a whole-number amount column, a column that does
 * not exist, or a provider value the database does not allow ('manual' falls back to 'payhip', the fact kept in raw_metadata).
 */
async function insertOrder(supabaseAdmin, row) {
    let payload = { ...row };
    for (let attempt = 0; attempt < 12; attempt++) {
        const res = await supabaseAdmin.from('orders').insert([payload]);
        if (!res.error) return { ok: true, row: payload };
        const e = res.error; const msg = String(e.message || '');
        if (e.code === '22P02' && typeof payload.amount === 'number' && !Number.isInteger(payload.amount)) { payload.amount = Math.round(payload.amount); continue; }
        if (e.code === '23514' && /payment_provider/.test(msg) && payload.payment_provider === 'manual') { payload.payment_provider = 'payhip'; payload.raw_metadata = { ...payload.raw_metadata, provider_label: 'manual' }; continue; }
        const m = msg.match(/Could not find the '([^']+)' column/i) || msg.match(/column ['"]?([a-zA-Z0-9_]+)['"]? (?:of (?:relation )?['"]?orders['"]? )?does not exist/i);
        if (m && Object.prototype.hasOwnProperty.call(payload, m[1])) { delete payload[m[1]]; continue; }
        return { ok: false, error: e };
    }
    return { ok: false, error: { message: 'could not adapt the insert to this database layout' } };
}

module.exports = { MR_PRODUCT_ID, parseCsv, interpretPayhipCsv, buildOrderRow, insertOrder, EMAIL_RE };
