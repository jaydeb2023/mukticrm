'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';

// Page components
import Dashboard from './pages/Dashboard';
import LeadsPage from './pages/LeadsPage';
import CustomersPage from './pages/CustomersPage';
import ComplaintsPage from './pages/ComplaintsPage';
import CallLogsPage from './pages/CallLogsPage';
import MarketDashboard from './pages/MarketDashboard';
import MarketDispatch from './pages/MarketDispatch';
import MarketSales from './pages/MarketSales';
import OfflineCustomers from './pages/OfflineCustomers';
import KitchenOrders from './pages/KitchenOrders';
import TeamPage from './pages/TeamPage';
import ReportsPage from './pages/ReportsPage';
import WhatsAppCenter from './pages/WhatsAppCenter';
import Toast from './Toast';

// ─── Navigation config ──────────────────────────────────────

const NAV = {
  super_admin: [
    { sec: 'Overview' },
    { id: 'dashboard', icon: 'grid', label: 'Dashboard' },
    { sec: 'MuktiFresh', color: 'var(--fresh-500)' },
    { id: 'leads-fresh', icon: 'users', label: 'Leads', biz: 'fresh' },
    { id: 'customers-fresh', icon: 'heart', label: 'Customers', biz: 'fresh' },
    { id: 'complaints-fresh', icon: 'alert', label: 'Complaints', biz: 'fresh' },
    { id: 'calls-fresh', icon: 'phone', label: 'Call Logs', biz: 'fresh' },
    { id: 'whatsapp-fresh', icon: 'whatsapp', label: 'WhatsApp', biz: 'fresh' },
    { sec: 'Cloud Kitchen', color: 'var(--kitchen-500)' },
    { id: 'kitchen-orders', icon: 'kitchen', label: 'Live Orders', biz: 'kitchen' },
    { id: 'leads-kitchen', icon: 'users', label: 'Leads', biz: 'kitchen' },
    { id: 'customers-kitchen', icon: 'heart', label: 'Customers', biz: 'kitchen' },
    { id: 'complaints-kitchen', icon: 'alert', label: 'Complaints', biz: 'kitchen' },
    { id: 'calls-kitchen', icon: 'phone', label: 'Call Logs', biz: 'kitchen' },
    { id: 'whatsapp-kitchen', icon: 'whatsapp', label: 'WhatsApp', biz: 'kitchen' },
    { sec: 'Offline Markets', color: 'var(--cyan)' },
    { id: 'market-dashboard', icon: 'market', label: 'Market Dashboard' },
    { id: 'market-dispatch', icon: 'box', label: 'Dispatch' },
    { id: 'market-sales', icon: 'rupee', label: 'Sales Entry' },
    { id: 'offline-customers', icon: 'map', label: 'Market Customers' },
    { sec: 'Team & Reports' },
    { id: 'team', icon: 'team', label: 'Team' },
    { id: 'reports', icon: 'bar', label: 'Reports' },
  ],
  fresh_admin: [
    { sec: 'Overview' },
    { id: 'dashboard', icon: 'grid', label: 'Dashboard' },
    { sec: 'MuktiFresh', color: 'var(--fresh-500)' },
    { id: 'leads-fresh', icon: 'users', label: 'Leads' },
    { id: 'customers-fresh', icon: 'heart', label: 'Customers' },
    { id: 'complaints-fresh', icon: 'alert', label: 'Complaints' },
    { id: 'calls-fresh', icon: 'phone', label: 'Call Logs' },
    { id: 'whatsapp-fresh', icon: 'whatsapp', label: 'WhatsApp' },
    { sec: 'Offline Markets', color: 'var(--cyan)' },
    { id: 'market-dispatch', icon: 'box', label: 'Dispatch' },
    { id: 'market-sales', icon: 'rupee', label: 'Sales Entry' },
    { id: 'offline-customers', icon: 'map', label: 'Market Customers' },
    { sec: 'Reports' },
    { id: 'reports', icon: 'bar', label: 'Reports' },
  ],
  kitchen_admin: [
    { sec: 'Overview' },
    { id: 'dashboard', icon: 'grid', label: 'Dashboard' },
    { sec: 'Cloud Kitchen', color: 'var(--kitchen-500)' },
    { id: 'kitchen-orders', icon: 'kitchen', label: 'Live Orders' },
    { id: 'leads-kitchen', icon: 'users', label: 'Leads' },
    { id: 'customers-kitchen', icon: 'heart', label: 'Customers' },
    { id: 'complaints-kitchen', icon: 'alert', label: 'Complaints' },
    { id: 'calls-kitchen', icon: 'phone', label: 'Call Logs' },
    { id: 'whatsapp-kitchen', icon: 'whatsapp', label: 'WhatsApp' },
    { sec: 'Reports' },
    { id: 'reports', icon: 'bar', label: 'Reports' },
  ],
  fresh_staff: [
    { sec: 'My Work' },
    { id: 'dashboard', icon: 'grid', label: 'Dashboard' },
    { id: 'leads-fresh', icon: 'users', label: 'My Leads' },
    { id: 'customers-fresh', icon: 'heart', label: 'Customers' },
    { id: 'complaints-fresh', icon: 'alert', label: 'Complaints' },
    { id: 'calls-fresh', icon: 'phone', label: 'My Calls' },
    { id: 'whatsapp-fresh', icon: 'whatsapp', label: 'WhatsApp' },
  ],
  kitchen_staff: [
    { sec: 'My Work' },
    { id: 'dashboard', icon: 'grid', label: 'Dashboard' },
    { id: 'kitchen-orders', icon: 'kitchen', label: 'Orders' },
    { id: 'calls-kitchen', icon: 'phone', label: 'My Calls' },
    { id: 'complaints-kitchen', icon: 'alert', label: 'Complaints' },
    { id: 'whatsapp-kitchen', icon: 'whatsapp', label: 'WhatsApp' },
  ],
  market_agent: [
    { sec: 'My Market' },
    { id: 'market-dashboard', icon: 'market', label: 'Today\'s Market' },
    { id: 'market-sales', icon: 'rupee', label: 'Add Sales' },
    { id: 'offline-customers', icon: 'map', label: 'Customers' },
    { id: 'whatsapp-fresh', icon: 'whatsapp', label: 'WhatsApp Blast' },
  ],
} as const;

// ─── Icons ──────────────────────────────────────────────────
function Icon({ name, size = 15 }: { name: string; size?: number }) {
  const s = { width: size, height: size, stroke: 'currentColor', fill: 'none', strokeWidth: 2 };
  const icons: Record<string, React.ReactNode> = {
    grid: <svg style={s} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    users: <svg style={s} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
    heart: <svg style={s} viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
    alert: <svg style={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    phone: <svg style={s} viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .84h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.09a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 15z"/></svg>,
    whatsapp: <svg style={s} viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,
    kitchen: <svg style={s} viewBox="0 0 24 24"><path d="M3 2l1.5 1.5L6 2l1.5 1.5L9 2v5a3 3 0 01-3 3v12H4V10a3 3 0 01-3-3V2zm13 0v20h-2V13h-2.5A.5.5 0 0111 12.5V7a5 5 0 015-5z"/></svg>,
    box: <svg style={s} viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    rupee: <svg style={s} viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
    map: <svg style={s} viewBox="0 0 24 24"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
    market: <svg style={s} viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    team: <svg style={s} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
    bar: <svg style={s} viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    logout: <svg style={s} viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    menu: <svg style={s} viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  };
  return <>{icons[name] || null}</>;
}

// ─── Page router ────────────────────────────────────────────
function renderPage(pageId: string) {
  if (pageId === 'dashboard') return <Dashboard />;
  if (pageId === 'leads-fresh') return <LeadsPage business="muktifresh" />;
  if (pageId === 'leads-kitchen') return <LeadsPage business="cloud_kitchen" />;
  if (pageId === 'customers-fresh') return <CustomersPage business="muktifresh" />;
  if (pageId === 'customers-kitchen') return <CustomersPage business="cloud_kitchen" />;
  if (pageId === 'complaints-fresh') return <ComplaintsPage business="muktifresh" />;
  if (pageId === 'complaints-kitchen') return <ComplaintsPage business="cloud_kitchen" />;
  if (pageId === 'calls-fresh') return <CallLogsPage business="muktifresh" />;
  if (pageId === 'calls-kitchen') return <CallLogsPage business="cloud_kitchen" />;
  if (pageId === 'whatsapp-fresh') return <WhatsAppCenter business="muktifresh" />;
  if (pageId === 'whatsapp-kitchen') return <WhatsAppCenter business="cloud_kitchen" />;
  if (pageId === 'kitchen-orders') return <KitchenOrders />;
  if (pageId === 'market-dashboard') return <MarketDashboard />;
  if (pageId === 'market-dispatch') return <MarketDispatch />;
  if (pageId === 'market-sales') return <MarketSales />;
  if (pageId === 'offline-customers') return <OfflineCustomers />;
  if (pageId === 'team') return <TeamPage />;
  if (pageId === 'reports') return <ReportsPage />;
  return <div style={{ padding: 24, color: 'var(--text3)' }}>Page not found</div>;
}

const PAGE_TITLES: Record<string, [string, string]> = {
  'dashboard': ['Dashboard', 'Overview & key metrics'],
  'leads-fresh': ['Leads — MuktiFresh', 'Sales pipeline'],
  'leads-kitchen': ['Leads — Cloud Kitchen', 'Sales pipeline'],
  'customers-fresh': ['Customers — MuktiFresh', 'Customer database'],
  'customers-kitchen': ['Customers — Cloud Kitchen', 'Customer database'],
  'complaints-fresh': ['Complaints — MuktiFresh', 'Track & resolve'],
  'complaints-kitchen': ['Complaints — Cloud Kitchen', 'Track & resolve'],
  'calls-fresh': ['Call Logs — MuktiFresh', 'All call records'],
  'calls-kitchen': ['Call Logs — Cloud Kitchen', 'All call records'],
  'whatsapp-fresh': ['WhatsApp — MuktiFresh', 'AI message drafts'],
  'whatsapp-kitchen': ['WhatsApp — Cloud Kitchen', 'AI message drafts'],
  'kitchen-orders': ['Live Orders', 'Real-time order board'],
  'market-dashboard': ['Market Dashboard', 'Dispatch & accountability'],
  'market-dispatch': ['Morning Dispatch', 'Load products for market'],
  'market-sales': ['Market Sales Entry', 'Voice & text sales logging'],
  'offline-customers': ['Market Customers', 'Offline customer database'],
  'team': ['Team', 'Manage staff & roles'],
  'reports': ['Reports', 'Analytics & insights'],
};

// ─── App Shell ──────────────────────────────────────────────
export default function AppShell() {
  const { user, logout, isSuperAdmin } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return null;

  const navItems = NAV[user.role as keyof typeof NAV] || [];
  const [title, subtitle] = PAGE_TITLES[page] || [page, ''];

  const bizColor = page.includes('kitchen') ? 'var(--kitchen-500)' : 'var(--fresh-500)';

  const initials = user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  function navTo(id: string) {
    setPage(id);
    setSidebarOpen(false);
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199 }}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: 'var(--sidebar-w)', flexShrink: 0,
        background: 'var(--bg1)', borderRight: '1px solid var(--border)',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 200,
        display: 'flex', flexDirection: 'column',
        transform: sidebarOpen ? 'none' : undefined,
        transition: 'transform 0.3s',
      }} className={sidebarOpen ? 'sidebar open' : 'sidebar'}>

        {/* Logo */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, var(--fresh-500), var(--kitchen-500))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#fff',
            }}>M</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5 }}>Mukti CRM</div>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                {user.role.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
          {navItems.map((item: any, i: number) => {
            if (item.sec) return (
              <div key={i} style={{
                fontSize: 9, fontWeight: 800, color: item.color || 'var(--text3)',
                textTransform: 'uppercase', letterSpacing: '1px',
                padding: '12px 10px 4px',
              }}>{item.sec}</div>
            );
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navTo(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 10px', marginBottom: 1, width: '100%', textAlign: 'left',
                  border: 'none', cursor: 'pointer', borderRadius: 'var(--r)',
                  background: active ? (item.biz === 'kitchen' ? 'var(--kitchen-dim)' : 'var(--fresh-dim)') : 'none',
                  color: active ? (item.biz === 'kitchen' ? 'var(--kitchen-500)' : 'var(--fresh-500)') : 'var(--text2)',
                  fontFamily: 'var(--font)', fontSize: 13, fontWeight: active ? 600 : 500,
                  transition: 'all 0.15s',
                }}
              >
                <Icon name={item.icon} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: user.color || 'var(--fresh-500)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0,
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>{user.role.replace(/_/g, ' ')}</div>
          </div>
          <button
            onClick={logout}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
            title="Logout"
          >
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="main-content" style={{ marginLeft: 'var(--sidebar-w)', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* Topbar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(6,10,16,0.92)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)', padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {/* Mobile menu toggle */}
          <button
            className="desk-only"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ display: 'none', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--text)' }}
          >
            <Icon name="menu" />
          </button>
          <button
            className="mob-only"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--text)' }}
          >
            <Icon name="menu" />
          </button>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {(page.includes('fresh') || page.includes('market') || page.includes('dispatch')) && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--fresh-500)', flexShrink: 0 }} />
              )}
              {page.includes('kitchen') && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--kitchen-500)', flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>{title}</span>
            </div>
            {subtitle && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{subtitle}</div>}
          </div>
        </div>

        {/* Page content */}
        <div style={{ padding: '24px', flex: 1 }}>
          {renderPage(page)}
        </div>
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="mob-only" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 'var(--mob-nav-h)', background: 'var(--bg1)',
        borderTop: '1px solid var(--border)', zIndex: 300,
        justifyContent: 'space-around', alignItems: 'center', padding: '0 8px',
        display: 'none',
      }}>
        {navItems.filter((item: any) => item.id).slice(0, 5).map((item: any) => {
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navTo(item.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '6px 10px', border: 'none', background: 'none', cursor: 'pointer',
                color: active ? (item.biz === 'kitchen' ? 'var(--kitchen-500)' : 'var(--fresh-500)') : 'var(--text3)',
                fontFamily: 'var(--font)', fontSize: 9, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: 0.5, flex: 1, borderRadius: 8,
              }}
            >
              <Icon name={item.icon} size={18} />
              {item.label.split(' ')[0]}
            </button>
          );
        })}
      </nav>

      <Toast />
    </div>
  );
}
