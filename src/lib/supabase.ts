import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Types matching our schema ───────────────────────────────

export type Role =
  | 'super_admin'
  | 'fresh_admin'
  | 'kitchen_admin'
  | 'fresh_staff'
  | 'kitchen_staff'
  | 'market_agent';

export type Business = 'muktifresh' | 'cloud_kitchen' | 'offline_market' | 'all';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  business: Business;
  phone?: string;
  department?: string;
  color?: string;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  flat_no?: string;
  complex_name?: string;
  area?: string;
  city?: string;
  pin_code?: string;
  business: 'muktifresh' | 'cloud_kitchen' | 'both';
  customer_type: string;
  source: string;
  wallet_balance: number;
  due_amount: number;
  total_orders: number;
  total_spent: number;
  avg_rating: number;
  last_purchase?: string;
  last_contact?: string;
  notes?: string;
  tags?: string[];
  assigned_to?: string;
  created_at: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  company?: string;
  address?: string;
  city?: string;
  business: 'muktifresh' | 'cloud_kitchen';
  category?: string;
  product_interest?: string;
  source?: string;
  status: string;
  priority: string;
  score: string;
  deal_value: number;
  followup_date?: string;
  assigned_to?: string;
  call_count: number;
  last_remark?: string;
  is_junk: boolean;
  created_at: string;
}

export interface Market {
  id: string;
  name: string;
  area: string;
  address?: string;
  city?: string;
  pin_code?: string;
  day_of_week?: string[];
  is_active: boolean;
}

export interface Product {
  id: string;
  name: string;
  name_bengali?: string;
  name_hindi?: string;
  category: string;
  unit: string;
  current_stock: number;
  price_per_unit: number;
  market_price: number;
  is_active: boolean;
}

export interface MarketDispatch {
  id: string;
  market_id: string;
  agent_id: string;
  dispatch_date: string;
  dispatched_by: string;
  status: string;
  total_dispatch_value: number;
  total_sold_value: number;
  cash_collected: number;
  discrepancy: number;
  discrepancy_flagged: boolean;
}

export interface OfflineCustomer {
  id: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  flat_no?: string;
  complex_name?: string;
  street_address?: string;
  area?: string;
  pin_code?: string;
  preferred_market_id?: string;
  language_pref: string;
  total_purchases: number;
  last_purchase_date?: string;
}

export interface Complaint {
  id: string;
  customer_name: string;
  phone?: string;
  business: string;
  complaint_type: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  assigned_to?: string;
  created_at: string;
}

// ─── Auth helper ─────────────────────────────────────────────

export async function loginUser(email: string, password: string, role: Role): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .eq('password', password)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  // Role-based access check
  if (role === 'super_admin' && data.role !== 'super_admin') return null;
  if (role !== 'super_admin' && data.role === 'super_admin') return data; // super admin can log in as any
  if (data.role !== role) return null;

  return data as User;
}

// ─── DB helpers ──────────────────────────────────────────────

export async function getUsers(role?: Role) {
  let q = supabase.from('users').select('*').eq('is_active', true).order('name');
  if (role) q = q.eq('role', role);
  const { data } = await q;
  return data || [];
}

export async function getLeads(filters: {
  business?: string;
  status?: string;
  assigned_to?: string;
  search?: string;
  followup?: string;
  limit?: number;
  offset?: number;
}) {
  let q = supabase
    .from('leads')
    .select('*, assigned_user:users!leads_assigned_to_fkey(name,color)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.business) q = q.eq('business', filters.business);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.assigned_to) q = q.eq('assigned_to', filters.assigned_to);
  if (filters.search) {
    q = q.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,company.ilike.%${filters.search}%`);
  }

  const today = new Date().toISOString().slice(0, 10);
  if (filters.followup === 'today') q = q.eq('followup_date', today);
  if (filters.followup === 'overdue') q = q.lt('followup_date', today).not('status', 'in', '("closed","junk")');
  if (filters.followup === 'week') {
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    q = q.gte('followup_date', today).lte('followup_date', weekEnd);
  }

  q = q.range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50) - 1);
  return await q;
}

export async function getCustomers(filters: {
  business?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  let q = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.business) q = q.eq('business', filters.business);
  if (filters.search) {
    q = q.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,area.ilike.%${filters.search}%`);
  }

  q = q.range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50) - 1);
  return await q;
}
