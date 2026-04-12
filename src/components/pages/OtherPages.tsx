'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { showToast } from '../Toast';

// ─── MARKET DASHBOARD ─────────────────────────────────────────
export function MarketDashboard() {
  const [today] = useState(new Date().toISOString().slice(0, 10));
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalDispatched: 0, totalSold: 0, totalCash: 0, flagged: 0 });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from('market_dispatches')
      .select('*, market:markets(name,area), agent:users!market_dispatches_agent_id_fkey(name,color), items:dispatch_items(*)')
      .eq('dispatch_date', today)
      .order('created_at', { ascending: false });
    setDispatches(data || []);
    const d = data || [];
    setSummary({
      totalDispatched: d.reduce((s: number, x: any) => s + (x.total_dispatch_value || 0), 0),
      totalSold: d.reduce((s: number, x: any) => s + (x.total_sold_value || 0), 0),
      totalCash: d.reduce((s: number, x: any) => s + (x.cash_collected || 0), 0),
      flagged: d.filter((x: any) => x.discrepancy_flagged).length,
    });
  }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>

      {summary.flagged > 0 && (
        <div className="alert-banner alert-danger" style={{ marginBottom: 16 }}>
          ⚠️ {summary.flagged} dispatch{summary.flagged > 1 ? 'es' : ''} have discrepancies today — check immediately!
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }} className="grid-4">
        {[
          { v: `₹${summary.totalDispatched.toLocaleString()}`, l: 'Dispatched', c: 'var(--cyan)' },
          { v: `₹${summary.totalSold.toLocaleString()}`, l: 'Sold', c: 'var(--fresh-500)' },
          { v: `₹${summary.totalCash.toLocaleString()}`, l: 'Cash Collected', c: 'var(--green)' },
          { v: summary.flagged, l: 'Discrepancies', c: summary.flagged > 0 ? 'var(--red)' : 'var(--text3)' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-val" style={{ color: s.c, fontSize: 22 }}>{s.v}</div>
            <div className="stat-lbl">{s.l}</div>
          </div>
        ))}
      </div>

      {dispatches.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">📦</div><div className="empty-state-title">No dispatches today</div><div>Create a morning dispatch to get started</div></div>
      ) : dispatches.map(d => {
        const pct = d.total_dispatch_value ? Math.round((d.total_sold_value || 0) / d.total_dispatch_value * 100) : 0;
        return (
          <div key={d.id} className="card" style={{ marginBottom: 12, borderLeft: `3px solid ${d.discrepancy_flagged ? 'var(--red)' : pct > 80 ? 'var(--green)' : 'var(--fresh-500)'}` }}>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: d.agent?.color || 'var(--fresh-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 14 }}>
                    {d.agent?.name?.[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{d.agent?.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{d.market?.name} — {d.market?.area}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Dispatched</div>
                    <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--cyan)' }}>₹{(d.total_dispatch_value || 0).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Sold</div>
                    <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--fresh-500)' }}>₹{(d.total_sold_value || 0).toLocaleString()}</div>
                  </div>
                  {d.discrepancy_flagged && (
                    <div className="discrepancy-flag">⚠️ ₹{Math.abs(d.discrepancy || 0).toFixed(0)} discrepancy</div>
                  )}
                </div>
              </div>
              <div className="pb">
                <div className="pf" style={{ width: `${pct}%`, background: pct > 80 ? 'var(--green)' : pct > 50 ? 'var(--amber)' : 'var(--red)' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{pct}% sold · Status: {d.status}</div>
              {d.items?.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {d.items.map((it: any) => (
                    <span key={it.id} style={{ fontSize: 10, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '2px 8px', color: 'var(--text2)' }}>
                      {it.product_name} {it.dispatched_qty}{it.unit} → sold {it.sold_qty || 0}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── OFFLINE CUSTOMERS ─────────────────────────────────────────
export function OfflineCustomers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [markets, setMarkets] = useState<any[]>([]);
  const [marketFilter, setMarketFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [count, setCount] = useState(0);
  const [showBlast, setShowBlast] = useState(false);
  const [blastMarket, setBlastMarket] = useState('');
  const [blastMsg, setBlastMsg] = useState('');
  const [generatingBlast, setGeneratingBlast] = useState(false);

  const blank = { name: '', phone: '', whatsapp: '', flat_no: '', floor_no: '', complex_name: '', street_address: '', area: '', landmark: '', pin_code: '', preferred_market_id: '', language_pref: 'bengali', notes: '' };
  const [form, setForm] = useState(blank);

  useEffect(() => { loadMarkets(); load(); }, [marketFilter, search]);

  async function loadMarkets() {
    const { data } = await supabase.from('markets').select('*').eq('is_active', true);
    setMarkets(data || []);
  }

  async function load() {
    let q = supabase.from('offline_customers').select('*, market:markets(name,area)', { count: 'exact' }).order('created_at', { ascending: false });
    if (marketFilter) q = q.eq('preferred_market_id', marketFilter);
    if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,complex_name.ilike.%${search}%`);
    const { data, count: c } = await q.limit(100);
    setCustomers(data || []);
    setCount(c || 0);
  }

  async function save() {
    if (!form.name) { showToast('Name required', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('offline_customers').insert({ ...form, created_by: user?.id });
    if (error) { showToast(error.message, 'error'); setSaving(false); return; }
    showToast('Customer added', 'success');
    setShowModal(false); setForm(blank); load(); setSaving(false);
  }

  async function generateBlast() {
    if (!blastMarket) { showToast('Select market', 'error'); return; }
    setGeneratingBlast(true);
    const market = markets.find(m => m.id === blastMarket);
    const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    const defaultMsg = `🌿 MuktiFresh\n\nনমস্কার! আগামীকাল ${tomorrow} ${market?.name}-এ আসছি।\n\nতাজা সব্জি, মাছ, ফল পাওয়া যাবে।\nঅর্ডার আগে দিলে রাখা যাবে 🙏\n\n—${market?.name} টিম`;
    setBlastMsg(defaultMsg);
    setGeneratingBlast(false);
  }

  function openBlastWA(customer: any) {
    if (!customer.phone && !customer.whatsapp) return;
    const phone = (customer.whatsapp || customer.phone).replace(/\D/g, '');
    const full = phone.startsWith('91') ? phone : `91${phone}`;
    window.open(`https://wa.me/${full}?text=${encodeURIComponent(blastMsg)}`, '_blank');
    supabase.from('whatsapp_drafts').insert({ offline_customer_id: customer.id, business: 'muktifresh', phone: full, message: blastMsg, message_type: 'market_blast', sent_by: user?.id, is_sent: true, sent_at: new Date().toISOString() });
  }

  const marketCustomers = blastMarket ? customers.filter(c => c.preferred_market_id === blastMarket) : [];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="inp" placeholder="Name, phone, complex…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        <select className="inp" style={{ width: 'auto' }} value={marketFilter} onChange={e => setMarketFilter(e.target.value)}>
          <option value="">All markets</option>
          {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button className="btn btn-fresh" onClick={() => setShowModal(true)}>+ Add Customer</button>
        <button className="btn btn-ghost" onClick={() => setShowBlast(true)}>📱 WhatsApp Blast</button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>{count} offline customers</div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Market</th><th>Language</th><th>Purchases</th><th>Last Visit</th><th>Actions</th></tr></thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state"><div className="empty-state-icon">🏪</div><div className="empty-state-title">No offline customers yet</div></div></td></tr>
              ) : customers.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>
                    {c.name}
                    {c.flat_no && <div style={{ fontSize: 10, color: 'var(--text3)' }}>Flat {c.flat_no}{c.complex_name ? ', ' + c.complex_name : ''}</div>}
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{c.phone || '—'}</td>
                  <td style={{ fontSize: 11, color: 'var(--text2)', maxWidth: 150 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[c.street_address, c.area, c.pin_code].filter(Boolean).join(', ') || '—'}
                    </div>
                  </td>
                  <td style={{ fontSize: 11 }}>{c.market?.name || '—'}</td>
                  <td><span style={{ fontSize: 10, background: 'var(--bg2)', borderRadius: 8, padding: '2px 7px', color: 'var(--text2)' }}>{c.language_pref}</span></td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{c.total_purchases || 0}</td>
                  <td style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {c.last_purchase_date ? new Date(c.last_purchase_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                  <td>
                    {(c.phone || c.whatsapp) && (
                      <button onClick={() => { const p = (c.whatsapp||c.phone).replace(/\D/g,''); window.open(`https://wa.me/${p.startsWith('91')?p:'91'+p}`, '_blank'); }}
                        className="wa-btn btn-xs">WA</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add customer modal */}
      {showModal && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
              <span style={{ fontSize: 17, fontWeight: 800 }}>🏪 Add Market Customer</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            {[
              [['Name *','name','text'],['Phone','phone','tel']],
              [['WhatsApp','whatsapp','tel'],['Flat No','flat_no','text']],
              [['Floor','floor_no','text'],['Complex / Building','complex_name','text']],
              [['Street / Road','street_address','text'],['Area','area','text']],
              [['Landmark','landmark','text'],['PIN Code','pin_code','text']],
            ].map((row, ri) => (
              <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                {row.map(([l, k, t]) => (
                  <div key={k as string}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>{l}</div>
                    <input className="inp" type={t as string} value={(form as any)[k as string]} onChange={e => setForm(f => ({ ...f, [k as string]: e.target.value }))} />
                  </div>
                ))}
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Market</div>
                <select className="inp" value={form.preferred_market_id} onChange={e => setForm(f => ({ ...f, preferred_market_id: e.target.value }))}>
                  <option value="">Select market…</option>
                  {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Language</div>
                <select className="inp" value={form.language_pref} onChange={e => setForm(f => ({ ...f, language_pref: e.target.value }))}>
                  <option value="bengali">বাংলা</option><option value="hindi">हिंदी</option><option value="english">English</option><option value="hinglish">Hinglish</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-fresh" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add Customer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp blast modal */}
      {showBlast && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowBlast(false)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
              <span style={{ fontSize: 17, fontWeight: 800 }}>📱 WhatsApp Market Blast</span>
              <button onClick={() => setShowBlast(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Select Market</div>
              <select className="inp" value={blastMarket} onChange={e => setBlastMarket(e.target.value)}>
                <option value="">Select market…</option>
                {markets.map(m => <option key={m.id} value={m.id}>{m.name} — {m.area}</option>)}
              </select>
            </div>
            <button className="btn btn-fresh" onClick={generateBlast} disabled={generatingBlast} style={{ marginBottom: 12 }}>
              {generatingBlast ? '✨ Generating…' : '✨ Generate Message'}
            </button>
            {blastMsg && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Message (edit as needed)</div>
                  <textarea className="inp" rows={6} value={blastMsg} onChange={e => setBlastMsg(e.target.value)} />
                </div>
                {marketCustomers.length > 0 ? (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{marketCustomers.length} customers at {markets.find(m => m.id === blastMarket)?.name}</div>
                    <div style={{ maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {marketCustomers.map(c => (
                        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg2)', borderRadius: 'var(--r)' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{c.phone}</div>
                          </div>
                          {(c.phone || c.whatsapp) && (
                            <button onClick={() => openBlastWA(c)} className="wa-btn btn-sm">📱 Send</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : blastMarket ? (
                  <div style={{ color: 'var(--text3)', fontSize: 13, padding: 16, textAlign: 'center' }}>No customers registered for this market yet</div>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TEAM PAGE ─────────────────────────────────────────────────
export function TeamPage() {
  const { user } = useAuth();
  const [team, setTeam] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'fresh_staff', business: 'muktifresh', department: '', color: '#22c55e' });

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase.from('users').select('*').eq('is_active', true).order('name');
    setTeam(data || []);
  }

  async function save() {
    if (!form.name || !form.email || !form.password) { showToast('Fill all required fields', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('users').insert(form);
    if (error) { showToast(error.message, 'error'); setSaving(false); return; }
    showToast('Team member added', 'success');
    setShowModal(false); load(); setSaving(false);
  }

  const roleColors: Record<string,string> = { super_admin: '#a855f7', fresh_admin: '#22c55e', kitchen_admin: '#f97316', fresh_staff: '#4ade80', kitchen_staff: '#fb923c', market_agent: '#06b6d4' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-fresh" onClick={() => setShowModal(true)}>+ Add Team Member</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {team.map(m => (
          <div key={m.id} className="card" style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: m.color || roleColors[m.role] || '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 auto 10px' }}>
              {m.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', margin: '3px 0 8px' }}>{m.email}</div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: `${roleColors[m.role]}20`, color: roleColors[m.role] }}>
              {m.role.replace(/_/g, ' ')}
            </span>
            {m.phone && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{m.phone}</div>}
          </div>
        ))}
      </div>
      {showModal && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-sm">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
              <span style={{ fontSize: 17, fontWeight: 800 }}>Add Team Member</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            {[['Full Name *','name','text'],['Email *','email','email'],['Password *','password','password'],['Phone','phone','tel'],['Department','department','text']].map(([l,k,t]) => (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>{l}</div>
                <input className="inp" type={t} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Role *</div>
                <select className="inp" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="fresh_staff">Fresh Staff</option><option value="kitchen_staff">Kitchen Staff</option>
                  <option value="market_agent">Market Agent</option><option value="fresh_admin">Fresh Admin</option>
                  <option value="kitchen_admin">Kitchen Admin</option><option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Colour</div>
                <input className="inp" type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ height: 40, cursor: 'pointer' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-fresh" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add Member'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── REPORTS ───────────────────────────────────────────────────
export function ReportsPage() {
  const [stats, setStats] = useState<any>({});
  const [period, setPeriod] = useState('month');

  useEffect(() => { load(); }, [period]);

  async function load() {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const [fl, fClosed, kl, kClosed, dispatches, sales, complaints] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact' }).eq('business', 'muktifresh').gte('created_at', from),
      supabase.from('leads').select('id', { count: 'exact' }).eq('business', 'muktifresh').eq('status', 'closed').gte('created_at', from),
      supabase.from('leads').select('id', { count: 'exact' }).eq('business', 'cloud_kitchen').gte('created_at', from),
      supabase.from('leads').select('id', { count: 'exact' }).eq('business', 'cloud_kitchen').eq('status', 'closed').gte('created_at', from),
      supabase.from('market_dispatches').select('total_dispatch_value,total_sold_value,discrepancy_flagged').gte('dispatch_date', from),
      supabase.from('market_sales').select('total_amount').gte('sale_date', from),
      supabase.from('complaints').select('status,business').gte('created_at', from),
    ]);
    const totalSales = (sales.data || []).reduce((s: number, r: any) => s + (r.total_amount || 0), 0);
    const totalDispatched = (dispatches.data || []).reduce((s: number, r: any) => s + (r.total_dispatch_value || 0), 0);
    const totalSold = (dispatches.data || []).reduce((s: number, r: any) => s + (r.total_sold_value || 0), 0);
    const flags = (dispatches.data || []).filter((r: any) => r.discrepancy_flagged).length;
    setStats({ freshLeads: fl.count, freshClosed: fClosed.count, kitchenLeads: kl.count, kitchenClosed: kClosed.count, totalSales, totalDispatched, totalSold, flags, complaints: complaints.data || [] });
  }

  const freshConv = stats.freshLeads ? Math.round((stats.freshClosed / stats.freshLeads) * 100) : 0;
  const kitchenConv = stats.kitchenLeads ? Math.round((stats.kitchenClosed / stats.kitchenLeads) * 100) : 0;
  const soldPct = stats.totalDispatched ? Math.round((stats.totalSold / stats.totalDispatched) * 100) : 0;
  const openComplaints = (stats.complaints || []).filter((c: any) => c.status === 'open').length;
  const resolvedComplaints = (stats.complaints || []).filter((c: any) => c.status === 'resolved').length;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['week','7 Days'],['month','30 Days'],['year','1 Year']].map(([v,l]) => (
          <button key={v} onClick={() => setPeriod(v)} style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${period === v ? 'var(--fresh-500)' : 'var(--border)'}`, background: period === v ? 'var(--fresh-dim)' : 'var(--bg2)', color: period === v ? 'var(--fresh-500)' : 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 600 }}>{l}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, marginBottom: 20 }} className="grid-2">
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fresh-500)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>🌿 MuktiFresh Leads</div>
          {[['Total Leads', stats.freshLeads || 0, 'var(--text)'], ['Closed / Converted', stats.freshClosed || 0, 'var(--green)'], ['Conversion Rate', `${freshConv}%`, 'var(--fresh-500)']].map(([l,v,c]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{l}</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: c as string }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--kitchen-500)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>🍳 Cloud Kitchen Leads</div>
          {[['Total Leads', stats.kitchenLeads || 0, 'var(--text)'], ['Closed / Converted', stats.kitchenClosed || 0, 'var(--green)'], ['Conversion Rate', `${kitchenConv}%`, 'var(--kitchen-500)']].map(([l,v,c]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{l}</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: c as string }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>🏪 Market Sales</div>
          {[['Total Sales ₹', `₹${(stats.totalSales || 0).toLocaleString()}`, 'var(--fresh-500)'], ['Dispatched Value ₹', `₹${(stats.totalDispatched || 0).toLocaleString()}`, 'var(--cyan)'], ['Sold %', `${soldPct}%`, soldPct > 80 ? 'var(--green)' : 'var(--amber)'], ['Discrepancies Flagged', stats.flags || 0, stats.flags > 0 ? 'var(--red)' : 'var(--green)']].map(([l,v,c]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{l}</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: c as string }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>🔴 Complaints</div>
          {[['Total', (stats.complaints || []).length, 'var(--text)'], ['Open', openComplaints, 'var(--red)'], ['Resolved', resolvedComplaints, 'var(--green)'], ['Resolution Rate', `${(stats.complaints||[]).length ? Math.round(resolvedComplaints / (stats.complaints||[]).length * 100) : 0}%`, 'var(--fresh-500)']].map(([l,v,c]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{l}</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: c as string }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MarketDashboard;
