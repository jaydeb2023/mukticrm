'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { showToast } from '../Toast';

interface Props { business: 'muktifresh' | 'cloud_kitchen'; }

export default function CallLogsPage({ business }: Props) {
  const { user, isAnyAdmin } = useAuth();
  const [calls, setCalls] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [dateFilter, setDateFilter] = useState('today');
  const [empFilter, setEmpFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const accent = business === 'muktifresh' ? 'var(--fresh-500)' : 'var(--kitchen-500)';

  const [form, setForm] = useState({
    lead_id: '', call_status: 'made', duration_mins: '',
    remark: '', followup_date: '', new_status: '',
  });

  // Stats
  const [todayStats, setTodayStats] = useState({ made: 0, missed: 0, total: 0 });

  useEffect(() => { load(); loadEmployees(); loadLeads(); }, [business, dateFilter, empFilter, statusFilter, search]);

  async function load() {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    let q = supabase
      .from('call_logs')
      .select('*, emp:users!call_logs_emp_id_fkey(name,color)', { count: 'exact' })
      .eq('business', business)
      .order('created_at', { ascending: false });

    if (dateFilter === 'today') q = q.gte('created_at', today);
    else if (dateFilter === 'week') q = q.gte('created_at', weekAgo);
    else if (dateFilter === 'month') q = q.gte('created_at', monthAgo);

    if (empFilter) q = q.eq('emp_id', empFilter);
    if (statusFilter) q = q.eq('call_status', statusFilter);
    if (!isAnyAdmin) q = q.eq('emp_id', user!.id);

    const { data, count: c } = await q.limit(100);
    setCalls(data || []);
    setCount(c || 0);

    // Today stats
    const made = (data || []).filter((c: any) => c.call_status === 'made' && c.created_at >= today).length;
    const missed = (data || []).filter((c: any) => c.call_status === 'missed' && c.created_at >= today).length;
    setTodayStats({ made, missed, total: made + missed });
  }

  async function loadEmployees() {
    const { data } = await supabase.from('users').select('id,name,color').eq('is_active', true);
    setEmployees(data || []);
  }

  async function loadLeads() {
    let q = supabase.from('leads').select('id,name,phone,company').eq('business', business).eq('is_junk', false).order('name').limit(200);
    if (!isAnyAdmin) q = q.eq('assigned_to', user!.id);
    const { data } = await q;
    setLeads(data || []);
  }

  async function saveCall() {
    if (!form.lead_id || !form.call_status || !form.remark) {
      showToast('Select lead, call status and add a remark', 'error'); return;
    }
    setSaving(true);
    const lead = leads.find(l => l.id === form.lead_id);
    const { error } = await supabase.from('call_logs').insert({
      lead_id: form.lead_id,
      emp_id: user!.id,
      business,
      call_status: form.call_status,
      duration_mins: parseInt(form.duration_mins) || 0,
      remark: form.remark,
      followup_date: form.followup_date || null,
      new_status: form.new_status || null,
    });
    if (error) { showToast(error.message, 'error'); setSaving(false); return; }

    // Update lead status if changed
    const updates: any = { call_count: supabase.rpc('increment', { x: 1 }), last_remark: form.remark, updated_at: new Date().toISOString() };
    if (form.new_status) updates.status = form.new_status;
    if (form.followup_date) updates.followup_date = form.followup_date;
    await supabase.from('leads').update({ last_remark: form.remark, ...(form.new_status && { status: form.new_status }), ...(form.followup_date && { followup_date: form.followup_date }) }).eq('id', form.lead_id);

    showToast('Call logged ✓', 'success');
    setShowModal(false);
    setForm({ lead_id: '', call_status: 'made', duration_mins: '', remark: '', followup_date: '', new_status: '' });
    load(); setSaving(false);
  }

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }} className="grid-3">
        <div className="stat-card"><div style={{ fontSize: 22, marginBottom: 8 }}>📞</div><div className="stat-val" style={{ color: accent, fontSize: 26 }}>{todayStats.total}</div><div className="stat-lbl">Calls today</div></div>
        <div className="stat-card"><div style={{ fontSize: 22, marginBottom: 8 }}>✅</div><div className="stat-val" style={{ color: 'var(--green)', fontSize: 26 }}>{todayStats.made}</div><div className="stat-lbl">Connected</div></div>
        <div className="stat-card"><div style={{ fontSize: 22, marginBottom: 8 }}>❌</div><div className="stat-val" style={{ color: 'var(--red)', fontSize: 26 }}>{todayStats.missed}</div><div className="stat-lbl">Missed / No answer</div></div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="inp" placeholder="Search remark…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        <select className="inp" style={{ width: 'auto' }} value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
          <option value="">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
        {isAnyAdmin && (
          <select className="inp" style={{ width: 'auto' }} value={empFilter} onChange={e => setEmpFilter(e.target.value)}>
            <option value="">All staff</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}
        <select className="inp" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All calls</option>
          <option value="made">Made</option>
          <option value="missed">Missed</option>
          <option value="no_answer">No Answer</option>
          <option value="busy">Busy</option>
        </select>
        <button className="btn" style={{ background: accent, color: '#fff' }} onClick={() => setShowModal(true)}>
          + Log Call
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Staff</th>
                <th>Lead / Customer</th>
                <th>Call Status</th>
                <th>Duration</th>
                <th>Follow-up</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              {calls.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-icon">📞</div><div className="empty-state-title">No calls logged</div></div></td></tr>
              ) : calls.map(c => (
                <tr key={c.id}>
                  <td style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                    {new Date(c.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: c.emp?.color || accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>
                        {c.emp?.name?.[0]}
                      </div>
                      <span style={{ fontSize: 12 }}>{c.emp?.name}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, fontWeight: 600 }}>{c.lead_name || c.customer_name || '—'}</td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                      background: c.call_status === 'made' ? 'var(--green-dim)' : 'var(--red-dim)',
                      color: c.call_status === 'made' ? 'var(--green)' : 'var(--red)',
                    }}>
                      {c.call_status === 'made' ? '✅ Made' : '❌ ' + c.call_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                    {c.duration_mins ? `${c.duration_mins}m` : '—'}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--amber)' }}>
                    {c.followup_date || '—'}
                  </td>
                  <td style={{ fontSize: 12, maxWidth: 220 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)' }}>
                      {c.remark || '—'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log call modal */}
      {showModal && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-sm">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
              <span style={{ fontSize: 17, fontWeight: 800 }}>📞 Log a Call</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Lead *</div>
              <select className="inp" value={form.lead_id} onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))}>
                <option value="">Select lead…</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.name} — {l.phone}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Call Status *</div>
                <select className="inp" value={form.call_status} onChange={e => setForm(f => ({ ...f, call_status: e.target.value }))}>
                  <option value="made">✅ Made</option>
                  <option value="missed">❌ Missed</option>
                  <option value="no_answer">No Answer</option>
                  <option value="busy">Busy</option>
                  <option value="callback_scheduled">Callback Scheduled</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Duration (mins)</div>
                <input className="inp" type="number" min="0" placeholder="e.g. 5" value={form.duration_mins} onChange={e => setForm(f => ({ ...f, duration_mins: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Update Lead Status</div>
                <select className="inp" value={form.new_status} onChange={e => setForm(f => ({ ...f, new_status: e.target.value }))}>
                  <option value="">No change</option>
                  <option value="called">Called</option>
                  <option value="interested">Interested</option>
                  <option value="callback">Callback</option>
                  <option value="notinterested">Not Interested</option>
                  <option value="closed">Closed ✓</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Follow-up Date</div>
                <input className="inp" type="date" value={form.followup_date} onChange={e => setForm(f => ({ ...f, followup_date: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Remark *</div>
              <textarea className="inp" rows={3} placeholder="What was discussed? Next steps?" value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn" style={{ background: accent, color: '#fff' }} onClick={saveCall} disabled={saving}>
                {saving ? 'Saving…' : '✓ Save Call'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
