'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/neonbase';
import { useAuth } from '@/lib/auth';
import { showToast } from '../Toast';

interface Props { business: 'muktifresh' | 'cloud_kitchen'; }

const STATUS_OPTIONS = ['new','called','interested','callback','notinterested','closed','junk'];
const STATUS_LABELS: Record<string,string> = { new:'New', called:'Called', interested:'Interested', callback:'Callback', notinterested:'Not Interested', closed:'Closed', junk:'Junk' };

export default function LeadsPage({ business }: Props) {
  const { user, isAnyAdmin } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedLeads, setParsedLeads] = useState<any[]>([]);

  const accent = business === 'muktifresh' ? 'var(--fresh-500)' : 'var(--kitchen-500)';
  const PAGE_SIZE = 50;

  useEffect(() => {
    loadEmployees();
    loadLeads(true);
  }, [business, statusFilter, search]);

  async function loadEmployees() {
    const { data } = await supabase.from('users').select('id,name,color').eq('is_active', true).in('role', ['fresh_staff','kitchen_staff','fresh_admin','kitchen_admin','super_admin']);
    setEmployees(data || []);
  }

  async function loadLeads(reset = false) {
    setLoading(true);
    const offset = reset ? 0 : page * PAGE_SIZE;
    if (reset) setPage(0);

    let q = supabase
      .from('leads')
      .select('*, assignee:users!leads_assigned_to_fkey(name,color)', { count: 'exact' })
      .eq('business', business)
      .eq('is_junk', statusFilter === 'junk')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (statusFilter && statusFilter !== 'junk') q = q.eq('status', statusFilter);
    if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,company.ilike.%${search}%`);
    if (!isAnyAdmin) q = q.eq('assigned_to', user!.id);

    const { data, count: c } = await q;
    setLeads(data || []);
    setCount(c || 0);
    setLoading(false);
  }

  // ─── AI Parse pasted text ─────────────────────────────────
  async function parsePastedText() {
    if (!pasteText.trim()) return;
    setParsing(true);
    setParsedLeads([]);
    try {
      const res = await fetch('/api/ai/parse-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText, business }),
      });
      const { leads: parsed } = await res.json();
      setParsedLeads(parsed || []);
      if (!parsed?.length) showToast('Could not parse any leads', 'warn');
    } catch {
      // Fallback: basic line parsing
      const lines = pasteText.split('\n').filter(l => l.trim());
      const fallback = lines.map(line => {
        const phone = line.match(/(\+?91?\s?)?[6-9]\d{9}/)?.[0]?.replace(/\D/g,'') || '';
        const nameMatch = line.match(/^([A-Za-z\u0980-\u09FF\s]{3,30})/);
        return { name: nameMatch?.[1]?.trim() || 'Unknown', phone, source: 'ai_paste', business };
      }).filter(l => l.name !== 'Unknown' || l.phone);
      setParsedLeads(fallback);
    }
    setParsing(false);
  }

  async function importParsedLeads() {
    if (!parsedLeads.length) return;
    const rows = parsedLeads.map(l => ({ ...l, business, created_by: user?.id, status: 'new' }));
    const { error } = await supabase.from('leads').insert(rows);
    if (error) { showToast('Import failed: ' + error.message, 'error'); return; }
    showToast(`✓ Imported ${rows.length} leads`, 'success');
    setParsedLeads([]); setPasteText(''); setShowPaste(false);
    loadLeads(true);
  }

  async function handleExcelUpload(file: File) {
    const XLSX = (await import('xlsx')).default;
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws);

    const FIELD_MAP: Record<string, string> = {
      'name': 'name', 'customer name': 'name', 'client name': 'name',
      'phone': 'phone', 'mobile': 'phone', 'contact': 'phone', 'phone number': 'phone',
      'email': 'email', 'address': 'address', 'company': 'company', 'area': 'city',
      'city': 'city', 'remark': 'last_remark', 'notes': 'last_remark',
    };

    const leads = rows.map(row => {
      const lead: any = { business, status: 'new', source: 'excel_upload', created_by: user?.id };
      Object.entries(row).forEach(([k, v]) => {
        const mapped = FIELD_MAP[k.toLowerCase().trim()];
        if (mapped) lead[mapped] = String(v || '').trim();
      });
      return lead;
    }).filter(l => l.name || l.phone);

    if (!leads.length) { showToast('No valid rows found in Excel', 'error'); return; }

    // Batch insert
    const BATCH = 500;
    for (let i = 0; i < leads.length; i += BATCH) {
      const { error } = await supabase.from('leads').insert(leads.slice(i, i + BATCH));
      if (error) { showToast('Batch error: ' + error.message, 'error'); return; }
    }
    showToast(`✓ Imported ${leads.length} leads from Excel`, 'success');
    loadLeads(true);
  }

  async function quickUpdateStatus(leadId: string, status: string) {
    await supabase.from('leads').update({ status, updated_at: new Date().toISOString() }).eq('id', leadId);
    showToast('Status updated', 'success');
    loadLeads();
  }

  function openWhatsApp(phone: string) {
    const clean = phone.replace(/\D/g, '');
    const full = clean.startsWith('91') ? clean : `91${clean}`;
    window.open(`https://wa.me/${full}`, '_blank');
  }

  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <div>
      {/* Action bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <input className="inp" placeholder="Name, phone, company…" value={search} onChange={e => { setSearch(e.target.value); }} style={{ paddingLeft: 36 }} />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 14 }}>🔍</span>
        </div>
        <select className="inp" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        {isAnyAdmin && (
          <>
            <button className="btn" style={{ background: accent, color: '#fff' }} onClick={() => setShowAdd(true)}>+ Add Lead</button>
            <button className="btn btn-ghost" onClick={() => setShowPaste(true)}>✨ Paste / AI Import</button>
            <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
              📊 Excel Upload
              <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleExcelUpload(e.target.files[0])} />
            </label>
          </>
        )}
      </div>

      {/* Count */}
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
        {count.toLocaleString()} lead{count !== 1 ? 's' : ''}
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Company</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Follow-up</th>
                <th>Assigned</th>
                <th>Last Remark</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>Loading…</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-title">No leads yet</div><div>Import from Excel or paste data above</div></div>
                </td></tr>
              ) : leads.map(lead => {
                const today = new Date().toISOString().slice(0, 10);
                const isOverdue = lead.followup_date && lead.followup_date < today && !['closed','junk'].includes(lead.status);
                const isDueToday = lead.followup_date === today;
                return (
                  <tr key={lead.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{lead.name}</div>
                      {lead.city && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{lead.city}</div>}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{lead.phone}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{lead.company || '—'}</td>
                    <td>
                      <select
                        value={lead.status}
                        onChange={e => quickUpdateStatus(lead.id, e.target.value)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontFamily: 'var(--font)', fontSize: 11, fontWeight: 700,
                          color: lead.status === 'closed' ? 'var(--green)' : lead.status === 'interested' ? 'var(--fresh-500)' : lead.status === 'notinterested' ? 'var(--red)' : 'var(--amber)',
                        }}
                      >
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                    </td>
                    <td>
                      <span className={`badge badge-${lead.priority}`}>{lead.priority}</span>
                    </td>
                    <td>
                      {isOverdue && <span style={{ color: 'var(--red)', fontSize: 11, fontWeight: 700 }}>⚠️ {lead.followup_date}</span>}
                      {isDueToday && <span style={{ color: 'var(--amber)', fontSize: 11, fontWeight: 700 }}>Today</span>}
                      {!isOverdue && !isDueToday && lead.followup_date && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{lead.followup_date}</span>}
                      {!lead.followup_date && <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>}
                    </td>
                    <td>
                      {lead.assignee ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: lead.assignee.color || accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>
                            {lead.assignee.name?.[0]}
                          </div>
                          <span style={{ fontSize: 11 }}>{lead.assignee.name}</span>
                        </div>
                      ) : <span style={{ color: 'var(--text3)', fontSize: 11 }}>Unassigned</span>}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text2)', maxWidth: 150 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.last_remark || '—'}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <a href={`tel:${lead.phone}`} className="call-btn btn-xs">📞</a>
                        {(lead.whatsapp || lead.phone) && (
                          <button onClick={() => openWhatsApp(lead.whatsapp || lead.phone)} className="wa-btn btn-xs">WA</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)' }}>
            <button className="btn btn-ghost btn-xs" disabled={page === 0} onClick={() => { setPage(p => p - 1); loadLeads(); }}>← Prev</button>
            <span>Page {page + 1} of {totalPages}</span>
            <button className="btn btn-ghost btn-xs" disabled={page >= totalPages - 1} onClick={() => { setPage(p => p + 1); loadLeads(); }}>Next →</button>
          </div>
        )}
      </div>

      {/* Paste / AI import modal */}
      {showPaste && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowPaste(false)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 17, fontWeight: 800 }}>✨ Paste & AI Import</span>
              <button onClick={() => setShowPaste(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.6 }}>
              Paste anything — WhatsApp messages, email lists, Excel copy-paste, any format. AI will extract names and phone numbers.
            </div>
            <textarea
              className="inp"
              style={{ minHeight: 160, fontFamily: 'var(--mono)', fontSize: 12 }}
              placeholder={"Example:\nRaj Sharma +91 98765 43210 Salt Lake\nName: Priya | Mobile: 9876543211 | Area: Behala\nপ্রিয়া দেবী, ৯৮৭৬৫৪৩২১২, বালিগঞ্জ"}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn" style={{ background: accent, color: '#fff' }} onClick={parsePastedText} disabled={parsing}>
                {parsing ? '✨ Parsing…' : '✨ Parse with AI'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setPasteText(''); setParsedLeads([]); }}>Clear</button>
            </div>

            {parsedLeads.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Found {parsedLeads.length} leads:</div>
                <div style={{ maxHeight: 200, overflowY: 'auto', background: 'var(--bg2)', borderRadius: 'var(--r)', padding: 12 }}>
                  {parsedLeads.map((l, i) => (
                    <div key={i} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12 }}>
                      <span style={{ fontWeight: 600, minWidth: 160 }}>{l.name}</span>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{l.phone}</span>
                      {l.city && <span style={{ color: 'var(--text3)' }}>{l.city}</span>}
                    </div>
                  ))}
                </div>
                <button className="btn" style={{ background: accent, color: '#fff', marginTop: 10 }} onClick={importParsedLeads}>
                  ✓ Import All {parsedLeads.length} Leads
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
