'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { showToast } from '../Toast';

interface Props { business: 'muktifresh' | 'cloud_kitchen'; }

export default function CustomersPage({ business }: Props) {
  const { user, isAnyAdmin } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE = 50;

  const accent = business === 'muktifresh' ? 'var(--fresh-500)' : 'var(--kitchen-500)';

  const blank = { name: '', phone: '', whatsapp: '', email: '', address: '', flat_no: '', complex_name: '', area: '', city: 'Kolkata', pin_code: '', notes: '' };
  const [form, setForm] = useState(blank);

  useEffect(() => { load(true); }, [business, search, typeFilter]);

  async function load(reset = false) {
    if (reset) setPage(0);
    const off = reset ? 0 : page * PAGE;
    let q = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .or(`business.eq.${business},business.eq.both`)
      .order('created_at', { ascending: false })
      .range(off, off + PAGE - 1);
    if (typeFilter) q = q.eq('customer_type', typeFilter);
    if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,area.ilike.%${search}%`);
    const { data, count: c } = await q;
    setCustomers(data || []);
    setCount(c || 0);
  }

  async function save() {
    if (!form.name) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    const payload = { ...form, business, created_by: user?.id };
    const { error } = editItem
      ? await supabase.from('customers').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editItem.id)
      : await supabase.from('customers').insert(payload);
    if (error) { showToast(error.message, 'error'); setSaving(false); return; }
    showToast(editItem ? 'Customer updated' : 'Customer added', 'success');
    setShowModal(false); setEditItem(null); setForm(blank);
    load(true); setSaving(false);
  }

  async function parseAndImport() {
    if (!pasteText.trim()) return;
    setParsing(true);
    try {
      const res = await fetch('/api/ai/parse-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText, business }),
      });
      const { leads } = await res.json();
      setParsed(leads || []);
    } catch {
      showToast('Parse error', 'error');
    }
    setParsing(false);
  }

  async function importParsed() {
    if (!parsed.length) return;
    const rows = parsed.map(p => ({ ...p, business, source: 'ai_paste', created_by: user?.id, customer_type: 'new' }));
    const { error } = await supabase.from('customers').insert(rows);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(`✓ Imported ${rows.length} customers`, 'success');
    setParsed([]); setPasteText(''); setShowPaste(false);
    load(true);
  }

  async function handleExcel(file: File) {
    const XLSX = (await import('xlsx')).default;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws);
    const MAP: Record<string,string> = {
      'name':'name','customer name':'name','flat no':'flat_no','flat':'flat_no','flat number':'flat_no',
      'complex':'complex_name','building':'complex_name','complex name':'complex_name',
      'address':'address','area':'area','locality':'area','city':'city',
      'pin':'pin_code','pincode':'pin_code','pin code':'pin_code',
      'phone':'phone','mobile':'phone','contact':'phone','whatsapp':'whatsapp',
      'email':'email','notes':'notes',
    };
    const customers = rows.map(row => {
      const c: any = { business, source: 'excel_upload', created_by: user?.id, customer_type: 'new', city: 'Kolkata' };
      Object.entries(row).forEach(([k, v]) => {
        const m = MAP[k.toLowerCase().trim()];
        if (m) c[m] = String(v || '').trim();
      });
      return c;
    }).filter(c => c.name || c.phone);
    if (!customers.length) { showToast('No valid rows found', 'error'); return; }
    const BATCH = 500;
    for (let i = 0; i < customers.length; i += BATCH) {
      await supabase.from('customers').insert(customers.slice(i, i + BATCH));
    }
    showToast(`✓ Imported ${customers.length} customers`, 'success');
    load(true);
  }

  function openEdit(c: any) {
    setEditItem(c);
    setForm({ name: c.name, phone: c.phone || '', whatsapp: c.whatsapp || '', email: c.email || '', address: c.address || '', flat_no: c.flat_no || '', complex_name: c.complex_name || '', area: c.area || '', city: c.city || 'Kolkata', pin_code: c.pin_code || '', notes: c.notes || '' });
    setShowModal(true);
  }

  function openWhatsApp(phone: string) {
    const clean = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${clean.startsWith('91') ? clean : '91' + clean}`, '_blank');
  }

  const typeColors: Record<string,string> = { new: 'var(--blue)', regular: 'var(--green)', loyal: 'var(--purple)', at_risk: 'var(--amber)', inactive: 'var(--text3)' };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="inp" placeholder="Name, phone, area…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <select className="inp" style={{ width: 'auto' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="new">New</option>
          <option value="regular">Regular</option>
          <option value="loyal">Loyal</option>
          <option value="at_risk">At Risk</option>
          <option value="inactive">Inactive</option>
        </select>
        {isAnyAdmin && (
          <>
            <button className="btn" style={{ background: accent, color: '#fff' }} onClick={() => { setEditItem(null); setForm(blank); setShowModal(true); }}>+ Add Customer</button>
            <button className="btn btn-ghost" onClick={() => setShowPaste(true)}>✨ Paste Import</button>
            <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
              📊 Excel
              <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleExcel(e.target.files[0])} />
            </label>
          </>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>{count.toLocaleString()} customers</div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Phone</th><th>Address</th><th>Area</th><th>Type</th><th>Due ₹</th><th>Orders</th><th>Last Purchase</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={9}><div className="empty-state"><div className="empty-state-icon">💚</div><div className="empty-state-title">No customers yet</div></div></td></tr>
              ) : customers.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    {c.flat_no && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{c.flat_no}{c.complex_name ? ', ' + c.complex_name : ''}</div>}
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{c.phone || '—'}</td>
                  <td style={{ fontSize: 11, color: 'var(--text2)', maxWidth: 140 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address || '—'}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{c.area || '—'}</td>
                  <td>
                    <span style={{ fontSize: 10, fontWeight: 700, color: typeColors[c.customer_type] || 'var(--text3)' }}>
                      {c.customer_type?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: c.due_amount > 0 ? 'var(--red)' : 'var(--text3)' }}>
                    {c.due_amount > 0 ? `₹${c.due_amount}` : '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{c.total_orders || 0}</td>
                  <td style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {c.last_purchase ? new Date(c.last_purchase).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {c.phone && <a href={`tel:${c.phone}`} className="call-btn btn-xs">📞</a>}
                      {(c.whatsapp || c.phone) && <button onClick={() => openWhatsApp(c.whatsapp || c.phone)} className="wa-btn btn-xs">WA</button>}
                      <button className="btn btn-ghost btn-xs" onClick={() => openEdit(c)}>Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {Math.ceil(count / PAGE) > 1 && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)' }}>
            <button className="btn btn-ghost btn-xs" disabled={page === 0} onClick={() => { setPage(p => p - 1); load(); }}>← Prev</button>
            <span>Page {page + 1} of {Math.ceil(count / PAGE)}</span>
            <button className="btn btn-ghost btn-xs" disabled={page >= Math.ceil(count / PAGE) - 1} onClick={() => { setPage(p => p + 1); load(); }}>Next →</button>
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showModal && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
              <span style={{ fontSize: 17, fontWeight: 800 }}>{editItem ? 'Edit Customer' : 'Add Customer'}</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            {[
              [['Name *','name','text','Full name'], ['Phone','phone','tel','+91 XXXXX XXXXX']],
              [['WhatsApp','whatsapp','tel','If different'], ['Email','email','email','email@example.com']],
              [['Flat No','flat_no','text','e.g. A-304'], ['Complex / Building','complex_name','text','Society name']],
              [['Area / Locality','area','text','e.g. Salt Lake'], ['PIN Code','pin_code','text','700001']],
            ].map((row, ri) => (
              <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                {row.map(([lbl, key, type, ph]) => (
                  <div key={key as string}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>{lbl}</div>
                    <input className="inp" type={type as string} placeholder={ph as string} value={(form as any)[key as string]} onChange={e => setForm(f => ({ ...f, [key as string]: e.target.value }))} />
                  </div>
                ))}
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Full Address</div>
              <textarea className="inp" rows={2} placeholder="Street address…" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn" style={{ background: accent, color: '#fff' }} onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editItem ? 'Update' : 'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paste import modal */}
      {showPaste && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowPaste(false)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
              <span style={{ fontSize: 17, fontWeight: 800 }}>✨ Paste Customer Data</span>
              <button onClick={() => setShowPaste(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.6 }}>
              Paste from WhatsApp, Excel, any format. AI extracts names, phones, addresses automatically.
            </div>
            <textarea className="inp" style={{ minHeight: 150, fontFamily: 'var(--mono)', fontSize: 12 }}
              placeholder={"Rahul Das, Flat 3B, Sunshine Complex, Salt Lake, 9876543210\nPriya Sen | 9123456789 | C-12/3, Lake Town\nমিতা রায়, ফ্ল্যাট ৪এ, পার্ক স্ট্রিট, ৯৮৭৬৫৪৩২১১"}
              value={pasteText} onChange={e => setPasteText(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn" style={{ background: accent, color: '#fff' }} onClick={parseAndImport} disabled={parsing}>
                {parsing ? '✨ Parsing…' : '✨ Parse with AI'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setPasteText(''); setParsed([]); }}>Clear</button>
            </div>
            {parsed.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Found {parsed.length} customers:</div>
                <div style={{ maxHeight: 180, overflowY: 'auto', background: 'var(--bg2)', borderRadius: 'var(--r)', padding: 12 }}>
                  {parsed.map((p, i) => (
                    <div key={i} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12 }}>
                      <span style={{ fontWeight: 600, minWidth: 140 }}>{p.name}</span>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{p.phone}</span>
                      {p.area && <span style={{ color: 'var(--text3)' }}>{p.area}</span>}
                    </div>
                  ))}
                </div>
                <button className="btn" style={{ background: accent, color: '#fff', marginTop: 10 }} onClick={importParsed}>
                  ✓ Import {parsed.length} Customers
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
