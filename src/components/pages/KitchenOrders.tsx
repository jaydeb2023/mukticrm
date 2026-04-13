// KitchenOrders.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/neonbase';
import { useAuth } from '@/lib/auth';
import { showToast } from '../Toast';

const STATUSES = ['new','confirmed','preparing','ready','out_for_delivery','delivered','cancelled'];
const STATUS_COLORS: Record<string,string> = {
  new: 'var(--blue)', confirmed: 'var(--cyan)', preparing: 'var(--amber)',
  ready: 'var(--green)', out_for_delivery: 'var(--purple)', delivered: 'var(--text3)', cancelled: 'var(--red)',
};

export function KitchenOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ customer_name: '', phone: '', address: '', items: '', total_amount: '', payment_mode: 'cash', special_instructions: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
    // Realtime subscription
    const ch = supabase.channel('kitchen-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchen_orders' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function load() {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from('kitchen_orders')
      .select('*')
      .gte('created_at', today)
      .not('order_status', 'in', '("cancelled")')
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('kitchen_orders').update({ order_status: status, updated_at: new Date().toISOString() }).eq('id', id);
    showToast('Order updated', 'success');
  }

  async function saveOrder() {
    if (!form.customer_name || !form.total_amount) { showToast('Fill name and amount', 'error'); return; }
    setSaving(true);
    const orderNo = 'MK' + Date.now().toString().slice(-6);
    const { error } = await supabase.from('kitchen_orders').insert({
      order_no: orderNo,
      customer_name: form.customer_name,
      phone: form.phone,
      address: form.address,
      items: form.items ? [{ name: form.items }] : [],
      total_amount: parseFloat(form.total_amount),
      payment_mode: form.payment_mode,
      special_instructions: form.special_instructions,
      created_by: user?.id,
    });
    if (error) { showToast(error.message, 'error'); setSaving(false); return; }
    showToast('Order created', 'success');
    setShowAdd(false);
    setForm({ customer_name: '', phone: '', address: '', items: '', total_amount: '', payment_mode: 'cash', special_instructions: '' });
    setSaving(false);
  }

  // Group by status
  const byStatus: Record<string, any[]> = {};
  STATUSES.slice(0, 5).forEach(s => { byStatus[s] = orders.filter(o => o.order_status === s); });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>🔴 Live — {orders.length} active orders today</div>
        <button className="btn btn-kitchen" onClick={() => setShowAdd(true)}>+ New Order</button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="spin" style={{ margin: '0 auto' }} /></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, overflowX: 'auto' }}>
          {STATUSES.slice(0, 5).map(status => (
            <div key={status}>
              <div style={{ fontSize: 11, fontWeight: 800, color: STATUS_COLORS[status], textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{status.replace(/_/g, ' ')}</span>
                <span style={{ background: `${STATUS_COLORS[status]}20`, borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{byStatus[status]?.length || 0}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 100 }}>
                {(byStatus[status] || []).map(o => (
                  <div key={o.id} className="card" style={{ padding: 12, borderLeft: `3px solid ${STATUS_COLORS[status]}` }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{o.customer_name}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--kitchen-500)', fontWeight: 700 }}>₹{o.total_amount}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>#{o.order_no} · {o.payment_mode}</div>
                    {o.special_instructions && <div style={{ fontSize: 10, color: 'var(--amber)', marginBottom: 6 }}>⚠️ {o.special_instructions}</div>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {STATUSES.filter(s => s !== status && s !== 'cancelled').map(ns => (
                        <button key={ns} onClick={() => updateStatus(o.id, ns)}
                          style={{ padding: '3px 6px', fontSize: 9, background: `${STATUS_COLORS[ns]}20`, color: STATUS_COLORS[ns], border: `1px solid ${STATUS_COLORS[ns]}40`, borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 700 }}>
                          → {ns.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal modal-sm">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
              <span style={{ fontSize: 17, fontWeight: 800 }}>🍳 New Order</span>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            {[['Customer Name *','customer_name','text'],['Phone','phone','tel'],['Address','address','text'],['Items (describe)','items','text'],['Total Amount ₹','total_amount','number']].map(([l, k, t]) => (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>{l}</div>
                <input className="inp" type={t} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Payment</div>
              <select className="inp" value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))}>
                <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="online">Online</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Special Instructions</div>
              <input className="inp" value={form.special_instructions} onChange={e => setForm(f => ({ ...f, special_instructions: e.target.value }))} placeholder="e.g. No spicy, extra sauce" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-kitchen" onClick={saveOrder} disabled={saving}>{saving ? 'Saving…' : 'Create Order'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KitchenOrders;
