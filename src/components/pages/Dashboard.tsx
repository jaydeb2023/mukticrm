'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function Dashboard() {
  const { user, isSuperAdmin, canSeeFresh, canSeeKitchen, canSeeMarket } = useAuth();
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    try {
      const queries: Promise<any>[] = [];
      const keys: string[] = [];

      if (canSeeFresh) {
        queries.push(
          supabase.from('leads').select('id', { count: 'exact' }).eq('business', 'muktifresh').eq('is_junk', false),
          supabase.from('leads').select('id', { count: 'exact' }).eq('business', 'muktifresh').eq('status', 'interested'),
          supabase.from('leads').select('id', { count: 'exact' }).eq('business', 'muktifresh').eq('followup_date', today).not('status', 'in', '("closed","junk")'),
          supabase.from('leads').select('id', { count: 'exact' }).eq('business', 'muktifresh').lt('followup_date', today).not('status', 'in', '("closed","junk")'),
          supabase.from('complaints').select('id', { count: 'exact' }).eq('business', 'muktifresh').eq('status', 'open'),
          supabase.from('customers').select('id', { count: 'exact' }).eq('business', 'muktifresh'),
        );
        keys.push('freshLeads','freshInterested','freshDueToday','freshOverdue','freshComplaints','freshCustomers');
      }

      if (canSeeKitchen) {
        queries.push(
          supabase.from('kitchen_orders').select('id', { count: 'exact' }).in('order_status', ['new','confirmed','preparing','ready']),
          supabase.from('leads').select('id', { count: 'exact' }).eq('business', 'cloud_kitchen').eq('is_junk', false),
          supabase.from('complaints').select('id', { count: 'exact' }).eq('business', 'cloud_kitchen').eq('status', 'open'),
        );
        keys.push('kitchenActive','kitchenLeads','kitchenComplaints');
      }

      if (canSeeMarket) {
        queries.push(
          supabase.from('market_dispatches').select('id', { count: 'exact' }).eq('dispatch_date', today),
          supabase.from('market_dispatches').select('id', { count: 'exact' }).eq('dispatch_date', today).eq('discrepancy_flagged', true),
          supabase.from('market_sales').select('total_amount').eq('sale_date', today),
        );
        keys.push('todayDispatches','flaggedDispatches','todaySales');
      }

      const results = await Promise.all(queries);
      const s: any = {};
      keys.forEach((k, i) => {
        s[k] = results[i].count !== undefined ? results[i].count : results[i].data;
      });

      // Compute today's total sales
      if (s.todaySales) {
        s.todaySalesTotal = (s.todaySales as any[]).reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0);
      }

      setStats(s);

      // Build alerts
      const a: string[] = [];
      if (s.freshOverdue > 0) a.push(`⚠️ ${s.freshOverdue} overdue follow-ups — MuktiFresh`);
      if (s.freshComplaints > 0) a.push(`🔴 ${s.freshComplaints} open complaints — MuktiFresh`);
      if (s.kitchenComplaints > 0) a.push(`🔴 ${s.kitchenComplaints} open complaints — Cloud Kitchen`);
      if (s.flaggedDispatches > 0) a.push(`⚠️ ${s.flaggedDispatches} dispatch discrepancy today — check market agents!`);
      if (s.kitchenActive > 0) a.push(`🍳 ${s.kitchenActive} active kitchen orders right now`);
      setAlerts(a);

      // Recent call logs
      const { data: calls } = await supabase
        .from('call_logs')
        .select('*, emp:users!call_logs_emp_id_fkey(name,color)')
        .gte('created_at', weekAgo)
        .order('created_at', { ascending: false })
        .limit(8);
      setRecentActivity(calls || []);

    } catch (e) { console.error(e); }
    setLoading(false);
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div className="spin" />
    </div>
  );

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>
          Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name.split(' ')[0]} 👋
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Alerts */}
      {alerts.map((a, i) => (
        <div key={i} className={`alert-banner ${a.startsWith('⚠️') ? 'alert-warn' : 'alert-danger'}`} style={{ marginBottom: 8 }}>
          {a}
        </div>
      ))}

      {/* MuktiFresh stats */}
      {canSeeFresh && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fresh-500)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10, marginTop: alerts.length ? 16 : 0 }}>
            🌿 MuktiFresh
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }} className="grid-3">
            <StatCard value={stats.freshLeads || 0} label="Total Leads" color="var(--fresh-500)" icon="👥" />
            <StatCard value={stats.freshInterested || 0} label="Interested" color="var(--green)" icon="🔥" />
            <StatCard value={stats.freshCustomers || 0} label="Customers" color="var(--cyan)" icon="💚" />
            <StatCard value={stats.freshDueToday || 0} label="Follow-ups Today" color="var(--amber)" icon="📅" />
            <StatCard value={stats.freshOverdue || 0} label="Overdue" color="var(--red)" icon="⚠️" />
            <StatCard value={stats.freshComplaints || 0} label="Open Complaints" color="var(--red)" icon="🔴" />
          </div>
        </>
      )}

      {/* Cloud Kitchen stats */}
      {canSeeKitchen && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--kitchen-500)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>
            🍳 Cloud Kitchen
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }} className="grid-3">
            <StatCard value={stats.kitchenActive || 0} label="Live Orders" color="var(--kitchen-500)" icon="🍳" />
            <StatCard value={stats.kitchenLeads || 0} label="Total Leads" color="var(--orange)" icon="👥" />
            <StatCard value={stats.kitchenComplaints || 0} label="Open Complaints" color="var(--red)" icon="🔴" />
          </div>
        </>
      )}

      {/* Offline Market stats */}
      {canSeeMarket && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>
            🏪 Offline Markets — Today
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }} className="grid-3">
            <StatCard value={stats.todayDispatches || 0} label="Dispatches Out" color="var(--cyan)" icon="📦" />
            <StatCard value={`₹${(stats.todaySalesTotal || 0).toLocaleString()}`} label="Sales Today" color="var(--fresh-500)" icon="💰" />
            <StatCard value={stats.flaggedDispatches || 0} label="Discrepancies" color="var(--red)" icon="⚠️" />
          </div>
        </>
      )}

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
            📞 Recent Call Activity (7 days)
          </div>
          <div>
            {recentActivity.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: c.emp?.color || 'var(--fresh-500)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0,
                }}>{c.emp?.name?.[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.emp?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.remark || 'Call logged'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: c.call_status === 'made' ? 'var(--green)' : 'var(--red)' }}>
                    {c.call_status === 'made' ? '✅ Made' : '❌ Missed'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                    {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label, color, icon }: { value: any; label: string; color: string; icon: string }) {
  return (
    <div className="stat-card">
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <div className="stat-val" style={{ color, fontSize: 26 }}>{value}</div>
      <div className="stat-lbl">{label}</div>
    </div>
  );
}
