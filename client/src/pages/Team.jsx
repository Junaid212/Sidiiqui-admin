import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineUsers } from 'react-icons/hi';
import { team } from '../services/featureService';

const muted = { color: '#a6adc8', fontSize: '0.85rem' };
const card = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 };
const errText = (e) => (e && e.message) || 'Something went wrong';
const when = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : 'never');
const ROLE_COLOR = { admin: '#d4af37', editor: '#89b4fa', support: '#a6e3a1' };
const ROLE_NOTE = {
    editor: 'Online Reading (chapters, import, publish), Blog, Ask SID settings and Companion Files. No orders, customers, coupons or payment settings.',
    support: 'View orders and customers, grant or revoke reader access, and read contact messages. Cannot edit content or settings.',
};

function RolePill({ role, label }) {
    const c = ROLE_COLOR[role] || '#ccc';
    return <span style={{ fontSize: '0.72rem', fontWeight: 700, color: c, border: `1px solid ${c}55`, borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap' }}>{label}</span>;
}

function AddModal({ onClose, onDone }) {
    const [email, setEmail] = useState(''); const [role, setRole] = useState('editor'); const [busy, setBusy] = useState(false);
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && !busy;
    async function go() {
        setBusy(true);
        try {
            const r = await team.add(email.trim(), role);
            if (r.emailSent) toast.success(`Added. ${r.email} was e-mailed a link to choose their own password.`);
            else toast.success(`Added, but the e-mail could not be sent (${r.emailError || 'unknown reason'}). Use "Send sign-in e-mail again".`, { duration: 8000 });
            onDone(); onClose();
        } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
    }
    return (
        <div className="modal-overlay" role="dialog" aria-modal="true"><div className="modal" style={{ maxWidth: 520 }} data-testid="add-admin-modal">
            <div className="modal__header"><h2>Add a person</h2><button className="modal__close" onClick={onClose} aria-label="Close">×</button></div>
            <div className="modal__body">
                <p style={muted}>Each person has their <b>own login</b>. They receive an e-mail with a link to choose their own password: nobody sends or shares a password.</p>
                <div className="form-group"><label>Their e-mail address</label><input className="form-input" aria-label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></div>
                <div className="form-group"><label>Role</label>
                    <select className="form-input" aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}><option value="editor">Editor</option><option value="support">Support</option></select>
                    <p style={{ ...muted, marginTop: 6 }}>{ROLE_NOTE[role]}</p>
                </div>
                <div className="form-actions"><button className="btn btn--outline" onClick={onClose}>Cancel</button><button className="btn btn--primary" disabled={!ok} onClick={go} data-testid="add-admin-go">{busy ? 'Adding…' : 'Add and send e-mail'}</button></div>
            </div>
        </div></div>
    );
}

export default function Team() {
    const [members, setMembers] = useState(null);
    const [addOpen, setAddOpen] = useState(false);
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(() => team.list().then((r) => setMembers(r.members)).catch((e) => { toast.error(errText(e)); setMembers([]); }), []);
    useEffect(() => { load(); }, [load]);

    async function run(m, fn, done) { setBusyId(m.id); try { await fn(); toast.success(done); await load(); } catch (e) { toast.error(errText(e)); } finally { setBusyId(null); } }
    const changeRole = (m, role) => run(m, () => team.setRole(m.id, role), `${m.email} is now ${role === 'editor' ? 'an Editor' : 'Support'}.`);
    const remove = (m) => { if (!window.confirm(`Remove ${m.email} from the dashboard?\n\nThey lose access immediately. Their account on the website is not deleted.`)) return; run(m, () => team.remove(m.id), `${m.email} no longer has dashboard access.`); };
    const resend = (m) => run(m, () => team.resend(m.id), `E-mail sent to ${m.email}.`);

    return (
        <div className="page" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }} data-testid="team-page">
            <div className="page__header" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                    <h1 className="page__title"><HiOutlineUsers style={{ verticalAlign: '-3px', color: '#d4af37' }} /> Team &amp; access</h1>
                    <p className="page__subtitle">Who can sign in to this dashboard, and what each person may do. Every change is recorded in the audit log.</p>
                </div>
                <button className="btn btn--primary" onClick={() => setAddOpen(true)} data-testid="add-admin">Add a person…</button>
            </div>

            <div style={{ ...card, margin: '4px 0 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px,1fr))', gap: 14 }}>
                <div><RolePill role="admin" label="Owner" /><p style={{ ...muted, marginTop: 6 }}>Everything: payments, coupons, customers, settings, and adding or removing people.</p></div>
                <div><RolePill role="editor" label="Editor" /><p style={{ ...muted, marginTop: 6 }}>{ROLE_NOTE.editor}</p></div>
                <div><RolePill role="support" label="Support" /><p style={{ ...muted, marginTop: 6 }}>{ROLE_NOTE.support}</p></div>
            </div>

            <div className="table-wrapper"><table className="data-table" data-testid="team-table"><thead><tr><th>Person</th><th>Role</th><th>Last sign-in</th><th>Status</th><th style={{ width: 1 }}></th></tr></thead><tbody>
                {(members || []).map((m) => (
                    <tr key={m.id} data-testid={`member-${m.email}`}>
                        <td>{m.email}{m.isSelf && <span style={{ ...muted, marginLeft: 8 }}>(you)</span>}</td>
                        <td>{m.role === 'admin'
                            ? <RolePill role="admin" label="Owner" />
                            : <select className="form-input" aria-label={`Role of ${m.email}`} value={m.role} disabled={busyId === m.id} onChange={(e) => changeRole(m, e.target.value)} style={{ width: 150, minWidth: 150, paddingRight: 28 }}><option value="editor">Editor</option><option value="support">Support</option></select>}</td>
                        <td style={muted}>{when(m.lastSignInAt)}</td>
                        <td style={muted}>{m.confirmed ? (m.lastSignInAt ? 'Active' : 'Invited, has not signed in yet') : 'Not confirmed'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                            {m.role !== 'admin' && !m.lastSignInAt && <button className="btn btn--outline btn--sm" style={{ marginRight: 6 }} disabled={busyId === m.id} onClick={() => resend(m)}>Send sign-in e-mail again</button>}
                            {!m.isSelf && <button className="btn btn--danger btn--sm" disabled={busyId === m.id} onClick={() => remove(m)} data-testid={`remove-${m.email}`}>Remove</button>}
                        </td>
                    </tr>))}
                {members && members.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', ...muted }}>No one to show.</td></tr>}
                {!members && <tr><td colSpan={5} style={{ textAlign: 'center', ...muted }}>Loading…</td></tr>}
            </tbody></table></div>
            <p style={{ ...muted, marginTop: 12 }}>Removing someone ends their dashboard access on their very next click. You cannot remove yourself, and the last Owner can never be removed.</p>

            {addOpen && <AddModal onClose={() => setAddOpen(false)} onDone={load} />}
        </div>
    );
}
