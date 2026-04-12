'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { loginUser, Role } from '@/lib/supabase';

const ROLES: { value: Role; label: string; color: string; desc: string }[] = [
  { value: 'super_admin',    label: 'Super Admin',     color: '#a855f7', desc: 'Full access — both businesses' },
  { value: 'fresh_admin',    label: 'Fresh Admin',     color: '#22c55e', desc: 'MuktiFresh management' },
  { value: 'kitchen_admin',  label: 'Kitchen Admin',   color: '#f97316', desc: 'Cloud Kitchen management' },
  { value: 'fresh_staff',    label: 'Fresh Staff',     color: '#4ade80', desc: 'Sales & customer calls' },
  { value: 'kitchen_staff',  label: 'Kitchen Staff',   color: '#fb923c', desc: 'Order handling' },
  { value: 'market_agent',   label: 'Market Agent',    color: '#06b6d4', desc: 'Offline market sales' },
];

export default function LoginPage() {
  const { setUser } = useAuth();
  const [role, setRole] = useState<Role>('super_admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selected = ROLES.find(r => r.value === role)!;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError('Enter email and password'); return; }
    setLoading(true); setError('');
    try {
      const user = await loginUser(email, password, role);
      if (!user) { setError('Invalid credentials or role mismatch'); setLoading(false); return; }
      setUser(user);
    } catch (err) {
      setError('Connection error. Check your Supabase config.');
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 20% 50%, rgba(34,197,94,0.06), transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(249,115,22,0.06), transparent 50%), var(--bg0)',
      padding: '20px',
    }}>
      <div style={{
        width: '460px', maxWidth: '100%',
        background: 'var(--bg1)', border: '1px solid var(--border)',
        borderRadius: '24px', padding: '40px 36px',
        boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
      }}>

        {/* Logo */}
        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--fresh-500)', fontFamily: 'var(--font)' }}>Mukti</span>
            <span style={{
              background: 'linear-gradient(135deg, var(--fresh-500), var(--kitchen-500))',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              fontSize: '28px', fontWeight: 800,
            }}>CRM</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: 500 }}>
            MuktiFresh · Cloud Kitchen · Offline Markets
          </div>
        </div>

        {/* Role selector */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
            Login as
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {ROLES.map(r => (
              <button
                key={r.value}
                onClick={() => setRole(r.value)}
                style={{
                  padding: '9px 10px',
                  borderRadius: '10px',
                  border: `1px solid ${role === r.value ? r.color : 'var(--border)'}`,
                  background: role === r.value ? `${r.color}18` : 'var(--bg2)',
                  color: role === r.value ? r.color : 'var(--text2)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  fontSize: '12px',
                  fontWeight: 600,
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '2px' }}>{r.label}</div>
                <div style={{ fontSize: '10px', opacity: 0.75 }}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '5px' }}>
              Email
            </div>
            <input
              className="inp"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '5px' }}>
              Password
            </div>
            <input
              className="inp"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{
              marginBottom: '14px', padding: '10px 14px',
              background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--r)', fontSize: '13px', color: 'var(--red)',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '13px',
              background: `linear-gradient(135deg, ${selected.color}, ${selected.color}dd)`,
              color: '#fff', border: 'none', borderRadius: 'var(--r)',
              fontFamily: 'var(--font)', fontSize: '14px', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.8 : 1,
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {loading ? (
              <><span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Signing in…</>
            ) : (
              `Sign in as ${selected.label} →`
            )}
          </button>
        </form>

        <div style={{ marginTop: '20px', padding: '12px 14px', background: 'var(--bg2)', borderRadius: 'var(--r)', fontSize: '11.5px', color: 'var(--text3)' }}>
          <strong style={{ color: 'var(--text2)' }}>First login:</strong> admin@muktifresh.com / mukti@2024
        </div>
      </div>
    </div>
  );
}
