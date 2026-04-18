'use client';
import { useState, useEffect } from 'react';
import { getTodayDispatches, settleDispatch, getUsers, createUser, getOfflineCustomers, createOfflineCustomer, getMarkets, getReports } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showToast } from '../Toast';

export function MarketDashboard() {
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalDispatched: 0, totalSold: 0, totalCash: 0, flagged: 0 });

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await getTodayDispatches();
    setDispatches(data);
    setSummary({
      totalDispatched: data.reduce((s: number, x: any) => s + (x.total_dispatch_value || 0), 0),
      totalSold: data.reduce((s: number, x: any) => s + (x.total_sold_value || 0), 0),
      totalCash: data.reduce((s: number, x: any) => s + (x.cash_collected || 0), 0),
      flagged: data.filter((x: any) => x.discrepancy_flagged).length,
    });
  }

  async function settle(id: string, dispatch: any) {
    const discr = (dispatch.total_dispatch_value || 0) - (dispatch.total_sold_value || 0);
    const flagged = Math.abs(discr) > 50;
    await settleDispatch(id, discr, flagged);
    if (flagged) showToast(`⚠️ DISCREPANCY: ₹${Math.abs(discr).toFixed(0)} missing!`, 'error');
    else showToast('✓ Dispatch settled', 'success');
    load();
  }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>
      {summary.flagged > 0 && <div className="alert-banner alert-danger" style={{ marginBottom: 16 }}>⚠️ {summary.flagged} dispatch discrepancies today!</div>}
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
        <div className="empty-state"><div className="empty-state-icon">📦</div><div className="empty-state-title">No dispatches today</div></div>
      ) : dispatches.map((d: any) => {
        const pct = d.total_dispatch_value ? Math.round((d.total_sold_value || 0) / d.total_dispatch_value * 100) : 0;
        return (
          <div key={d.id} className="card" style={{ marginBottom: 12, borderLeft: `3px solid ${d.discrepancy_flagged ? 'var(--red)' : pct > 80 ? 'var(--green)' : 'var(--fresh-500)'}` }}>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: d.agent_color || 'var(--fresh-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 14 }}>
                    {d.agent_name?.[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{d.agent_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{d.market_name} — {d.market_area}</div>
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
                  {d.discrepancy_flagged && <div className="discrepancy-flag">⚠️ ₹{Math.abs(d.discrepancy || 0).toFixed(0)} missing</div>}
                </div>
              </div>
              <div className="pb"><div className="pf" style={{ width: `${pct}%`, background: pct > 80 ? 'var(--green)' : pct > 50 ? 'var(--amber)' : 'var(--red)' }} /></div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{pct}% sold · {d.status}</span>
                {d.status !== 'settled' && <button className="btn btn-ghost btn-sm" onClick={() => settle(d.id, d)}>Settle Evening Return</button>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
  const blank = { name: '', phone: '', whatsapp: '', flat_no: '', floor_no: '', complex_name: '', street_address: '', area: '', landmark: '', pin_code: '', preferred_market_id: '', language_pref: 'bengali', notes: '' };
  const [form, setForm] = useState(blank);

  useEffect(() => { loadMarkets(); load(); }, [marketFilter, search]);

  async function loadMarkets() {
    const data = await getMarkets();
    setMarkets(data);
  }

  async function load() {
    const result = await getOfflineCustomers({ market_id: marketFilter || undefined, search: search || undefined });
    setCustomers(result.data || []);
    setCount(result.count || 0);
  }

  async function save() {
    if (!form.name) { showToast('Name required', 'error'); return; }
    setSaving(true);
    try {
      await createOfflineCustomer({ ...form, created_by: user?.id });
      showToast('Customer added', 'success');
      setShowModal(false); setForm(blank); load();
    } catch (e: any) { showToast(e.message, 'error'); }
    setSaving(false);
  }

  function openBlastWA(customer: any) {
    if (!customer.phone && !customer.whatsapp) return;
    const phone = (customer.whatsapp || customer.phone).replace(/\D/g, '');
    const full = phone.startsWith('91') ? phone : `91${phone}`;
    window.open(`https://wa.me/${full}?text=${encodeURIComponent(blastMsg)}`, '_blank');
  }

  const marketCustomers = blastMarket ? customers.filter((c: any) => c.preferred_market_id === blastMarket) : [];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="inp" placeholder="Name, phone, complex…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        <select className="inp" style={{ width: 'auto' }} value={marketFilter} onChange={e => setMarketFilter(e.target.value)}>
          <option value="">All markets</option>
          {markets.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button className="btn btn-fresh" onClick={() => setShowModal(true)}>+ Add Customer</button>
        <button className="btn btn-ghost" onClick={() => setShowBlast(true)}>📱 WhatsApp Blast</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>{count} offline customers</div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Market</th><th>Language</th><th>Actions</th></tr></thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-icon">🏪</div><div className="empty-state-title">No offline customers yet</div></div></td></tr>
              ) : customers.map((c: any) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}{c.flat_no && <div style={{ fontSize: 10, color: 'var(--text3)' }}>Flat {c.flat_no}{c.complex_name ? ', ' + c.complex_name : ''}</div>}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{c.phone || '—'}</td>
                  <td style={{ fontSize: 11, color: 'var(--text2)' }}>{[c.street_address, c.area, c.pin_code].filter(Boolean).join(', ') || '—'}</td>
                  <td style={{ fontSize: 11 }}>{c.market_name || '—'}</td>
                  <td><span style={{ fontSize: 10, background: 'var(--bg2)', borderRadius: 8, padding: '2px 7px', color: 'var(--text2)' }}>{c.language_pref}</span></td>
                  <td>{(c.phone || c.whatsapp) && <button onClick={() => { const p = (c.whatsapp||c.phone).replace(/\D/g,''); window.open(`https://wa.me/${p.startsWith('91')?p:'91'+p}`, '_blank'); }} className="wa-btn btn-xs">WA</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
              <span style={{ fontSize: 17, fontWeight: 800 }}>🏪 Add Market Customer</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            {[['Name *','name'],['Phone','phone'],['WhatsApp','whatsapp'],['Flat No','flat_no'],['Complex / Building','complex_name'],['Street / Road','street_address'],['Area','area'],['PIN Code','pin_code'],['Landmark','landmark']].map(([l, k]) => (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>{l}</div>
                <input className="inp" value={(form as any)[k]} onChange={e => setForm((f: any) => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Market</div>
                <select className="inp" value={form.preferred_market_id} onChange={e => setForm((f: any) => ({ ...f, preferred_market_id: e.target.value }))}>
                  <option value="">Select market…</option>
                  {markets.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Language</div>
                <select className="inp" value={form.language_pref} onChange={e => setForm((f: any) => ({ ...f, language_pref: e.target.value }))}>
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

      {showBlast && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowBlast(false)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
              <span style={{ fontSize: 17, fontWeight: 800 }}>📱 WhatsApp Market Blast</span>
              <button onClick={() => setShowBlast(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <select className="inp" value={blastMarket} onChange={e => setBlastMarket(e.target.value)}>
                <option value="">Select market…</option>
                {markets.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <button className="btn btn-fresh" style={{ marginBottom: 12 }} onClick={() => {
              const market = markets.find((m: any) => m.id === blastMarket);
              const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
              setBlastMsg(`🌿 MuktiFresh\n\nনমস্কার! আগামীকাল ${tomorrow} ${market?.name}-এ আসছি।\n\nতাজা সব্জি, মাছ, ফল পাওয়া যাবে।\nঅর্ডার আগে দিলে রাখা যাবে 🙏`);
            }}>✨ Generate Message</button>
            {blastMsg && <>
              <textarea className="inp" rows={5} value={blastMsg} onChange={e => setBlastMsg(e.target.value)} style={{ marginBottom: 12 }} />
              {marketCustomers.length > 0 && (
                <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                  {marketCustomers.map((c: any) => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div><div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.phone}</div></div>
                      {(c.phone || c.whatsapp) && <button onClick={() => openBlastWA(c)} className="wa-btn btn-sm">📱 Send</button>}
                    </div>
                  ))}
                </div>
              )}
            </>}
          </div>
        </div>
      )}
    </div>
  );
}

export function TeamPage() {
  const { user } = useAuth();
  const [team, setTeam] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'fresh_staff', business: 'muktifresh', department: '', color: '#22c55e' });

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await getUsers();
    setTeam(data);
  }

  async function save() {
    if (!form.name || !form.email || !form.password) { showToast('Fill all required fields', 'error'); return; }
    setSaving(true);
    try {
      await createUser(form);
      showToast('Team member added ✓', 'success');
      setShowModal(false);
      setForm({ name: '', email: '', password: '', phone: '', role: 'fresh_staff', business: 'muktifresh', department: '', color: '#22c55e' });
      load();
    } catch (e: any) { showToast(e.message, 'error'); }
    setSaving(false);
  }

  const roleColors: Record<string, string> = { super_admin: '#a855f7', fresh_admin: '#22c55e', kitchen_admin: '#f97316', fresh_staff: '#4ade80', kitchen_staff: '#fb923c', market_agent: '#06b6d4' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-fresh" onClick={() => setShowModal(true)}>+ Add Team Member</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {team.map((m: any) => (
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
                <input className="inp" type={t} value={(form as any)[k]} onChange={e => setForm((f: any) => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Role *</div>
                <select className="inp" value={form.role} onChange={e => setForm((f: any) => ({ ...f, role: e.target.value }))}>
                  <option value="fresh_staff">Fresh Staff</option>
                  <option value="kitchen_staff">Kitchen Staff</option>
                  <option value="market_agent">Market Agent</option>
                  <option value="fresh_admin">Fresh Admin</option>
                  <option value="kitchen_admin">Kitchen Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Colour</div>
                <input className="inp" type="color" value={form.color} onChange={e => setForm((f: any) => ({ ...f, color: e.target.value }))} style={{ height: 40, cursor: 'pointer' }} />
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

export function ReportsPage() {
  const [stats, setStats] = useState<any>({});
  const [period, setPeriod] = useState('month');

  useEffect(() => { load(); }, [period]);

  async function load() {
    const data = await getReports(period);
    setStats(data);
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }} className="grid-2">
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fresh-500)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>🌿 MuktiFresh Leads</div>
          {[['Total Leads', stats.freshLeads || 0, 'var(--text)'],['Closed', stats.freshClosed || 0, 'var(--green)'],['Conversion', `${freshConv}%`, 'var(--fresh-500)']].map(([l,v,c]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{l}</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: c as string }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--kitchen-500)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>🍳 Cloud Kitchen</div>
          {[['Total Leads', stats.kitchenLeads || 0, 'var(--text)'],['Closed', stats.kitchenClosed || 0, 'var(--green)'],['Conversion', `${kitchenConv}%`, 'var(--kitchen-500)']].map(([l,v,c]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{l}</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: c as string }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>🏪 Market Sales</div>
          {[['Total Sales', `₹${(stats.totalSales||0).toLocaleString()}`, 'var(--fresh-500)'],['Dispatched', `₹${(stats.totalDispatched||0).toLocaleString()}`, 'var(--cyan)'],['Sold %', `${soldPct}%`, soldPct > 80 ? 'var(--green)' : 'var(--amber)'],['Discrepancies', stats.flags || 0, stats.flags > 0 ? 'var(--red)' : 'var(--green)']].map(([l,v,c]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{l}</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: c as string }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>🔴 Complaints</div>
          {[['Total', (stats.complaints||[]).length, 'var(--text)'],['Open', openComplaints, 'var(--red)'],['Resolved', resolvedComplaints, 'var(--green)']].map(([l,v,c]) => (
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
