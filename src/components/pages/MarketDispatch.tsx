'use client';
import { useState, useEffect } from 'react';
import { supabase, Product, Market, User } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { showToast } from '../Toast';

export default function MarketDispatch() {
  const { user } = useAuth();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedMarket, setSelectedMarket] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [dispatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<{ product_id: string; product_name: string; unit: string; dispatched_qty: number; price_per_unit: number }[]>([]);
  const [saving, setSaving] = useState(false);

  // Today's dispatches
  const [todayDispatches, setTodayDispatches] = useState<any[]>([]);
  const [activeDispatch, setActiveDispatch] = useState<any>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [m, a, p] = await Promise.all([
      supabase.from('markets').select('*').eq('is_active', true),
      supabase.from('users').select('*').in('role', ['market_agent', 'fresh_staff']).eq('is_active', true),
      supabase.from('products').select('*').eq('is_active', true).order('category'),
    ]);
    setMarkets(m.data || []);
    setAgents(a.data || []);
    setProducts(p.data || []);
    loadTodayDispatches();
  }

  async function loadTodayDispatches() {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('market_dispatches')
      .select('*, market:markets(name,area), agent:users!market_dispatches_agent_id_fkey(name,color), items:dispatch_items(*)')
      .eq('dispatch_date', today)
      .order('created_at', { ascending: false });
    setTodayDispatches(data || []);
  }

  function addProduct(productId: string) {
    const p = products.find(pr => pr.id === productId);
    if (!p || items.find(i => i.product_id === productId)) return;
    setItems(prev => [...prev, {
      product_id: p.id,
      product_name: p.name,
      unit: p.unit,
      dispatched_qty: 0,
      price_per_unit: p.price_per_unit,
    }]);
  }

  function updateItem(idx: number, field: string, val: any) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  async function saveDispatch() {
    if (!selectedMarket || !selectedAgent) { showToast('Select market and agent', 'error'); return; }
    if (!items.length || items.some(i => !i.dispatched_qty)) { showToast('Add products with quantities', 'error'); return; }
    setSaving(true);
    try {
      const totalValue = items.reduce((s, i) => s + (i.dispatched_qty * i.price_per_unit), 0);

      const { data: dispatch, error: dErr } = await supabase
        .from('market_dispatches')
        .insert({
          market_id: selectedMarket,
          agent_id: selectedAgent,
          dispatch_date: dispatchDate,
          dispatched_by: user!.id,
          status: 'dispatched',
          total_dispatch_value: totalValue,
        })
        .select()
        .single();

      if (dErr || !dispatch) throw dErr;

      const dispatchItems = items.map(i => ({
        dispatch_id: dispatch.id,
        product_id: i.product_id,
        product_name: i.product_name,
        unit: i.unit,
        dispatched_qty: i.dispatched_qty,
        price_per_unit: i.price_per_unit,
      }));

      const { error: iErr } = await supabase.from('dispatch_items').insert(dispatchItems);
      if (iErr) throw iErr;

      // Deduct from product stock
      for (const item of items) {
        await supabase.from('products')
          .update({ current_stock: products.find(p => p.id === item.product_id)!.current_stock - item.dispatched_qty })
          .eq('id', item.product_id);
      }

      showToast(`✓ Dispatch created — ₹${totalValue.toLocaleString()} worth of goods`, 'success');
      setItems([]);
      setSelectedAgent('');
      loadTodayDispatches();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
    setSaving(false);
  }

  async function settleDispatch(dispatchId: string) {
    const dispatch = todayDispatches.find(d => d.id === dispatchId);
    if (!dispatch) return;

    const discrepancy = dispatch.total_dispatch_value - dispatch.total_sold_value - (dispatch.total_returned_value || 0);
    const flagged = Math.abs(discrepancy) > 50; // flag if > ₹50 discrepancy

    await supabase.from('market_dispatches').update({
      status: 'settled',
      discrepancy,
      discrepancy_flagged: flagged,
    }).eq('id', dispatchId);

    if (flagged) {
      showToast(`⚠️ DISCREPANCY FLAGGED: ₹${discrepancy.toFixed(0)} missing!`, 'error');
    } else {
      showToast('✓ Dispatch settled — accounts match', 'success');
    }
    loadTodayDispatches();
  }

  const totalDispatchValue = items.reduce((s, i) => s + (i.dispatched_qty * i.price_per_unit), 0);

  return (
    <div>
      {/* Today's dispatches */}
      {todayDispatches.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Today's Dispatches — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {todayDispatches.map(d => {
              const discr = d.total_dispatch_value - d.total_sold_value - (d.total_returned_value || 0);
              const pct = d.total_dispatch_value ? Math.round((d.total_sold_value / d.total_dispatch_value) * 100) : 0;
              return (
                <div key={d.id} className="card" style={{ borderLeft: `3px solid ${d.discrepancy_flagged ? 'var(--red)' : d.status === 'settled' ? 'var(--green)' : 'var(--fresh-500)'}` }}>
                  <div style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: d.agent?.color || 'var(--fresh-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>
                            {d.agent?.name?.[0]}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{d.agent?.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>→ {d.market?.name}, {d.market?.area}</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color: 'var(--fresh-500)' }}>₹{d.total_sold_value?.toLocaleString() || 0}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>of ₹{d.total_dispatch_value?.toLocaleString()} dispatched</div>
                      </div>
                    </div>

                    <div className="pb" style={{ marginBottom: 8 }}>
                      <div className="pf" style={{ width: `${pct}%`, background: pct > 80 ? 'var(--green)' : pct > 50 ? 'var(--amber)' : 'var(--red)' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text3)' }}>
                        <span>{pct}% sold</span>
                        {d.status !== 'settled' && <span style={{ color: 'var(--amber)' }}>{d.status}</span>}
                        {d.status === 'settled' && !d.discrepancy_flagged && <span style={{ color: 'var(--green)' }}>✓ Settled</span>}
                        {d.discrepancy_flagged && <span style={{ color: 'var(--red)', fontWeight: 700 }}>⚠️ DISCREPANCY ₹{Math.abs(discr).toFixed(0)}</span>}
                      </div>
                      {d.status !== 'settled' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => settleDispatch(d.id)}>
                          Settle Evening Return
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New dispatch form */}
      <div className="card">
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
          📦 Create Morning Dispatch
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>Market</div>
              <select className="inp" value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                <option value="">Select market…</option>
                {markets.map(m => <option key={m.id} value={m.id}>{m.name} — {m.area}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>Assign Agent</div>
              <select className="inp" value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}>
                <option value="">Select agent…</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name} — {a.role.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>

          {/* Add products */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>Add Products</div>
            <select
              className="inp"
              onChange={e => { if (e.target.value) addProduct(e.target.value); e.target.value = ''; }}
              defaultValue=""
            >
              <option value="">+ Add product to dispatch…</option>
              {['vegetable','fruit','fish','non_veg','dairy','other'].map(cat => (
                <optgroup key={cat} label={cat.replace('_', ' ').toUpperCase()}>
                  {products.filter(p => p.category === cat && !items.find(i => i.product_id === p.id)).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.name_bengali ? `(${p.name_bengali})` : ''} — Stock: {p.current_stock} {p.unit}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Items table */}
          {items.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty to Dispatch</th>
                      <th>Unit</th>
                      <th>Price/Unit (₹)</th>
                      <th>Value</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                        <td>
                          <input
                            type="number" step="0.5" min="0"
                            value={item.dispatched_qty || ''}
                            onChange={e => updateItem(idx, 'dispatched_qty', parseFloat(e.target.value) || 0)}
                            style={{ width: 80, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontFamily: 'var(--font)' }}
                          />
                        </td>
                        <td style={{ color: 'var(--text3)' }}>{item.unit}</td>
                        <td>
                          <input
                            type="number" step="0.5"
                            value={item.price_per_unit || ''}
                            onChange={e => updateItem(idx, 'price_per_unit', parseFloat(e.target.value) || 0)}
                            style={{ width: 80, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontFamily: 'var(--font)' }}
                          />
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', color: 'var(--fresh-500)', fontWeight: 700 }}>
                          ₹{(item.dispatched_qty * item.price_per_unit).toFixed(0)}
                        </td>
                        <td>
                          <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 16 }}>×</button>
                        </td>
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

          <button
            className="btn btn-fresh"
            style={{ justifyContent: 'center' }}
            onClick={saveDispatch}
            disabled={saving || !items.length}
          >
            {saving ? 'Creating Dispatch…' : `📦 Dispatch to Market${totalDispatchValue ? ` — ₹${totalDispatchValue.toLocaleString()}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
