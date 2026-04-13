import { Pool } from "pg";

// Neon Postgres pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res;
}

// ─── Types (keep same as before) ─────────────────────────────────────

export type Role =
  | "super_admin"
  | "fresh_admin"
  | "kitchen_admin"
  | "fresh_staff"
  | "kitchen_staff"
  | "market_agent";

export type Business = "muktifresh" | "cloud_kitchen" | "offline_market" | "all";

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
  business: "muktifresh" | "cloud_kitchen" | "both";
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
  business: "muktifresh" | "cloud_kitchen";
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

// ─── Auth helper (Neon) ─────────────────────────────────────────────

export async function loginUser(
  email: string,
  password: string,
  role: Role
): Promise<User | null> {
  const sql = `
    SELECT * FROM users
    WHERE email = $1
      AND password = $2
      AND is_active = true
  `;

  const res = await query(sql, [email.toLowerCase().trim(), password]);
  const user = res.rows[0];

  if (!user) return null;

  // Role-based access check (same logic)
  if (role === "super_admin" && user.role !== "super_admin") return null;
  if (role !== "super_admin" && user.role === "super_admin") return user;
  if (user.role !== role) return null;

  return user as User;
}

// ─── Example helpers you can expand later ───────────────────────────

export async function getLeads(filters: {
  business?: string;
  status?: string;
  assigned_to?: string;
  search?: string;
}) {
  let sql = `SELECT * FROM leads`;
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.business) {
    conditions.push(`business = $${params.length + 1}`);
    params.push(filters.business);
  }
  if (filters.status) {
    conditions.push(`status = $${params.length + 1}`);
    params.push(filters.status);
  }
  if (filters.assigned_to) {
    conditions.push(`assigned_to = $${params.length + 1}`);
    params.push(filters.assigned_to);
  }
  if (filters.search) {
    conditions.push(
      `(name ILIKE '%' || $${params.length + 1} || '%'
       OR phone ILIKE '%' || $${params.length + 1} || '%')`
    );
    params.push(filters.search);
  }

  sql +=
    conditions.length > 0
      ? ` WHERE ${conditions.join(" AND ")}`
      : "";

  sql += ` ORDER BY created_at DESC`;

  const res = await query(sql, params);

  return {
    data: res.rows,
  };
}

export async function getCustomers(filters: {
  business?: string;
  search?: string;
}) {
  let sql = `SELECT * FROM customers`;
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.business) {
    conditions.push(`business = $${params.length + 1}`);
    params.push(filters.business);
  }
  if (filters.search) {
    conditions.push(
      `(name ILIKE '%' || $${params.length + 1} || '%'
       OR phone ILIKE '%' || $${params.length + 1} || '%')`
    );
    params.push(filters.search);
  }

  sql +=
    conditions.length > 0
      ? ` WHERE ${conditions.join(" AND ")}`
      : "";

  sql += ` ORDER BY created_at DESC`;

  const res = await query(sql, params);

  return {
    data: res.rows,
  };
}
