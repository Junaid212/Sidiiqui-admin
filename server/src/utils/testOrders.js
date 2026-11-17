/**
 * testOrders.js - orders that are kept (with the access they give) but never counted as sales or in order totals:
 *   - test orders, flagged by an administrator:   orders.raw_metadata.is_test = true
 *   - complimentary grants made in the admin:     orders.raw_metadata.manual_grant (written by "Grant complimentary access")
 * The flags live in raw_metadata, so no database change is needed. Only an administrator sets them, with a reason, audited.
 */
const { supabaseAdmin } = require('../config/supabase');

const meta = (o) => (o && o.raw_metadata && typeof o.raw_metadata === 'object' ? o.raw_metadata : {});
const isTestOrder = (o) => meta(o).is_test === true;
const isComplimentaryOrder = (o) => !!meta(o).manual_grant;
/** True for an order that must not count as a sale. */
const isExcludedOrder = (o) => isTestOrder(o) || isComplimentaryOrder(o);

/**
 * Paid / successful orders that count as real, with the requested columns. A database without the raw_metadata column
 * still answers (nothing can be flagged there), so a missing column never breaks a statistics page.
 */
async function realPaidOrders(columns, { orderBy } = {}) {
    const run = (cols) => {
        let q = supabaseAdmin.from('orders').select(cols).in('status', ['paid', 'successful']);
        if (orderBy) q = q.order(orderBy, { ascending: true });
        return q;
    };
    let res = await run(`${columns}, raw_metadata`);
    if (res.error && /raw_metadata/.test(String(res.error.message))) res = await run(columns);
    if (res.error) return { data: null, error: res.error };
    return { data: (res.data || []).filter((o) => !isExcludedOrder(o)), error: null };
}

module.exports = { isTestOrder, isComplimentaryOrder, isExcludedOrder, realPaidOrders };
