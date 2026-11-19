import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineUserGroup, HiOutlineRefresh } from 'react-icons/hi';
import { entitlements } from '../services/featureService';
import { useAuth } from '../context/AuthContext';

const card = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 };
const muted = { color: '#a6adc8', fontSize: '0.85rem' };
const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
// A complimentary Companion access given "no end date" is stored with an end date 100 years away (the database needs a date): shown as such.
const endLabel = (d) => (d && new Date(d).getUTCFullYear() >= 2100 ? 'No end date' : fmt(d));
const errText = (e) => (e && e.message) || 'Something went wrong';
const EDITION = { online: ['Online Reading', '#89b4fa'], companion: ['Digital Companion', '#a6e3a1'] };
const STATUS = { active: ['Active', '#a6e3a1'], revoked: ['Revoked', '#f38ba8'], ask_sid_expired: ['Ask SID expired', '#f9e2af'] };
const Pill = ({ map, k, extra }) => { const [label, color] = map[k] || [k, '#ccc']; return <span style={{ fontSize: '0.72rem', fontWeight: 700, color, border: `1px solid ${color}55`, borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap' }}>{label}{extra}</span>; };
const REFUND_REASON = { full_refund: 'Refunded', chargeback: 'Chargeback', upgraded: 'Upgraded to Companion', superseded: 'Replaced by Companion', administrative: 'Revoked by administrator' };

function ReasonModal({ title, askAmount, amountLabel, onCancel, onSubmit }) {
    const [reason, setReason] = useState(''); const [amount, setAmount] = useState('');
    const ok = reason.trim().length >= 5 && (!askAmount || /^-?\d+$/.test(amount));
    return (
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal" style={{ maxWidth: 480 }}>
                <div className="modal__header"><h2>{title}</h2></div>
                <div className="modal__body">
                {askAmount && <div className="form-group"><label>{amountLabel}</label><input className="form-input" aria-label={amountLabel} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" /></div>}
                <div className="form-group"><label>Reason (required, recorded in the audit log)</label><textarea className="form-textarea" aria-label="Reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
                <div className="form-actions"><button className="btn btn--outline" onClick={onCancel}>Cancel</button><button className="btn btn--primary" disabled={!ok} onClick={() => onSubmit({ reason: reason.trim(), amount: askAmount ? Number(amount) : undefined })}>Confirm</button></div>
                </div>
            </div>
        </div>
    );
}

function Detail({ id, onClose, onChanged }) {
    const { can } = useAuth(); // Support may revoke / restore; extending and adding questions are the Owner's
    const [d, setD] = useState(null); const [ask, setAsk] = useState(null);
    const load = useCallback(() => entitlements.detail(id).then(setD).catch((e) => toast.error(errText(e))), [id]);
    useEffect(() => { load(); }, [load]);
    if (!d) return <div className="modal-overlay"><div className="modal"><div className="spinner" /></div></div>;
    const e = d.entitlement; const a = d.allowance;
    async function submit(action, { reason, amount }) {
        try { await entitlements.action(id, { action, reason, amount }); toast.success('Done'); setAsk(null); await load(); onChanged(); } catch (x) { toast.error(errText(x)); }
    }
    const revokedByRefund = ['full_refund', 'chargeback'].includes(e.revoke_reason);
    return (
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal" style={{ maxWidth: 860, maxHeight: '92vh', overflow: 'auto' }} data-testid="entitlement-detail">
                <div className="modal__header"><h2>{e.email}</h2><button className="modal__close" onClick={onClose} aria-label="Close">×</button></div>
                <div className="modal__body">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <Pill map={EDITION} k={e.edition} /><Pill map={STATUS} k={e.accessStatus} />{e.is_upgrade && <Pill map={{ u: ['Upgrade', '#cba6f7'] }} k="u" />}
                    {e.launch_position && <Pill map={{ l: ['Launch offer', '#f9e2af'] }} k="l" extra={` #${e.launch_position}`} />}
                    {e.revoke_reason && <span style={muted}>{REFUND_REASON[e.revoke_reason] || e.revoke_reason} · {fmt(e.revoked_at)}</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))', gap: 10 }}>
                    <div style={card}><div style={muted}>Granted</div><b>{fmt(e.granted_at)}</b>{e.is_upgrade && <div style={muted}>upgrade date; the 12 months start here</div>}</div>
                    {e.edition === 'companion' && a && (<>
                        <div style={card}><div style={muted}>Ask SID access until</div><b data-testid="detail-ends">{endLabel(a.expires_at)}</b></div>
                        <div style={card}><div style={muted}>Today</div><b data-testid="allow-daily">{a.daily_used} / {a.daily_limit}</b> <span style={muted}>({a.daily_remaining} left)</span></div>
                        <div style={card}><div style={muted}>Total</div><b data-testid="allow-total">{a.total_used} / {a.total_limit}</b> <span style={muted}>({a.total_remaining} left)</span></div>
                    </>)}
                </div>
                <h3 style={{ marginTop: 18, color: '#fff' }}>Purchases and upgrades</h3>
                <div className="table-wrapper"><table className="data-table"><thead><tr><th>Order</th><th>Product</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>
                    {d.orders.map((o) => <tr key={o.id}><td>{o.order_number}</td><td>{o.book_name}{o.is_upgrade ? ' (upgrade)' : ''}</td><td>{fmt(o.created_at)}</td><td>{o.amount} {o.currency || 'USD'}</td><td>{o.status}{o.refund_status ? ` / ${o.refund_status}` : ''}</td></tr>)}
                </tbody></table></div>
                {d.replacedEntitlement && <p style={muted}>Replaced the {d.replacedEntitlement.edition} entitlement from {fmt(d.replacedEntitlement.granted_at)} ({REFUND_REASON[d.replacedEntitlement.revoke_reason] || d.replacedEntitlement.revoke_reason}).</p>}
                <h3 style={{ marginTop: 18, color: '#fff' }}>History</h3>
                <ul style={{ ...muted, paddingLeft: 18 }}>{d.events.map((ev) => <li key={ev.id}>{fmt(ev.created_at)} — {ev.event_type.replace(/_/g, ' ')} <span style={{ opacity: 0.7 }}>({ev.actor_label}){ev.detail && ev.detail.reason ? ` · ${ev.detail.reason}` : ''}</span></li>)}</ul>
                {e.edition === 'companion' && Object.keys(d.usageByDay).length > 0 && <p style={muted}>Questions by day: {Object.entries(d.usageByDay).map(([day, n]) => `${day}: ${n}`).join(' · ')}</p>}
                <div className="form-actions" style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {can('customers.manage') && e.edition === 'companion' && e.status === 'active' && <button className="btn btn--outline btn--sm" onClick={() => setAsk({ action: 'add_questions', title: 'Add (or remove) questions', amount: true, label: 'Number of questions (negative to remove)' })}>Add questions</button>}
                    {can('customers.manage') && e.edition === 'companion' && e.status === 'active' && <button className="btn btn--outline btn--sm" onClick={() => setAsk({ action: 'extend_months', title: 'Extend Ask SID access', amount: true, label: 'Months to add (1–24)' })}>Extend access</button>}
                    {can('customers.grant') && e.status === 'active' && <button className="btn btn--danger btn--sm" onClick={() => setAsk({ action: 'revoke', title: 'Revoke this entitlement' })} data-testid="revoke-access">Revoke access</button>}
                    {can('customers.grant') && e.status === 'revoked' && !revokedByRefund && <button className="btn btn--primary btn--sm" onClick={() => setAsk({ action: 'restore', title: 'Restore this entitlement' })}>Restore access</button>}
                    {revokedByRefund && <span style={muted}>A refunded purchase cannot be restored.</span>}
                </div>
                {ask && <ReasonModal title={ask.title} askAmount={ask.amount} amountLabel={ask.label} onCancel={() => setAsk(null)} onSubmit={(v) => submit(ask.action, v)} />}
                </div>
            </div>
        </div>
    );
}

function GrantModal({ onClose, onDone }) {
    const [email, setEmail] = useState(''); const [edition, setEdition] = useState('companion'); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
    const [questions, setQuestions] = useState(''); const [months, setMonths] = useState(''); const [noEnd, setNoEnd] = useState(false);
    const whole = (v, lo, hi) => v === '' || (/^\d+$/.test(v) && Number(v) >= lo && Number(v) <= hi);
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && reason.trim().length >= 5 && !busy && (edition === 'online' || (whole(questions, 1, 2000) && (noEnd || whole(months, 1, 60))));
    async function go() {
        setBusy(true);
        try {
            const body = { email: email.trim(), edition, reason: reason.trim() };
            if (edition === 'companion') { if (questions !== '') body.questions = Number(questions); if (noEnd) body.noEnd = true; else if (months !== '') body.months = Number(months); }
            const r = await entitlements.grant(body); toast.success(`Complimentary access granted (${r.orderNumber})`); onDone(); onClose();
        }
        catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
    }
    return (
        <div className="modal-overlay" role="dialog" aria-modal="true"><div className="modal" style={{ maxWidth: 500 }} data-testid="grant-modal">
            <div className="modal__header"><h2>Grant complimentary access</h2></div>
            <div className="modal__body">
                <p style={muted}>For someone who should have the book without paying (the owner testing, a reviewer, a gift). It is <b>not a sale</b>: it does not count in orders or revenue, and it never takes one of the 200 launch positions. The person signs in with this e-mail. To end it later, open the person in the list and choose <b>Revoke access</b>.</p>
                <div className="form-group"><label>E-mail the person signs in with</label><input className="form-input" aria-label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="form-group"><label>Edition</label><select className="form-input" aria-label="Edition" value={edition} onChange={(e) => setEdition(e.target.value)}><option value="companion">Digital Companion (reader + downloads + Ask SID)</option><option value="online">Online Reading (reader only)</option></select></div>
                {edition === 'companion' && (<div style={{ display: 'flex', gap: 10 }}>
                    <div className="form-group" style={{ flex: 1 }}><label>Ask SID questions in total (optional)</label><input className="form-input" aria-label="Ask SID questions" inputMode="numeric" value={questions} onChange={(e) => setQuestions(e.target.value)} placeholder="default: 100" /></div>
                    <div className="form-group" style={{ flex: 1 }}><label>Ask SID access: how long</label>
                        <select className="form-input" aria-label="Duration" value={noEnd ? 'none' : 'months'} onChange={(e) => setNoEnd(e.target.value === 'none')}><option value="months">A number of months</option><option value="none">No end date</option></select>
                        {!noEnd && <input className="form-input" style={{ marginTop: 6 }} aria-label="Duration in months" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} placeholder="months (default: 12)" />}
                    </div>
                </div>)}
                {edition === 'companion' && <p style={muted}>The daily limit stays at the normal number of questions per day. Downloads follow the usual rules. Online Reading has no question limit and no end date. Access can be ended at any time with <b>Revoke access</b>.</p>}
                <div className="form-group"><label>Reason (required, recorded in the audit log)</label><textarea className="form-textarea" aria-label="Reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. owner testing" /></div>
                <div className="form-actions"><button className="btn btn--outline" onClick={onClose}>Cancel</button><button className="btn btn--primary" disabled={!ok} onClick={go}>{busy ? 'Granting…' : 'Grant complimentary access'}</button></div>
            </div>
        </div></div>
    );
}

function ImportModal({ onClose, onDone }) {
    const [csv, setCsv] = useState(''); const [preview, setPreview] = useState(null); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [result, setResult] = useState(null);
    const [picked, setPicked] = useState({});
    function loadFile(f) { if (!f) return; const r = new FileReader(); r.onload = () => { setCsv(String(r.result || '')); setPreview(null); setResult(null); }; r.readAsText(f); }
    async function check() {
        setBusy(true); setResult(null);
        try { const p = await entitlements.importPayhip({ csv }); setPreview(p); setPicked(Object.fromEntries(p.items.filter((i) => i.action === 'import').map((i) => [i.line, true]))); }
        catch (e) { setPreview(null); toast.error(errText(e)); } finally { setBusy(false); }
    }
    const chosen = Object.keys(picked).filter((k) => picked[k]).map(Number);
    async function apply() { setBusy(true); try { const r = await entitlements.importPayhip({ csv, apply: true, reason: reason.trim(), lines: chosen }); setResult(r); setPreview(null); toast.success(`Imported ${r.summary.imported} order(s)`); onDone(); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); } }
    const s = preview && preview.summary;
    return (
        <div className="modal-overlay" role="dialog" aria-modal="true"><div className="modal" style={{ maxWidth: 900, maxHeight: '92vh', overflow: 'auto' }} data-testid="import-modal">
            <div className="modal__header"><h2>Import Payhip orders</h2><button className="modal__close" onClick={onClose} aria-label="Close">×</button></div>
            <div className="modal__body">
                <p style={muted}>In Payhip open <b>Customers → Export</b> and download the file. Choose it here (or paste its contents). Nothing is saved until you check it and confirm. Orders already on the site are never added twice, and refunded or unrelated products are skipped. Buyers are <b>not</b> e-mailed; they just sign in with the same e-mail and find their book.</p>
                <input type="file" accept=".csv,text/csv,text/plain" aria-label="Payhip export file" onChange={(e) => loadFile(e.target.files && e.target.files[0])} />
                <textarea className="form-textarea" aria-label="Payhip export contents" rows={5} style={{ marginTop: 8 }} value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); setResult(null); }} placeholder="…or paste the CSV here" />
                <div className="form-actions" style={{ marginTop: 8 }}><button className="btn btn--outline" disabled={busy || csv.trim().length < 10} onClick={check}>{busy && !preview ? 'Checking…' : 'Check the file (nothing is saved)'}</button></div>
                {preview && (<>
                    <p style={{ marginTop: 12 }}><b>{s.toImport}</b> can be imported · {s.skipped} skipped · {s.total} rows. <span style={muted}>Columns read: {Object.entries(preview.columns).map(([k, v]) => `${k}=${v || '—'}`).join(', ')}</span></p>
                    <p style={muted}>Untick any row that is only a test. Only ticked rows are imported. <button type="button" className="btn btn--outline btn--sm" onClick={() => setPicked(Object.fromEntries(preview.items.filter((i) => i.action === 'import').map((i) => [i.line, true])))}>Tick all</button> <button type="button" className="btn btn--outline btn--sm" onClick={() => setPicked({})}>Untick all</button></p>
                    <div className="table-wrapper" style={{ maxHeight: 320, overflow: 'auto' }}><table className="data-table"><thead><tr><th></th><th>Row</th><th>E-mail</th><th>Name</th><th>Product</th><th>Coupon</th><th>Date</th><th>Amount</th><th>Result</th></tr></thead><tbody>
                        {preview.items.map((i) => <tr key={i.line} style={i.action === 'skip' ? { opacity: 0.6 } : undefined}><td>{i.action === 'import' ? <input type="checkbox" aria-label={`Import row ${i.line}`} checked={!!picked[i.line]} onChange={(e) => setPicked({ ...picked, [i.line]: e.target.checked })} /> : null}</td><td>{i.line}</td><td>{i.email}</td><td>{i.name}</td><td>{i.product || '—'}</td><td>{i.coupon || '—'}</td><td>{i.date ? fmt(i.date) : 'no date'}</td><td>{i.amount.toFixed(2)} {i.currency}</td><td>{i.action === 'import' ? `Import as ${i.edition === 'online' ? 'Online Reading' : i.isUpgrade ? 'Companion (upgrade)' : 'Digital Companion'}` : `Skip: ${i.reason}`}</td></tr>)}
                    </tbody></table></div>
                    {s.toImport > 0 && (<>
                        <div className="form-group" style={{ marginTop: 12 }}><label>Reason (required, recorded in the audit log)</label><textarea className="form-textarea" aria-label="Import reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. webhook did not reach the site; importing the Payhip export" /></div>
                        <div className="form-actions"><button className="btn btn--primary" disabled={busy || reason.trim().length < 5 || chosen.length === 0} onClick={apply}>{busy ? 'Importing…' : `Import ${chosen.length} selected order${chosen.length === 1 ? '' : 's'}`}</button></div>
                    </>)}
                </>)}
                {result && <div style={{ ...card, marginTop: 12, borderColor: '#a6e3a1' }} data-testid="import-result"><b>Done.</b> Imported {result.summary.imported}, failed {result.summary.failed}, skipped {result.summary.skipped}.{result.results.filter((r) => !r.ok).map((r) => <div key={r.line} style={{ color: '#f38ba8' }}>Row {r.line}: {r.error}</div>)}</div>}
            </div>
        </div></div>
    );
}

export default function Entitlements() {
    const { can } = useAuth(); // what this person's role allows (the server checks again on every request)
    const [revokeFor, setRevokeFor] = useState(null); // the customer row whose "Revoke" button was pressed
    const [grantOpen, setGrantOpen] = useState(false); const [importOpen, setImportOpen] = useState(false);
    const [tab, setTab] = useState('customers');
    const [overview, setOverview] = useState(null);
    const [q, setQ] = useState(''); const [group, setGroup] = useState('all'); const [page, setPage] = useState(1);
    const [list, setList] = useState({ items: [], total: 0 });
    const [hooks, setHooks] = useState({ items: [], total: 0 }); const [outcome, setOutcome] = useState('');
    const [audit, setAudit] = useState([]);
    const [open, setOpen] = useState(null); const [launchAsk, setLaunchAsk] = useState(false);
    const [notInstalled, setNotInstalled] = useState(false);

    const loadOverview = useCallback(() => entitlements.overview().then((o) => { setOverview(o); setNotInstalled(false); }).catch((e) => { if (/not installed|migration/i.test(errText(e))) setNotInstalled(true); else toast.error(errText(e)); }), []);
    const loadList = useCallback(() => entitlements.list({ q, group, page, pageSize: 20 }).then(setList).catch((e) => toast.error(errText(e))), [q, group, page]);
    useEffect(() => { loadOverview(); }, [loadOverview]);
    useEffect(() => { if (tab === 'customers') { const t = setTimeout(loadList, 250); return () => clearTimeout(t); } return undefined; }, [tab, loadList]);
    useEffect(() => { if (tab === 'webhooks') entitlements.webhooks({ outcome, pageSize: 50 }).then(setHooks).catch((e) => toast.error(errText(e))); }, [tab, outcome]);
    useEffect(() => { if (tab === 'audit') entitlements.audit().then((r) => setAudit(r.items)).catch((e) => toast.error(errText(e))); }, [tab]);

    if (notInstalled) return <div className="page"><div className="empty-state"><h3>Customer entitlements are not installed yet</h3><p>The database migration has not been applied. Contact the developer.</p></div></div>;
    const c = overview && overview.counts; const lo = overview && overview.launchOffer;
    const tabBtn = (id, label) => <button type="button" className={`btn btn--sm ${tab === id ? 'btn--primary' : 'btn--outline'}`} onClick={() => setTab(id)} data-testid={`tab-${id}`}>{label}</button>;

    return (
        <div className="page" style={{ maxWidth: 1250, margin: '0 auto', padding: '24px 20px' }} data-testid="entitlements-page">
            <div className="page__header"><div><h1 className="page__title"><HiOutlineUserGroup style={{ verticalAlign: '-3px', color: '#d4af37' }} /> Readers &amp; Companion customers</h1>
                <p className="page__subtitle">Who has Online Reading, who has the Digital Companion, upgrades, Ask SID allowance and refunds. Every correction needs a written reason and is audited.</p></div></div>

            {c && (
                <div className="stats-grid" style={{ marginBottom: 18 }}>
                    <div className="stat-card"><div className="stat-card__title">Online Reading (active)</div><div className="stat-card__value" data-testid="count-online">{c.onlineActive}</div></div>
                    <div className="stat-card"><div className="stat-card__title">Digital Companion (active)</div><div className="stat-card__value" data-testid="count-companion">{c.companionActive}</div><div className="stat-card__subtitle">{c.upgradedActive} upgraded</div></div>
                    <div className="stat-card"><div className="stat-card__title">Refunded / revoked</div><div className="stat-card__value">{c.refunded} / {c.revoked}</div></div>
                    <div className="stat-card"><div className="stat-card__title">Launch offer (first 200)</div><div className="stat-card__value" data-testid="launch-used">{c.launchPositionsUsed}/{overview.limits.launchSize}</div>
                        <div className="stat-card__subtitle">{lo.open ? `Open since ${fmt(lo.startsAt)}` : 'Not open yet'} · {overview.limits.daily}/day · {overview.limits.launchTotal} questions (then {overview.limits.standardTotal})</div></div>
                </div>
            )}
            {lo && !lo.open && <div style={{ ...card, marginBottom: 14, borderColor: '#f9e2af' }}><b style={{ color: '#f9e2af' }}>The launch offer is closed.</b> <span style={muted}>Until you open it, no purchase can take one of the 200 launch positions (so old or test orders never do). Open it on launch day.</span> {can('customers.manage') && <button className="btn btn--primary btn--sm" style={{ marginLeft: 10 }} onClick={() => setLaunchAsk(true)} data-testid="open-launch">Open the launch offer now</button>}</div>}

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>{tabBtn('customers', 'Customers')}{can('audit') && tabBtn('webhooks', 'Webhook deliveries')}{can('audit') && tabBtn('audit', 'Audit log')}</div>

            {tab === 'customers' && (<>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                    <input className="form-input" aria-label="Search by e-mail" placeholder="Search by e-mail…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ maxWidth: 300 }} />
                    <select className="form-input" aria-label="Filter" value={group} onChange={(e) => { setGroup(e.target.value); setPage(1); }} style={{ maxWidth: 240 }}>
                        <option value="all">All customers</option><option value="online">Online Reading</option><option value="companion">Digital Companion</option><option value="upgraded">Upgraded</option><option value="refunded">Refunded</option><option value="revoked">Revoked</option>
                    </select>
                    <button className="btn btn--outline btn--sm" onClick={() => { loadList(); loadOverview(); }}><HiOutlineRefresh /> Refresh</button>
                    {can('customers.grant') && <button className="btn btn--primary btn--sm" onClick={() => setGrantOpen(true)} data-testid="open-grant">Grant complimentary access…</button>}
                    {can('customers.manage') && <button className="btn btn--outline btn--sm" onClick={() => setImportOpen(true)} data-testid="open-import">Import Payhip orders…</button>}
                </div>
                <div className="table-wrapper"><table className="data-table" data-testid="customers-table"><thead><tr><th>Customer</th><th>Edition</th><th>Status</th><th>Granted</th><th>Ask SID until</th><th>Launch #</th><th>Questions (today · total left)</th><th>Order</th><th></th></tr></thead><tbody>
                    {list.items.map((i) => (
                        <tr key={i.id} onClick={() => setOpen(i.id)} style={{ cursor: 'pointer' }} data-testid={`row-${i.email}`}>
                            <td>{i.email}</td><td><Pill map={EDITION} k={i.edition} />{i.isUpgrade ? ' ↑' : ''}</td><td><Pill map={STATUS} k={i.accessStatus} /></td><td>{fmt(i.grantedAt)}</td>
                            <td data-testid={`ends-${i.email}`}>{i.edition === 'companion' ? endLabel(i.askSidExpiresAt) : '—'}</td><td>{i.launchPosition || '—'}</td>
                            <td>{i.allowance ? `${i.allowance.daily_used}/${i.allowance.daily_limit} · ${i.allowance.total_remaining} left` : '—'}</td><td>{i.order ? `${i.order.order_number}${i.order.refund_status ? ` (${i.order.refund_status})` : ''}` : '—'}</td>
                            <td>{can('customers.grant') && i.accessStatus !== 'revoked' && <button type="button" className="btn btn--danger btn--sm" data-testid={`revoke-${i.email}`} onClick={(e) => { e.stopPropagation(); setRevokeFor(i); }}>Revoke</button>}</td>
                        </tr>))}
                    {list.items.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', ...muted }}>No customers match.</td></tr>}
                </tbody></table></div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}><button className="btn btn--outline btn--sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span style={muted}>Page {page} · {list.total} customers</span><button className="btn btn--outline btn--sm" disabled={page * 20 >= list.total} onClick={() => setPage(page + 1)}>Next</button></div>
            </>)}

            {tab === 'webhooks' && (<>
                <select className="form-input" aria-label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} style={{ maxWidth: 240, marginBottom: 12 }}><option value="">All outcomes</option>{['processed', 'duplicate', 'ignored', 'rejected', 'failed'].map((o) => <option key={o} value={o}>{o}</option>)}</select>
                <div className="table-wrapper"><table className="data-table" data-testid="webhooks-table"><thead><tr><th>Last seen</th><th>Provider</th><th>Event</th><th>Outcome</th><th>HTTP</th><th>Attempts</th></tr></thead><tbody>
                    {hooks.items.map((h) => <tr key={h.id} style={h.outcome === 'failed' || h.outcome === 'rejected' ? { color: '#f38ba8' } : undefined}><td>{new Date(h.last_seen_at).toISOString().replace('T', ' ').slice(0, 16)}</td><td>{h.provider}</td><td>{h.event_key}</td><td>{h.outcome}</td><td>{h.http_status || '—'}</td><td>{h.attempts}</td></tr>)}
                    {hooks.items.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', ...muted }}>Nothing recorded. No delivery from Payhip has reached the site yet.</td></tr>}
                </tbody></table></div>
                <p style={muted}>The Payhip address to use is <b>https://siddiqui.digital/api/payment/payhip/webhook</b>. Open it in a browser: it should say <code>"ok":true</code>.
                    A row called <b>signature_check</b> means Payhip is reaching the site but the API key saved on the server does not match the one in Payhip (Settings → Developer).
                    Any other rejected row means a purchase was not recognised (the product is not configured); Payhip retries for 3 hours. If a free (100% coupon) order never appears here, Payhip did not send it: use <b>Import Payhip orders</b> on the Customers tab.</p>
            </>)}

            {tab === 'audit' && (
                <div className="table-wrapper"><table className="data-table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead><tbody>
                    {audit.map((a) => <tr key={a.id}><td>{new Date(a.created_at).toISOString().replace('T', ' ').slice(0, 16)}</td><td>{a.actor_label}</td><td>{a.action}</td><td style={muted}>{a.detail && a.detail.reason ? a.detail.reason : JSON.stringify(a.detail).slice(0, 120)}</td></tr>)}
                </tbody></table></div>
            )}

            {grantOpen && <GrantModal onClose={() => setGrantOpen(false)} onDone={() => { loadList(); loadOverview(); }} />}
            {importOpen && <ImportModal onClose={() => setImportOpen(false)} onDone={() => { loadList(); loadOverview(); }} />}
            {open && <Detail id={open} onClose={() => setOpen(null)} onChanged={() => { loadList(); loadOverview(); }} />}
            {revokeFor && <ReasonModal title={`Revoke access for ${revokeFor.email}`} onCancel={() => setRevokeFor(null)} onSubmit={async ({ reason }) => { try { await entitlements.action(revokeFor.id, { action: 'revoke', reason }); toast.success('Access revoked'); setRevokeFor(null); loadList(); loadOverview(); } catch (e) { toast.error(errText(e)); } }} />}
            {launchAsk && <ReasonModal title="Open the launch offer" onCancel={() => setLaunchAsk(false)} onSubmit={async ({ reason }) => { try { await entitlements.openLaunch(reason); toast.success('Launch offer is open'); setLaunchAsk(false); loadOverview(); } catch (e) { toast.error(errText(e)); } }} />}
        </div>
    );
}
