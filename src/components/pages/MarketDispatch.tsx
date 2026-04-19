'use client';
import { useState, useEffect } from 'react';
import { getMarkets, getProducts, getTodayDispatches, createDispatch, settleDispatch, getUsers } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showToast } from '../Toast';

export default function MarketDispatch() {
  const { user } = useAuth();
  const [markets, setMarkets] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedMarket, setSelectedMarket] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [todayDispatches, setTodayDispatches] = useState<any[]>([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [m, a, p] = await Promise.all([getMarkets(), getUsers(), getProducts()]);
    setMarkets(m); setAgents(a.filter((u: any) => ['market_agent','fresh_staff'].includes(u.role))); setProducts(p);
    loadTodayDispatches();
  }

  async function loadTodayDispatches() {
    const data = await getTodayDispatches();
    setTodayDispatches(data);
  }

  function addProduct(productId: string) {
    const p = products.find(pr => pr.id === productId);
    if (!p || items.find(i => i.product_id === productId)) return;
    setItems(prev => [...prev, { product_id: p.id, product_name: p.name, unit: p.unit, dispatched_qty: 0, price_per_unit: p.price_per_unit }]);
  }

  function updateItem(idx: number, field: string, val: any) { setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item)); }

  async function saveDispatch() {
    if (!selectedMarket || !selectedAgent) { showToast('Select market and agent', 'error'); return; }
    if (!items.length || items.some(i => !i.dispatched_qty)) { showToast('Add products with quantities', 'error'); return; }
    setSaving(true);
    try {
      const totalValue = items.reduce((s, i) => s + (i.dispatched_qty * i.price_per_unit), 0);
      await createDispatch({ market_id: selectedMarket, agent_id: selectedAgent, dispatch_date: new Date().toISOString().slice(0, 10), dispatched_by: user!.id, total_dispatch_value: totalValue, items });
      showToast(`✓ Dispatch created — ₹${totalValue.toLocaleString()}`, 'success');
      setItems([]); setSelectedAgent(''); loadTodayDispatches();
    } catch (e: any) { showToast(e.message, 'error'); }
    setSaving(false);
  }

  async function handleSettle(id: string, d: any) {
    const discr = (d.total_dispatch_value || 0) - (d.total_sold_value || 0);
    const flagged = Math.abs(discr) > 50;
    await settleDispatch(id, discr, flagged);
    if (flagged) showToast(`⚠️ DISCREPANCY: ₹${Math.abs(discr).toFixed(0)} missing!`, 'error');
    else showToast('✓ Settled', 'success');
    loadTodayDispatches();
  }

  const totalDispatchValue = items.reduce((s, i) => s + (i.dispatched_qty * i.price_per_unit), 0);

  return (
    <div>
      {todayDispatches.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Today's Dispatches</div>
          {todayDispatches.map((d: any) => {
            const pct = d.total_dispatch_value ? Math.round((d.total_sold_value || 0) / d.total_dispatch_value * 100) : 0;
            return (
              <div key={d.id} className="card" style={{ marginBottom: 12, borderLeft: `3px solid ${d.discrepancy_flagged ? 'var(--red)' : d.status === 'settled' ? 'var(--green)' : 'var(--fresh-500)'}` }}>
                <div style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: d.agent_color || 'var(--fresh-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>{d.agent_name?.[0]}</div>
                      <div><div style={{ fontSize: 14, fontWeight: 700 }}>{d.agent_name}</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>→ {d.market_name}</div></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color: 'var(--fresh-500)' }}>₹{(d.total_sold_value || 0).toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>of ₹{(d.total_dispatch_value || 0).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="pb" style={{ marginBottom: 8 }}><div className="pf" style={{ width: `${pct}%`, background: pct > 80 ? 'var(--green)' : pct > 50 ? 'var(--amber)' : 'var(--red)' }} /></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {pct}% sold · {d.status}
                      {d.discrepancy_flagged && <span style={{ color: 'var(--red)', fontWeight: 700, marginLeft: 8 }}>⚠️ ₹{Math.abs(d.discrepancy || 0).toFixed(0)} discrepancy</span>}
                    </div>
                    {d.status !== 'settled' && <button className="btn btn-ghost btn-sm" onClick={() => handleSettle(d.id, d)}>Settle Evening Return</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>📦 Create Morning Dispatch</div>
        <div style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 5 }}>Market</div>
              <select className="inp" value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                <option value="">Select market…</option>
                {markets.map(m => <option key={m.id} value={m.id}>{m.name} — {m.area}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 5 }}>Agent</div>
              <select className="inp" value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}>
                <option value="">Select agent…</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <select className="inp" onChange={e => { if (e.target.value) { addProduct(e.target.value); e.target.value = ''; } }} defaultValue="">
              <option value="">+ Add product…</option>
              {['vegetable','fruit','fish','non_veg','dairy','other'].map(cat => (
                <optgroup key={cat} label={cat.replace('_',' ').toUpperCase()}>
                  {products.filter(p => p.category === cat && !items.find(i => i.product_id === p.id)).map(p => <option key={p.id} value={p.id}>{p.name} — Stock: {p.current_stock} {p.unit}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          {items.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Product</th><th>Qty</th><th>Unit</th><th>Price/Unit</th><th>Value</th><th></th></tr></thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                        <td><input type="number" step="0.5" min="0" value={item.dispatched_qty || ''} onChange={e => updateItem(idx, 'dispatched_qty', parseFloat(e.target.value) || 0)} style={{ width: 80, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontFamily: 'var(--font)' }} /></td>
                        <td style={{ color: 'var(--text3)' }}>{item.unit}</td>
                        <td><input type="number" step="0.5" value={item.price_per_unit || ''} onChange={e => updateItem(idx, 'price_per_unit', parseFloat(e.target.value) || 0)} style={{ width: 80, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontFamily: 'var(--font)' }} /></td>
                        <td style={{ fontFamily: 'var(--mono)', color: 'var(--fresh-500)', fontWeight: 700 }}>₹{(item.dispatched_qty * item.price_per_unit).toFixed(0)}</td>
                        <td><button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 16 }}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg2)', borderRadius: 'var(--r)' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>Total dispatch value</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: 'var(--fresh-500)' }}>₹{totalDispatchValue.toLocaleString()}</span>
              </div>
            </div>
          )}
          <button className="btn btn-fresh" onClick={saveDispatch} disabled={saving || !items.length}>
            {saving ? 'Creating…' : `📦 Dispatch to Market${totalDispatchValue ? ` — ₹${totalDispatchValue.toLocaleString()}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
