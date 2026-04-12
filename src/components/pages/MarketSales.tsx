'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase, Product, Market } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { showToast } from '../Toast';

type Lang = 'en-IN' | 'bn-IN' | 'hi-IN';

const LANG_OPTIONS: { value: Lang; label: string; flag: string }[] = [
  { value: 'en-IN', label: 'English', flag: '🇬🇧' },
  { value: 'bn-IN', label: 'বাংলা', flag: '🟦' },
  { value: 'hi-IN', label: 'हिंदी', flag: '🇮🇳' },
];

interface SaleEntry {
  product_id: string;
  product_name: string;
  qty: number;
  unit: string;
  price_per_unit: number;
  total: number;
  method: 'manual' | 'voice';
  transcript?: string;
}

export default function MarketSales() {
  const { user } = useAuth();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedMarket, setSelectedMarket] = useState('');
  const [dispatchId, setDispatchId] = useState('');
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [lang, setLang] = useState<Lang>('en-IN');
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [entries, setEntries] = useState<SaleEntry[]>([]);
  const [saving, setSaving] = useState(false);

  // Manual entry form
  const [selProduct, setSelProduct] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');

  // Today's submitted sales
  const [todaySales, setTodaySales] = useState<any[]>([]);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    loadMarkets();
    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedMarket) loadTodayDispatches();
  }, [selectedMarket]);

  async function loadMarkets() {
    const { data } = await supabase.from('markets').select('*').eq('is_active', true);
    setMarkets(data || []);
    if (data?.length === 1) setSelectedMarket(data[0].id);
  }

  async function loadProducts() {
    const { data } = await supabase.from('products').select('*').eq('is_active', true).order('category');
    setProducts(data || []);
  }

  async function loadTodayDispatches() {
    const today = new Date().toISOString().slice(0, 10);
    const q = supabase.from('market_dispatches')
      .select('*, market:markets(name), agent:users!market_dispatches_agent_id_fkey(name)')
      .eq('market_id', selectedMarket)
      .eq('dispatch_date', today)
      .in('status', ['dispatched', 'in_progress']);

    if (user?.role === 'market_agent') {
      const res = await q.eq('agent_id', user.id);
      setDispatches(res.data || []);
      if (res.data?.length) setDispatchId(res.data[0].id);
    } else {
      const res = await q;
      setDispatches(res.data || []);
      if (res.data?.length) setDispatchId(res.data[0].id);
    }
    loadTodaySales();
  }

  async function loadTodaySales() {
    if (!selectedMarket) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('market_sales')
      .select('*, product:products(name,category)')
      .eq('market_id', selectedMarket)
      .eq('sale_date', today)
      .order('created_at', { ascending: false });
    setTodaySales(data || []);
  }

  // ─── Voice Input ────────────────────────────────────────
  function startVoice() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { showToast('Voice not supported in this browser', 'error'); return; }

    const rec = new SpeechRecognition();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join('');
      setTranscript(t);
    };

    rec.onend = () => {
      setRecording(false);
      if (transcript) parseVoiceInput(transcript);
    };

    rec.onerror = () => { setRecording(false); showToast('Voice recognition failed', 'error'); };

    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
    setTranscript('');
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setRecording(false);
  }

  // ─── Parse voice transcript ──────────────────────────────
  // e.g. "tomato 5 kilo 20 taka" or "আলু দশ কেজি পনেরো টাকা"
  async function parseVoiceInput(text: string) {
    // Simple keyword matching for common products
    const lower = text.toLowerCase();
    const productMatch = products.find(p =>
      lower.includes(p.name.toLowerCase()) ||
      (p.name_bengali && lower.includes(p.name_bengali)) ||
      (p.name_hindi && lower.includes(p.name_hindi))
    );

    const numbers = text.match(/\d+(\.\d+)?/g)?.map(Number) || [];

    if (productMatch && numbers.length >= 1) {
      const q = numbers[0];
      const p = numbers[1] || productMatch.market_price;
      addEntry({
        product_id: productMatch.id,
        product_name: productMatch.name,
        qty: q,
        unit: productMatch.unit,
        price_per_unit: p,
        total: q * p,
        method: 'voice',
        transcript: text,
      });
      showToast(`✓ Added: ${productMatch.name} × ${q}${productMatch.unit}`, 'success');
    } else {
      // Show transcript for manual review
      showToast('Could not parse — please add manually', 'warn');
    }
  }

  function addEntry(entry: SaleEntry) {
    setEntries(prev => [...prev, entry]);
  }

  function addManual() {
    const prod = products.find(p => p.id === selProduct);
    if (!prod || !qty || !price) { showToast('Fill product, qty and price', 'error'); return; }
    addEntry({
      product_id: prod.id,
      product_name: prod.name,
      qty: parseFloat(qty),
      unit: prod.unit,
      price_per_unit: parseFloat(price),
      total: parseFloat(qty) * parseFloat(price),
      method: 'manual',
    });
    setQty(''); setPrice('');
  }

  function removeEntry(i: number) {
    setEntries(prev => prev.filter((_, idx) => idx !== i));
  }

  async function saveSales() {
    if (!entries.length) { showToast('No entries to save', 'error'); return; }
    if (!selectedMarket) { showToast('Select a market', 'error'); return; }
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const rows = entries.map(e => ({
        dispatch_id: dispatchId || null,
        agent_id: user!.id,
        market_id: selectedMarket,
        product_id: e.product_id,
        product_name: e.product_name,
        qty_sold: e.qty,
        unit: e.unit,
        price_per_unit: e.price_per_unit,
        total_amount: e.total,
        sale_date: today,
        entry_method: e.method,
        voice_transcript: e.transcript || null,
      }));

      const { error } = await supabase.from('market_sales').insert(rows);
      if (error) throw error;

      // Update dispatch totals
      if (dispatchId) {
        const totalSold = entries.reduce((s, e) => s + e.total, 0);
        await supabase.from('market_dispatches')
          .update({ status: 'in_progress', total_sold_value: totalSold })
          .eq('id', dispatchId);
      }

      showToast(`✓ Saved ${entries.length} sales entries`, 'success');
      setEntries([]);
      loadTodaySales();
    } catch (e: any) {
      showToast('Save failed: ' + e.message, 'error');
    }
    setSaving(false);
  }

  const totalAmount = entries.reduce((s, e) => s + e.total, 0);
  const todayTotal = todaySales.reduce((s: number, e: any) => s + (e.total_amount || 0), 0);

  return (
    <div>
      {/* Header controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>Market</div>
          <select className="inp" value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
            <option value="">Select market…</option>
            {markets.map(m => <option key={m.id} value={m.id}>{m.name} — {m.area}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>Dispatch / Agent</div>
          <select className="inp" value={dispatchId} onChange={e => setDispatchId(e.target.value)}>
            <option value="">No dispatch selected</option>
            {dispatches.map(d => <option key={d.id} value={d.id}>{d.agent?.name} — {d.status}</option>)}
          </select>
        </div>
      </div>

      {/* Today total banner */}
      {todayTotal > 0 && (
        <div style={{ background: 'var(--fresh-dim)', border: '1px solid var(--fresh-border)', borderRadius: 'var(--r2)', padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--fresh-500)' }}>Today's total sales at this market</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 600, color: 'var(--fresh-500)' }}>₹{todayTotal.toLocaleString()}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* ── LEFT: ADD ENTRY ── */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
              🎤 Voice Entry
            </div>
            <div style={{ padding: 18 }}>
              {/* Language picker */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {LANG_OPTIONS.map(l => (
                  <button
                    key={l.value}
                    onClick={() => setLang(l.value)}
                    style={{
                      flex: 1, padding: '7px 8px', borderRadius: 8,
                      border: `1px solid ${lang === l.value ? 'var(--fresh-500)' : 'var(--border)'}`,
                      background: lang === l.value ? 'var(--fresh-dim)' : 'var(--bg2)',
                      color: lang === l.value ? 'var(--fresh-500)' : 'var(--text2)',
                      cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {l.flag} {l.label}
                  </button>
                ))}
              </div>

              {/* Voice button */}
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <button
                  onClick={recording ? stopVoice : startVoice}
                  style={{
                    position: 'relative',
                    width: 72, height: 72, borderRadius: '50%',
                    background: recording ? 'var(--red)' : 'var(--fresh-500)',
                    border: 'none', cursor: 'pointer', color: '#fff',
                    fontSize: recording ? 22 : 26, transition: 'all 0.2s',
                  }}
                  className={recording ? 'voice-recording' : ''}
                >
                  {recording ? '■' : '🎤'}
                </button>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                  {recording ? '🔴 Recording… tap to stop' : 'Tap to speak'}
                </div>
              </div>

              {/* Transcript display */}
              {transcript && (
                <div style={{
                  background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '10px 12px',
                  fontSize: 13, color: 'var(--text)', marginBottom: 10, fontStyle: 'italic',
                }}>
                  "{transcript}"
                </div>
              )}

              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6, background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '8px 12px' }}>
                <strong style={{ color: 'var(--text2)' }}>Say:</strong> "Tomato 5 kilo 20 rupee" <br />
                বাংলা: "টমেটো পাঁচ কেজি বিশ টাকা" <br />
                हिंदी: "टमाटर पाँच किलो बीस रुपया"
              </div>
            </div>
          </div>

          {/* Manual entry */}
          <div className="card">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
              ✏️ Manual Entry
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ marginBottom: 10 }}>
                <select className="inp" value={selProduct} onChange={e => {
                  setSelProduct(e.target.value);
                  const p = products.find(pr => pr.id === e.target.value);
                  if (p) setPrice(String(p.market_price));
                }}>
                  <option value="">Select product…</option>
                  {['vegetable','fruit','fish','non_veg','dairy','other'].map(cat => (
                    <optgroup key={cat} label={cat.replace('_', ' ').toUpperCase()}>
                      {products.filter(p => p.category === cat).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.name_bengali ? `(${p.name_bengali})` : ''} — ₹{p.market_price}/{p.unit}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Qty sold</div>
                  <input className="inp" type="number" step="0.1" placeholder="e.g. 5.5" value={qty} onChange={e => setQty(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Price/unit (₹)</div>
                  <input className="inp" type="number" step="0.5" placeholder="e.g. 25" value={price} onChange={e => setPrice(e.target.value)} />
                </div>
              </div>
              {qty && price && (
                <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--fresh-500)', fontFamily: 'var(--mono)', fontWeight: 600 }}>
                  Total: ₹{(parseFloat(qty || '0') * parseFloat(price || '0')).toFixed(0)}
                </div>
              )}
              <button className="btn btn-fresh" style={{ width: '100%', justifyContent: 'center' }} onClick={addManual}>
                + Add to List
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: STAGED ENTRIES ── */}
        <div>
          <div className="card">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Staged Entries ({entries.length})</span>
              {totalAmount > 0 && <span style={{ fontFamily: 'var(--mono)', color: 'var(--fresh-500)', fontWeight: 700 }}>₹{totalAmount.toLocaleString()}</span>}
            </div>
            <div style={{ padding: 18 }}>
              {entries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text3)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                  <div>No entries yet. Add by voice or manually.</div>
                </div>
              ) : (
                <>
                  {entries.map((e, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <span style={{ fontSize: 12 }}>{e.method === 'voice' ? '🎤' : '✏️'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{e.product_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                          {e.qty} {e.unit} × ₹{e.price_per_unit}
                        </div>
                        {e.transcript && <div style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic', marginTop: 1 }}>"{e.transcript}"</div>}
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--fresh-500)', fontSize: 14 }}>₹{e.total.toFixed(0)}</div>
                      <button
                        onClick={() => removeEntry(i)}
                        style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
                      >×</button>
                    </div>
                  ))}
                  <button
                    className="btn btn-fresh"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
                    onClick={saveSales}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : `✓ Save ${entries.length} Sales — ₹${totalAmount.toLocaleString()}`}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Today's sales log */}
          {todaySales.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
                Today's Submitted Sales
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {todaySales.map((s: any) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 18px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{s.product_name}</span>
                      <span style={{ color: 'var(--text3)', marginLeft: 8 }}>{s.qty_sold} {s.unit} × ₹{s.price_per_unit}</span>
                    </div>
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
