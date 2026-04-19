'use client';
import { useState, useEffect, useRef } from 'react';
import { getMarkets, getProducts, getTodaySales, createSales, getTodayDispatches } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showToast } from '../Toast';

type Lang = 'en-IN' | 'bn-IN' | 'hi-IN';

export default function MarketSales() {
  const { user } = useAuth();
  const [markets, setMarkets] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedMarket, setSelectedMarket] = useState('');
  const [dispatchId, setDispatchId] = useState('');
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [lang, setLang] = useState<Lang>('en-IN');
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [entries, setEntries] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [selProduct, setSelProduct] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [todaySales, setTodaySales] = useState<any[]>([]);
  const recognitionRef = useRef<any>(null);

  useEffect(() => { loadMarkets(); loadProducts(); }, []);
  useEffect(() => { if (selectedMarket) { loadDispatches(); loadTodaySales(); } }, [selectedMarket]);

  async function loadMarkets() { const d = await getMarkets(); setMarkets(d); if (d.length === 1) setSelectedMarket(d[0].id); }
  async function loadProducts() { const d = await getProducts(); setProducts(d); }
  async function loadDispatches() { const d = await getTodayDispatches(user?.role === 'market_agent' ? user.id : undefined); setDispatches(d); if (d.length) setDispatchId(d[0].id); }
  async function loadTodaySales() { if (!selectedMarket) return; const d = await getTodaySales(selectedMarket); setTodaySales(d); }

  function startVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { showToast('Voice not supported', 'error'); return; }
    const rec = new SR(); rec.lang = lang; rec.continuous = false; rec.interimResults = true;
    rec.onresult = (e: any) => { const t = Array.from(e.results).map((r: any) => r[0].transcript).join(''); setTranscript(t); };
    rec.onend = () => { setRecording(false); };
    rec.onerror = () => { setRecording(false); showToast('Voice failed', 'error'); };
    recognitionRef.current = rec; rec.start(); setRecording(true); setTranscript('');
  }

  function stopVoice() { recognitionRef.current?.stop(); setRecording(false); if (transcript) parseVoice(transcript); }

  function parseVoice(text: string) {
    const lower = text.toLowerCase();
    const prod = products.find(p => lower.includes(p.name.toLowerCase()) || (p.name_bengali && lower.includes(p.name_bengali)) || (p.name_hindi && lower.includes(p.name_hindi)));
    const nums = text.match(/\d+(\.\d+)?/g)?.map(Number) || [];
    if (prod && nums.length >= 1) {
      const q = nums[0]; const p = nums[1] || prod.market_price;
      setEntries(prev => [...prev, { product_id: prod.id, product_name: prod.name, qty: q, unit: prod.unit, price_per_unit: p, total: q * p, method: 'voice', transcript: text }]);
      showToast(`Added: ${prod.name} × ${q}${prod.unit}`, 'success');
    } else { showToast('Could not parse — add manually', 'warn'); }
  }

  function addManual() {
    const prod = products.find(p => p.id === selProduct);
    if (!prod || !qty || !price) { showToast('Fill product, qty and price', 'error'); return; }
    setEntries(prev => [...prev, { product_id: prod.id, product_name: prod.name, qty: parseFloat(qty), unit: prod.unit, price_per_unit: parseFloat(price), total: parseFloat(qty) * parseFloat(price), method: 'manual' }]);
    setQty(''); setPrice('');
  }

  async function saveSales() {
    if (!entries.length || !selectedMarket) { showToast('Add entries and select market', 'error'); return; }
    setSaving(true);
    try {
      const sales = entries.map(e => ({ dispatch_id: dispatchId || null, agent_id: user!.id, market_id: selectedMarket, product_id: e.product_id, product_name: e.product_name, qty_sold: e.qty, unit: e.unit, price_per_unit: e.price_per_unit, total_amount: e.total, entry_method: e.method, voice_transcript: e.transcript || null }));
      await createSales(sales, dispatchId || undefined);
      showToast(`✓ Saved ${entries.length} sales`, 'success');
      setEntries([]); loadTodaySales();
    } catch (e: any) { showToast(e.message, 'error'); }
    setSaving(false);
  }

  const totalAmount = entries.reduce((s, e) => s + e.total, 0);
  const todayTotal = todaySales.reduce((s: number, e: any) => s + (e.total_amount || 0), 0);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>Market</div>
          <select className="inp" value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
            <option value="">Select market…</option>
            {markets.map(m => <option key={m.id} value={m.id}>{m.name} — {m.area}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>Dispatch</div>
          <select className="inp" value={dispatchId} onChange={e => setDispatchId(e.target.value)}>
            <option value="">No dispatch</option>
            {dispatches.map(d => <option key={d.id} value={d.id}>{d.agent_name} — {d.status}</option>)}
          </select>
        </div>
      </div>

      {todayTotal > 0 && <div style={{ background: 'var(--fresh-dim)', border: '1px solid var(--fresh-border)', borderRadius: 'var(--r2)', padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--fresh-500)' }}>Today's total</span><span style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 600, color: 'var(--fresh-500)' }}>₹{todayTotal.toLocaleString()}</span></div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>🎤 Voice Entry</div>
            <div style={{ padding: 18 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {[['en-IN','🇬🇧 English'],['bn-IN','বাংলা'],['hi-IN','हिंदी']].map(([v,l]) => (
                  <button key={v} onClick={() => setLang(v as Lang)} style={{ flex: 1, padding: '7px 8px', borderRadius: 8, border: `1px solid ${lang === v ? 'var(--fresh-500)' : 'var(--border)'}`, background: lang === v ? 'var(--fresh-dim)' : 'var(--bg2)', color: lang === v ? 'var(--fresh-500)' : 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 11, fontWeight: 600 }}>{l}</button>
                ))}
              </div>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <button onClick={recording ? stopVoice : startVoice} style={{ position: 'relative', width: 72, height: 72, borderRadius: '50%', background: recording ? 'var(--red)' : 'var(--fresh-500)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: recording ? 22 : 26 }}>
                  {recording ? '■' : '🎤'}
                </button>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>{recording ? '🔴 Recording… tap to stop' : 'Tap to speak'}</div>
              </div>
              {transcript && <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '10px 12px', fontSize: 13, marginBottom: 10, fontStyle: 'italic' }}>"{transcript}"</div>}
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6, background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '8px 12px' }}>
                Say: "Tomato 5 kilo 20 rupee"<br />বাংলা: "টমেটো পাঁচ কেজি বিশ টাকা"<br />हिंदी: "टमाटर पाँच किलो बीस रुपया"
              </div>
            </div>
          </div>
          <div className="card">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>✏️ Manual Entry</div>
            <div style={{ padding: 18 }}>
              <div style={{ marginBottom: 10 }}>
                <select className="inp" value={selProduct} onChange={e => { setSelProduct(e.target.value); const p = products.find(pr => pr.id === e.target.value); if (p) setPrice(String(p.market_price)); }}>
                  <option value="">Select product…</option>
                  {['vegetable','fruit','fish','non_veg','dairy','other'].map(cat => (
                    <optgroup key={cat} label={cat.replace('_',' ').toUpperCase()}>
                      {products.filter(p => p.category === cat).map(p => <option key={p.id} value={p.id}>{p.name} {p.name_bengali ? `(${p.name_bengali})` : ''} — ₹{p.market_price}/{p.unit}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div><div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>Qty</div><input className="inp" type="number" step="0.1" placeholder="e.g. 5.5" value={qty} onChange={e => setQty(e.target.value)} /></div>
                <div><div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>Price/unit (₹)</div><input className="inp" type="number" step="0.5" placeholder="e.g. 25" value={price} onChange={e => setPrice(e.target.value)} /></div>
              </div>
              {qty && price && <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--fresh-500)', fontFamily: 'var(--mono)', fontWeight: 600 }}>Total: ₹{(parseFloat(qty||'0') * parseFloat(price||'0')).toFixed(0)}</div>}
              <button className="btn btn-fresh" style={{ width: '100%', justifyContent: 'center' }} onClick={addManual}>+ Add to List</button>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Staged ({entries.length})</span>
              {totalAmount > 0 && <span style={{ fontFamily: 'var(--mono)', color: 'var(--fresh-500)', fontWeight: 700 }}>₹{totalAmount.toLocaleString()}</span>}
            </div>
            <div style={{ padding: 18 }}>
              {entries.length === 0 ? <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text3)' }}><div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>No entries yet</div> : (
                <>
                  {entries.map((e, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12 }}>{e.method === 'voice' ? '🎤' : '✏️'}</span>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{e.product_name}</div><div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{e.qty} {e.unit} × ₹{e.price_per_unit}</div></div>
                      <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--fresh-500)', fontSize: 14 }}>₹{e.total.toFixed(0)}</div>
                      <button onClick={() => setEntries(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 16 }}>×</button>
                    </div>
                  ))}
                  <button className="btn btn-fresh" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={saveSales} disabled={saving}>
                    {saving ? 'Saving…' : `✓ Save ${entries.length} Sales — ₹${totalAmount.toLocaleString()}`}
                  </button>
                </>
              )}
            </div>
          </div>

          {todaySales.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>Today's Submitted Sales</div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {todaySales.map((s: any) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 18px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                    <div><span style={{ fontWeight: 600 }}>{s.product_name}</span><span style={{ color: 'var(--text3)', marginLeft: 8 }}>{s.qty_sold} {s.unit} × ₹{s.price_per_unit}</span></div>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--fresh-500)', fontWeight: 700 }}>₹{s.total_amount}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '10px 18px', display: 'flex', justifyContent: 'space-between', background: 'var(--bg2)', fontSize: 13 }}>
                <span style={{ color: 'var(--text2)' }}>Today Total</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--fresh-500)', fontSize: 16 }}>₹{todayTotal.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
