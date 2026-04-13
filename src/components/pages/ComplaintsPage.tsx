'use client';
import { useState, useEffect } from 'react';
import { loginUser, Role } from '@/lib/neonbase';
import { useAuth } from '@/lib/auth';
import { showToast } from '../Toast';

interface Props { business: 'muktifresh' | 'cloud_kitchen'; }

const TYPES_FRESH = ['product_quality','delivery_delay','wrong_order','payment_issue','staff_behavior','other'];
const TYPES_KITCHEN = ['food_quality','delivery_delay','wrong_order','payment_issue','packaging','portion_size','other'];
const TYPE_LABELS: Record<string,string> = {
  product_quality:'Product Quality', food_quality:'Food Quality', delivery_delay:'Delivery Delay',
  wrong_order:'Wrong Order', payment_issue:'Payment Issue', staff_behavior:'Staff Behavior',
  packaging:'Packaging', portion_size:'Portion Size', app_issue:'App Issue', other:'Other',
};
const STATUS_OPTS = ['open','in_progress','resolved','closed','escalated'];

export default function ComplaintsPage({ business }: Props) {
  const { user, isAnyAdmin } = useAuth();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const accent = business === 'muktifresh' ? 'var(--fresh-500)' : 'var(--kitchen-500)';
  const types = business === 'muktifresh' ? TYPES_FRESH : TYPES_KITCHEN;

  // Form state
  const [form, setForm] = useState({
    customer_name: '', phone: '', complaint_type: '', subject: '',
    description: '', priority: 'medium', assigned_to: '',
  });

  useEffect(() => { load(); loadEmployees(); }, [business, statusFilter, priorityFilter, search]);

  async function load() {
    let q = supabase.from('complaints')
      .select('*, assignee:users!complaints_assigned_to_fkey(name,color)', { count: 'exact' })
      .eq('business', business)
      .order('created_at', { ascending: false });
    if (statusFilter) q = q.eq('status', statusFilter);
    if (priorityFilter) q = q.eq('priority', priorityFilter);
    if (search) q = q.or(`customer_name.ilike.%${search}%,phone.ilike.%${search}%,subject.ilike.%${search}%`);
    const { data, count: c } = await q;
    setComplaints(data || []);
    setCount(c || 0);
  }

  async function loadEmployees() {
    const { data } = await supabase.from('users').select('id,name,color').eq('is_active', true);
    setEmployees(data || []);
  }

  async function save() {
    if (!form.customer_name || !form.complaint_type || !form.subject) {
      showToast('Fill name, type and subject', 'error'); return;
    }
    setSaving(true);
    const payload = { ...form, business, created_by: user?.id };
    const { error } = editItem
      ? await supabase.from('complaints').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editItem.id)
      : await supabase.from('complaints').insert(payload);
    if (error) { showToast(error.message, 'error'); setSaving(false); return; }
    showToast(editItem ? 'Complaint updated' : 'Complaint logged', 'success');
    setShowModal(false); setEditItem(null);
    setForm({ customer_name: '', phone: '', complaint_type: '', subject: '', description: '', priority: 'medium', assigned_to: '' });
    load(); setSaving(false);
  }

  async function updateStatus(id: string, status: string) {
    const update: any = { status, updated_at: new Date().toISOString() };
    if (status === 'resolved') { update.resolved_by = user?.id; update.resolved_at = new Date().toISOString(); }
    await supabase.from('complaints').update(update).eq('id', id);
    showToast('Status updated', 'success'); load();
  }

  function openEdit(c: any) {
    setEditItem(c);
    setForm({ customer_name: c.customer_name, phone: c.phone || '', complaint_type: c.complaint_type, subject: c.subject, description: c.description || '', priority: c.priority, assigned_to: c.assigned_to || '' });
    setShowModal(true);
  }

  const statusColor: Record<string,string> = {
    open: 'var(--red)', in_progress: 'var(--amber)', resolved: 'var(--green)',
    closed: 'var(--text3)', escalated: 'var(--purple)',
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="inp" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <select className="inp" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select className="inp" style={{ width: 'auto' }} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button className="btn" style={{ background: accent, color: '#fff' }} onClick={() => { setEditItem(null); setShowModal(true); }}>
          + Log Complaint
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>{count} complaint{count !== 1 ? 's' : ''}</div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Type</th>
                <th>Subject</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {complaints.length === 0 ? (
                <tr><td colSpan={9}><div className="empty-state"><div className="empty-state-icon">✅</div><div className="empty-state-title">No complaints</div></div></td></tr>
              ) : complaints.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.customer_name}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{c.phone || '—'}</td>
                  <td><span style={{ fontSize: 11, color: 'var(--text2)' }}>{TYPE_LABELS[c.complaint_type] || c.complaint_type}</span></td>
                  <td style={{ maxWidth: 200 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{c.subject}</div>
                    {c.description && <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description}</div>}
                  </td>
                  <td><span className={`badge badge-${c.priority}`}>{c.priority}</span></td>
                  <td>
                    <select
                      value={c.status}
                      onChange={e => updateStatus(c.id, e.target.value)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 11, fontWeight: 700, color: statusColor[c.status] || 'var(--text)' }}
                    >
                      {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td>
                    {c.assignee ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: c.assignee.color || accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>
                          {c.assignee.name?.[0]}
                        </div>
                        <span style={{ fontSize: 11 }}>{c.assignee.name}</span>
                      </div>
                    ) : <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                    {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-xs" onClick={() => openEdit(c)}>Edit</button>
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="call-btn btn-xs">📞</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
              <span style={{ fontSize: 17, fontWeight: 800 }}>{editItem ? 'Edit Complaint' : 'Log Complaint'}</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Customer Name *</div>
                <input className="inp" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Customer name" />
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Phone</div>
                <input className="inp" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Complaint Type *</div>
                <select className="inp" value={form.complaint_type} onChange={e => setForm(f => ({ ...f, complaint_type: e.target.value }))}>
                  <option value="">Select type…</option>
                  {types.map(t => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Priority</div>
                <select className="inp" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Subject *</div>
              <input className="inp" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Brief subject of complaint" />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Description</div>
              <textarea className="inp" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detailed description…" rows={3} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Assign To</div>
              <select className="inp" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                <option value="">Unassigned</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn" style={{ background: accent, color: '#fff' }} onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editItem ? 'Update' : 'Log Complaint'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
