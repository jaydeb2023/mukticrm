import { Pool } from "pg";

// If you’re using Prisma, this will be replaced with PrismaClient below.

// ─── Neon Postgres pool (raw pg) ─────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Neon connection string
});

export async function query(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res;
}

// ─── Types (same as before) ───────────────────────────────────

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

// ─── Auth helper (Neon example) ──────────────────────────────

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

// ─── DB helpers (Neon / raw SQL) ─────────────────────────────

export async function getUsers(role?: Role): Promise<User[]> {
  let sql = `SELECT * FROM users WHERE is_active = true ORDER BY name`;
  const params: any[] = [];

  if (role) {
    sql = `SELECT * FROM users WHERE is_active = true AND role = $1 ORDER BY name`;
    params.push(role);
  }

  const res = await query(sql, params);
  return res.rows as User[];
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
  let sql = `
    SELECT
      l.*,
      u.name as "assigned_user.name",
      u.color as "assigned_user.color"
    FROM leads l
    LEFT JOIN users u ON l.assigned_to = u.id
  `;

  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.business) {
    conditions.push(`l.business = $${params.length + 1}`);
    params.push(filters.business);
  }
  if (filters.status) {
    conditions.push(`l.status = $${params.length + 1}`);
    params.push(filters.status);
  }
  if (filters.assigned_to) {
    conditions.push(`l.assigned_to = $${params.length + 1}`);
    params.push(filters.assigned_to);
  }
  if (filters.search) {
    conditions.push(
      `(
        l.name ILIKE '%' || $${params.length + 1} || '%'
        OR l.phone ILIKE '%' || $${params.length + 1} || '%'
        OR l.company ILIKE '%' || $${params.length + 1} || '%'
      )`
    );
    params.push(filters.search);
  }

  const today = new Date().toISOString().slice(0, 10);
  if (filters.followup === "today") {
    conditions.push(`l.followup_date = $${params.length + 1}`);
    params.push(today);
  }
  if (filters.followup === "overdue") {
    conditions.push(
      `l.followup_date < $${params.length + 1}
       AND l.status NOT IN ('closed', 'junk')`
    );
    params.push(today);
  }
  if (filters.followup === "week") {
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    conditions.push(
      `l.followup_date >= $${params.length + 1}
       AND l.followup_date <= $${params.length + 2}`
    );
    params.push(today);
    params.push(weekEnd);
  }

  sql +=
    conditions.length > 0
      ? ` WHERE ${conditions.join(" AND ")}`
      : "";

  sql += ` ORDER BY l.created_at DESC`;

  const offset = filters.offset || 0;
  const limit = filters.limit || 50;
  sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit);
  params.push(offset);

  const res = await query(sql, params);

  // Simple count query (you can optimize later)
  const count = await query(
    `SELECT COUNT(*)::int as count FROM leads` +
      (conditions.length > 0
        ? ` WHERE ${conditions.join(" AND ")}`
        : ""),
    params.slice(0, params.length - 2)
  );

  return {
    data: res.rows,
    count: count.rows[0].count,
  };
}

export async function getCustomers(filters: {
  business?: string;
  search?: string;
  limit?: number;
  offset?: number;
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
      `(
        name ILIKE '%' || $${params.length + 1} || '%'
        OR phone ILIKE '%' || $${params.length + 1} || '%'
        OR area ILIKE '%' || $${params.length + 1} || '%'
      )`
    );
    params.push(filters.search);
  }

  sql +=
    conditions.length > 0
      ? ` WHERE ${conditions.join(" AND ")}`
      : "";

  sql += ` ORDER BY created_at DESC`;

  const offset = filters.offset || 0;
  const limit = filters.limit || 50;
  sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit);
  params.push(offset);

  const res = await query(sql, params);

  const count = await query(
    `SELECT COUNT(*)::int as count FROM customers` +
      (conditions.length > 0
        ? ` WHERE ${conditions.join(" AND ")}`
        : ""),
    params.slice(0, params.length - 2)
  );

  return {
    data: res.rows,
    count: count.rows[0].count,
  };
}
