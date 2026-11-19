import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiRequest } from '../config/api';

const DEFAULT_CTA = {
    enabled: false,
    offerPrice: 29.99,
    originalPrice: 49.99,
    couponCode: 'LAUNCH30',
    badgeText: 'LAUNCH OFFER',
    note: 'Online reading and Ask SID: coming soon, free for Companion buyers.',
    caption: 'Book PDF, Companion Pack, online reading and 12 months of Ask SID.',
    endsAt: '',
    autoApply: false,
    checkoutUrl: '',
};

const DEFAULT_ONLINE_CTA = {
    enabled: false,
    offerPrice: 15,
    originalPrice: 20,
    couponCode: '',
    badgeText: 'LAUNCH OFFER',
    note: '',
    caption: 'Read the complete book online.',
    endsAt: '',
    autoApply: false,
    checkoutUrl: '',
};

const DEFAULTS = {
    enabled: true,
    text: '',
    backgroundColor: '#A3192F',
    textColor: '#FFFFFF',
    endsAt: '',
    cta: DEFAULT_CTA,
    onlineCta: DEFAULT_ONLINE_CTA,
};

// **bold** markup -> bold text (same rule as the website banner)
function renderBold(text) {
    return String(text || '').split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : part
    );
}

function fromServer(data) {
    return {
        ...DEFAULTS, ...data,
        endsAt: data?.endsAt || '',
        cta: { ...DEFAULT_CTA, ...(data?.cta || {}), endsAt: data?.cta?.endsAt || '' },
        onlineCta: { ...DEFAULT_ONLINE_CTA, ...(data?.onlineCta || {}), endsAt: data?.onlineCta?.endsAt || '' },
    };
}

// What is sent to the server: numbers as numbers, an empty end date as "no date of its own"
const edition = (c) => ({ ...c, offerPrice: Number(c.offerPrice), originalPrice: Number(c.originalPrice), endsAt: c.endsAt || '' });
const toBody = (f, patch = {}) => ({ ...f, endsAt: f.endsAt || null, ...patch, cta: edition(patch.cta || f.cta), onlineCta: edition(patch.onlineCta || f.onlineCta) });

// '' when the edition's offer is fine to save, otherwise the message to show
function checkEdition(name, c) {
    if (!c.enabled) return '';
    const op = Number(c.offerPrice), orig = Number(c.originalPrice);
    if (!(op > 0) || !(orig > 0)) return `${name}: enter the offer price and the original price.`;
    if (op >= orig) return `${name}: the offer price must be lower than the original price.`;
    if (!String(c.couponCode || '').trim() && !String(c.checkoutUrl || '').trim()) return `${name}: add the coupon code that gives the offer price.`;
    return '';
}

const box = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12, padding: 18, marginBottom: 20,
};
const input = {
    width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box',
    background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.15)', color: 'inherit',
};
const label = { display: 'block', margin: '14px 0 6px', fontSize: 13, opacity: 0.8 };
const hint = { fontSize: 12, opacity: 0.6, margin: '4px 0 0' };
const h3 = { margin: '22px 0 0', fontSize: 15, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' };

/**
 * One edition's offer: on/off, offer price, original price, coupon code, badge text, end date, and the small line under its button.
 * `idp` makes the field ids unique (the page shows two of these). `extras` = the Companion-only settings.
 */
function EditionOffer({ idp, title, buttonName, cta, setCta, loading, extras, bannerEnds }) {
    const offerNum = Number(cta.offerPrice), origNum = Number(cta.originalPrice);
    return (
        <div data-testid={`${idp}-offer`}>
            <h3 style={h3}>{title}</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', marginTop: 10 }}>
                <input type="checkbox" checked={!!cta.enabled} disabled={loading}
                    onChange={(e) => setCta({ enabled: e.target.checked })} data-testid={`${idp}-enabled`} />
                Apply the offer on this edition
            </label>
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginTop: 10 }}>
                <strong>Before you switch this on:</strong> the checkout price is set by <b>Payhip</b>, not by this page. The button sends
                the buyer to Payhip with the coupon code below, so that coupon must exist in Payhip, be limited to <b>this edition</b>, and really give the offer price.
                Test a purchase first, then switch this on.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, opacity: cta.enabled ? 1 : 0.55 }}>
                <div>
                    <label style={label} htmlFor={`${idp}-offer-price`}>Offer price (USD)</label>
                    <input id={`${idp}-offer-price`} type="number" step="0.01" min="0" style={input} disabled={loading}
                        value={cta.offerPrice} onChange={(e) => setCta({ offerPrice: e.target.value })} />
                </div>
                <div>
                    <label style={label} htmlFor={`${idp}-original-price`}>Original price, shown crossed out (USD)</label>
                    <input id={`${idp}-original-price`} type="number" step="0.01" min="0" style={input} disabled={loading}
                        value={cta.originalPrice} onChange={(e) => setCta({ originalPrice: e.target.value })} />
                </div>
                <div>
                    <label style={label} htmlFor={`${idp}-coupon`}>Coupon code (created in Payhip)</label>
                    <input id={`${idp}-coupon`} type="text" maxLength={40} style={{ ...input, textTransform: 'uppercase' }} disabled={loading}
                        value={cta.couponCode} onChange={(e) => setCta({ couponCode: e.target.value.toUpperCase() })} />
                </div>
                <div>
                    <label style={label} htmlFor={`${idp}-badge`}>Badge text</label>
                    <input id={`${idp}-badge`} type="text" maxLength={30} style={input} disabled={loading}
                        value={cta.badgeText} onChange={(e) => setCta({ badgeText: e.target.value })} />
                </div>
                <div>
                    <label style={label} htmlFor={`${idp}-ends`}>Offer ends (this edition)</label>
                    <input id={`${idp}-ends`} type="date" style={input} disabled={loading}
                        value={cta.endsAt} onChange={(e) => setCta({ endsAt: e.target.value })} data-testid={`${idp}-ends`} />
                </div>
            </div>
            <p style={hint}>
                After the end of this day (Gulf time, UTC+4) this edition's offer switches itself off.
                {bannerEnds ? ` Left empty, it ends with the banner (${bannerEnds}).` : ' Left empty, it ends only when you switch it off by hand.'}
            </p>

            <label style={label} htmlFor={`${idp}-caption`}>Small text under the button (shown with or without an offer)</label>
            <input id={`${idp}-caption`} type="text" maxLength={200} style={input} disabled={loading}
                value={cta.caption} onChange={(e) => setCta({ caption: e.target.value })} data-testid={`${idp}-caption`} />

            {extras && (
                <>
                    <label style={label} htmlFor={`${idp}-note`}>Line under the buttons (shown only while Online Reading is "Coming soon")</label>
                    <input id={`${idp}-note`} type="text" maxLength={200} style={input} disabled={loading}
                        value={cta.note} onChange={(e) => setCta({ note: e.target.value })} />

                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 16 }}>
                        <input type="checkbox" checked={!!cta.autoApply} disabled={loading} style={{ marginTop: 3 }}
                            onChange={(e) => setCta({ autoApply: e.target.checked })} data-testid={`${idp}-autoapply`} />
                        <span><b>Payhip applies the code by itself</b> (leave this UNTICKED unless Payhip really fills the code in without typing - at the moment it does not: Payhip shows an empty &ldquo;Coupon code&rdquo; box).
                            While unticked, your checkout page tells the buyer to paste the code into Payhip&rsquo;s &ldquo;Coupon code&rdquo; box and press Apply, and offers a Copy button.</span>
                    </label>

                    <label style={label} htmlFor={`${idp}-url`}>Payhip checkout link for the offer (optional)</label>
                    <input id={`${idp}-url`} type="url" style={input} disabled={loading} placeholder="https://payhip.com/b/2H0Wr?coupon=LAUNCH30"
                        value={cta.checkoutUrl} onChange={(e) => setCta({ checkoutUrl: e.target.value.trim() })} />
                    <p style={hint}>
                        Leave empty to use the normal Digital Companion link with the coupon code added. Only fill this if you have a Payhip
                        link that applies the offer by itself. Must start with https://payhip.com/b/
                    </p>
                </>
            )}

            <div style={{ fontSize: 12, opacity: 0.6, margin: '16px 0 6px' }}>Button preview</div>
            <div style={{ background: '#14284b', borderRadius: 8, padding: 16 }} data-testid={`${idp}-preview`}>
                <div style={{ opacity: cta.enabled ? 1 : 0.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ background: '#A3192F', color: '#fff', padding: '12px 20px', borderRadius: 6, fontWeight: 700 }}>
                            {buttonName} · {cta.enabled ? `$${Number.isFinite(offerNum) ? offerNum.toFixed(2) : '—'}` : `$${Number.isFinite(origNum) ? origNum.toFixed(2) : '—'}`}
                        </span>
                        {cta.enabled && <span style={{ color: '#cbd5e1', textDecoration: 'line-through' }}>${Number.isFinite(origNum) ? origNum.toFixed(2) : '—'}</span>}
                        {cta.enabled && cta.badgeText && (
                            <span style={{ background: '#f2c94c', color: '#1f2937', padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 800, lineHeight: 1.2, textAlign: 'center' }}>
                                {cta.badgeText}{cta.couponCode ? <><br /><span style={{ fontWeight: 700 }}>code {cta.couponCode}</span></> : null}
                            </span>
                        )}
                    </div>
                </div>
                {cta.caption && <p style={{ color: '#e2e8f0', fontSize: 13, margin: '10px 0 0' }}>{cta.caption}</p>}
                {!cta.enabled && <p style={{ color: '#fbbf24', fontSize: 12, margin: '8px 0 0' }}>Offer is switched off: the button shows the normal price.</p>}
            </div>
        </div>
    );
}

/**
 * "Launch offer" - controls (1) the slim banner above the hero of the Marketing Reclassified landing page and
 * (2) the offer on each edition's button: Online Reading and Digital Companion each have their own on/off, prices, coupon code,
 * badge, end date and small text line.
 * The website picks changes up within about a minute.
 */
export default function OfferBannerCard() {
    const [form, setForm] = useState(DEFAULTS);
    const [saved, setSaved] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await apiRequest('/offer-banner');
                if (!alive) return;
                const next = fromServer(data);
                setForm(next);
                setSaved(next);
            } catch (err) {
                if (alive) toast.error('Could not load the offer settings');
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    const strip = (f) => JSON.stringify({ ...f, updatedAt: undefined });
    const dirty = saved && strip(form) !== strip(saved);
    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const setCta = (patch) => setForm((f) => ({ ...f, cta: { ...f.cta, ...patch } }));
    const setOnlineCta = (patch) => setForm((f) => ({ ...f, onlineCta: { ...f.onlineCta, ...patch } }));

    async function save() {
        if (form.enabled && !form.text.trim()) { toast.error('Enter the offer text, or switch the banner off.'); return; }
        const problem = checkEdition('Online Reading offer', form.onlineCta) || checkEdition('Digital Companion offer', form.cta);
        if (problem) { toast.error(problem); return; }
        setSaving(true);
        try {
            const data = await apiRequest('/offer-banner', { method: 'PUT', body: JSON.stringify(toBody(form)) });
            const next = fromServer(data);
            setForm(next);
            setSaved(next);
            toast.success('Saved - the website updates within a minute');
        } catch (err) {
            toast.error(err.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    }

    // One click: banner AND both edition offers off (e.g. when the offer ends). Everything else is kept for next time.
    async function switchOffNow() {
        if (!window.confirm('Switch off the launch offer now? The banner and the offers on BOTH edition buttons will disappear from the website within a minute. Your wording and prices are kept.')) return;
        setSaving(true);
        try {
            const body = toBody(form, { enabled: false, cta: { ...form.cta, enabled: false }, onlineCta: { ...form.onlineCta, enabled: false } });
            const data = await apiRequest('/offer-banner', { method: 'PUT', body: JSON.stringify(body) });
            const next = fromServer(data);
            setForm(next);
            setSaved(next);
            toast.success('Offer switched off');
        } catch (err) {
            toast.error(err.message || 'Failed to switch off');
        } finally {
            setSaving(false);
        }
    }

    const bannerEnds = form.endsAt || '';

    return (
        <div style={box} data-testid="offer-banner-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 16 }}>Launch offer (landing page banner + edition buttons)</h2>
                    <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.7 }}>
                        Controls the maroon banner and the two edition buttons (Online Reading, Digital Companion) on the Marketing Reclassified page. Each edition has its own offer.
                    </p>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!form.enabled} disabled={loading}
                        onChange={(e) => set({ enabled: e.target.checked })} />
                    Show banner
                </label>
            </div>

            <label style={label} htmlFor="offer-text">Offer label text</label>
            <textarea id="offer-text" rows={2} maxLength={300} style={input} disabled={loading}
                value={form.text} onChange={(e) => set({ text: e.target.value })}
                placeholder="Launch offer: $29.99 (save $20) for the first 100 buyers, until 30 November. Use code **LAUNCH30** at checkout." />
            <p style={hint}>Put **two asterisks** around words to make them bold, e.g. Use code **LAUNCH30**. {form.text.length}/300</p>

            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', margin: '12px 0 14px' }}>
                <label style={{ fontSize: 13 }}>Background{' '}
                    <input type="color" value={form.backgroundColor} onChange={(e) => set({ backgroundColor: e.target.value.toUpperCase() })} />
                </label>
                <label style={{ fontSize: 13 }}>Text{' '}
                    <input type="color" value={form.textColor} onChange={(e) => set({ textColor: e.target.value.toUpperCase() })} />
                </label>
                <button type="button" className="btn" style={{ fontSize: 12 }}
                    onClick={() => set({ backgroundColor: '#A3192F', textColor: '#FFFFFF' })}>Reset to maroon</button>
            </div>

            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Banner preview</div>
            <div style={{
                background: form.backgroundColor, color: form.textColor, textAlign: 'center',
                padding: '10px 14px', fontSize: 15, borderRadius: 6, opacity: form.enabled ? 1 : 0.35,
            }}>
                {form.text ? renderBold(form.text) : 'Your offer label appears here'}
                {!form.enabled && ' (banner is switched off)'}
            </div>

            <label style={label} htmlFor="offer-ends">Banner ends (optional)</label>
            <input id="offer-ends" type="date" style={{ ...input, width: 220, maxWidth: '100%' }} disabled={loading}
                value={form.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
            <p style={hint}>After the end of this day (Gulf time, UTC+4) the banner switches itself off, and so does any edition offer that has no end date of its own. Leave empty to end it by hand (use "Switch off the offer now").</p>

            {/* ---------- One offer per edition ---------- */}
            <EditionOffer idp="online" title="Online Reading Edition offer" buttonName="Online Reading Edition"
                cta={form.onlineCta} setCta={setOnlineCta} loading={loading} bannerEnds={bannerEnds} />

            <EditionOffer idp="cta" title="Digital Companion Edition offer" buttonName="Get Digital Companion"
                cta={form.cta} setCta={setCta} loading={loading} bannerEnds={bannerEnds} extras />

            <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn--primary" onClick={save} disabled={saving || loading || !dirty}
                    style={{ padding: '9px 18px', borderRadius: 8, fontWeight: 600 }}>
                    {saving ? 'Saving…' : 'Save launch offer'}
                </button>
                <button type="button" className="btn" onClick={switchOffNow} disabled={saving || loading}
                    style={{ padding: '9px 16px', borderRadius: 8 }} data-testid="switch-off-offer">
                    Switch off the offer now
                </button>
                {saved && saved.updatedAt && (
                    <span style={{ fontSize: 12, opacity: 0.6 }}>Last saved {new Date(saved.updatedAt).toLocaleString()}</span>
                )}
            </div>
        </div>
    );
}
