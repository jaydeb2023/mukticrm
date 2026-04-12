'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role } from './supabase';

interface AuthCtx {
  user: User | null;
  setUser: (u: User | null) => void;
  logout: () => void;
  isSuperAdmin: boolean;
  isFreshAdmin: boolean;
  isKitchenAdmin: boolean;
  isMarketAgent: boolean;
  isAnyAdmin: boolean;
  canSeeFresh: boolean;
  canSeeKitchen: boolean;
  canSeeMarket: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('mukti_user');
    if (stored) {
      try { setUserState(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  const setUser = (u: User | null) => {
    setUserState(u);
    if (u) localStorage.setItem('mukti_user', JSON.stringify(u));
    else localStorage.removeItem('mukti_user');
  };

  const logout = () => setUser(null);

  const role = user?.role as Role | undefined;
  const isSuperAdmin = role === 'super_admin';
  const isFreshAdmin = role === 'fresh_admin';
  const isKitchenAdmin = role === 'kitchen_admin';
  const isMarketAgent = role === 'market_agent';
  const isAnyAdmin = isSuperAdmin || isFreshAdmin || isKitchenAdmin;
  const canSeeFresh = isSuperAdmin || isFreshAdmin || role === 'fresh_staff';
  const canSeeKitchen = isSuperAdmin || isKitchenAdmin || role === 'kitchen_staff';
  const canSeeMarket = isSuperAdmin || isMarketAgent || isFreshAdmin;

  return (
    <Ctx.Provider value={{ user, setUser, logout, isSuperAdmin, isFreshAdmin, isKitchenAdmin, isMarketAgent, isAnyAdmin, canSeeFresh, canSeeKitchen, canSeeMarket }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
