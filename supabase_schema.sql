-- ============================================================
-- MUKTI CRM — COMPLETE SUPABASE SCHEMA
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS TABLE (all roles)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin','fresh_admin','kitchen_admin','fresh_staff','kitchen_staff','market_agent')),
  business TEXT CHECK (business IN ('muktifresh','cloud_kitchen','offline_market','all')),
  phone TEXT,
  department TEXT,
  color TEXT DEFAULT '#22c55e',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed a super admin (change password after first login)
INSERT INTO users (name, email, password, role, business, color)
VALUES ('Super Admin', 'admin@muktifresh.com', 'mukti@2024', 'super_admin', 'all', '#a855f7')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- 2. CUSTOMERS TABLE (shared across both online businesses)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  flat_no TEXT,
  complex_name TEXT,
  area TEXT,
  city TEXT DEFAULT 'Kolkata',
  pin_code TEXT,
  business TEXT NOT NULL CHECK (business IN ('muktifresh','cloud_kitchen','both')),
  customer_type TEXT DEFAULT 'regular' CHECK (customer_type IN ('new','regular','loyal','at_risk','inactive')),
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual','excel_upload','ai_paste','whatsapp','reference','website','other')),
  wallet_balance NUMERIC DEFAULT 0,
  due_amount NUMERIC DEFAULT 0,
  total_orders INT DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  avg_rating NUMERIC DEFAULT 0,
  last_purchase DATE,
  last_contact DATE,
  notes TEXT,
  tags TEXT[],
  assigned_to UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. LEADS TABLE (marketing CRM pipeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  company TEXT,
  address TEXT,
  city TEXT,
  business TEXT NOT NULL CHECK (business IN ('muktifresh','cloud_kitchen')),
  category TEXT,
  product_interest TEXT,
  source TEXT DEFAULT 'unknown',
  status TEXT DEFAULT 'new' CHECK (status IN ('new','called','interested','callback','notinterested','closed','junk')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  score TEXT DEFAULT 'warm' CHECK (score IN ('hot','warm','cold')),
  deal_value NUMERIC DEFAULT 0,
  followup_date DATE,
  assigned_to UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  call_count INT DEFAULT 0,
  last_remark TEXT,
  is_junk BOOLEAN DEFAULT false,
  converted_to_customer BOOLEAN DEFAULT false,
  customer_id UUID REFERENCES customers(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. CALL LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  emp_id UUID NOT NULL REFERENCES users(id),
  business TEXT NOT NULL,
  call_status TEXT NOT NULL CHECK (call_status IN ('made','missed','no_answer','busy','callback_scheduled')),
  duration_mins INT DEFAULT 0,
  remark TEXT,
  followup_date DATE,
  new_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. COMPLAINTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  lead_id UUID REFERENCES leads(id),
  customer_name TEXT NOT NULL,
  phone TEXT,
  business TEXT NOT NULL CHECK (business IN ('muktifresh','cloud_kitchen')),
  complaint_type TEXT NOT NULL CHECK (complaint_type IN ('product_quality','delivery_delay','wrong_order','payment_issue','staff_behavior','app_issue','other')),
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed','escalated')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high','medium','low','urgent')),
  assigned_to UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  resolved_by UUID REFERENCES users(id),
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. COMPLAINT ACTIVITY LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS complaint_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. WHATSAPP DRAFTS / MESSAGE LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  lead_id UUID REFERENCES leads(id),
  offline_customer_id UUID,
  business TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'manual' CHECK (message_type IN ('manual','ai_generated','reengagement','market_blast','complaint_followup')),
  language TEXT DEFAULT 'english' CHECK (language IN ('english','bengali','hindi','hinglish')),
  sent_by UUID REFERENCES users(id),
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. MARKETS TABLE (offline market locations)
-- ============================================================
CREATE TABLE IF NOT EXISTS markets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  address TEXT,
  city TEXT DEFAULT 'Kolkata',
  pin_code TEXT,
  day_of_week TEXT[], -- ['monday','wednesday','friday']
  assigned_agents UUID[],
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. PRODUCTS TABLE (warehouse inventory)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_bengali TEXT,
  name_hindi TEXT,
  category TEXT NOT NULL CHECK (category IN ('vegetable','fruit','non_veg','fish','meat','dairy','other')),
  unit TEXT DEFAULT 'kg' CHECK (unit IN ('kg','gram','piece','dozen','litre','bundle')),
  current_stock NUMERIC DEFAULT 0,
  min_stock NUMERIC DEFAULT 0,
  price_per_unit NUMERIC DEFAULT 0,
  market_price NUMERIC DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. MARKET DISPATCH (morning — warehouse to agent)
-- ============================================================
CREATE TABLE IF NOT EXISTS market_dispatches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_id UUID NOT NULL REFERENCES markets(id),
  agent_id UUID NOT NULL REFERENCES users(id),
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  dispatched_by UUID NOT NULL REFERENCES users(id),
  status TEXT DEFAULT 'dispatched' CHECK (status IN ('dispatched','in_progress','returned','settled')),
  total_dispatch_value NUMERIC DEFAULT 0,
  total_sold_value NUMERIC DEFAULT 0,
  total_returned_value NUMERIC DEFAULT 0,
  cash_collected NUMERIC DEFAULT 0,
  discrepancy NUMERIC DEFAULT 0,
  discrepancy_flagged BOOLEAN DEFAULT false,
  agent_notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. DISPATCH ITEMS (product-level detail per dispatch)
-- ============================================================
CREATE TABLE IF NOT EXISTS dispatch_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispatch_id UUID NOT NULL REFERENCES market_dispatches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  dispatched_qty NUMERIC NOT NULL DEFAULT 0,
  sold_qty NUMERIC DEFAULT 0,
  returned_qty NUMERIC DEFAULT 0,
  price_per_unit NUMERIC NOT NULL,
  total_sold_amount NUMERIC DEFAULT 0,
  discrepancy_qty NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. MARKET SALES ENTRIES (agent enters sales during day)
-- ============================================================
CREATE TABLE IF NOT EXISTS market_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispatch_id UUID NOT NULL REFERENCES market_dispatches(id) ON DELETE CASCADE,
  dispatch_item_id UUID REFERENCES dispatch_items(id),
  agent_id UUID NOT NULL REFERENCES users(id),
  market_id UUID NOT NULL REFERENCES markets(id),
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  qty_sold NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  sale_date DATE DEFAULT CURRENT_DATE,
  entry_method TEXT DEFAULT 'manual' CHECK (entry_method IN ('manual','voice','photo')),
  voice_transcript TEXT,
  offline_customer_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. OFFLINE CUSTOMERS (market-level customer database)
-- ============================================================
CREATE TABLE IF NOT EXISTS offline_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  flat_no TEXT,
  floor_no TEXT,
  complex_name TEXT,
  building_name TEXT,
  street_address TEXT,
  area TEXT,
  landmark TEXT,
  city TEXT DEFAULT 'Kolkata',
  pin_code TEXT,
  preferred_market_id UUID REFERENCES markets(id),
  regular_products TEXT[],
  notes TEXT,
  language_pref TEXT DEFAULT 'bengali' CHECK (language_pref IN ('bengali','hindi','english','hinglish')),
  total_purchases INT DEFAULT 0,
  last_purchase_date DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 14. OFFLINE CUSTOMER PURCHASES
-- ============================================================
CREATE TABLE IF NOT EXISTS offline_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offline_customer_id UUID NOT NULL REFERENCES offline_customers(id),
  market_id UUID NOT NULL REFERENCES markets(id),
  agent_id UUID NOT NULL REFERENCES users(id),
  dispatch_id UUID REFERENCES market_dispatches(id),
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  purchase_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. MARKET BLAST MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS market_blasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_id UUID NOT NULL REFERENCES markets(id),
  blast_date DATE NOT NULL,
  message_english TEXT,
  message_bengali TEXT,
  message_hindi TEXT,
  products_available TEXT[],
  created_by UUID REFERENCES users(id),
  total_customers_targeted INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 16. KITCHEN ORDERS (cloud kitchen live board)
-- ============================================================
CREATE TABLE IF NOT EXISTS kitchen_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_no TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  total_amount NUMERIC NOT NULL,
  payment_mode TEXT DEFAULT 'cash' CHECK (payment_mode IN ('cash','upi','card','wallet','online')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','refunded')),
  order_status TEXT DEFAULT 'new' CHECK (order_status IN ('new','confirmed','preparing','ready','out_for_delivery','delivered','cancelled')),
  delivery_agent_id UUID REFERENCES users(id),
  special_instructions TEXT,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  estimated_delivery TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 17. MENU ITEMS (cloud kitchen)
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price NUMERIC NOT NULL,
  is_available BOOLEAN DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_business ON leads(business);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_followup ON leads(followup_date);
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_call_logs_emp ON call_logs(emp_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created ON call_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_business ON complaints(business);
CREATE INDEX IF NOT EXISTS idx_market_dispatches_date ON market_dispatches(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_market_dispatches_agent ON market_dispatches(agent_id);
CREATE INDEX IF NOT EXISTS idx_market_sales_dispatch ON market_sales(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_offline_customers_market ON offline_customers(preferred_market_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_orders_status ON kitchen_orders(order_status);

-- ============================================================
-- SAMPLE DATA
-- ============================================================

-- Sample markets
INSERT INTO markets (name, area, address, day_of_week) VALUES
('Sector 5 Market', 'Salt Lake Sector 5', 'Sector 5, Salt Lake, Kolkata', ARRAY['monday','wednesday','friday']),
('Lake Town Market', 'Lake Town', 'Lake Town, Kolkata', ARRAY['tuesday','thursday','saturday']),
('New Town Market', 'New Town', 'Action Area 1, New Town, Kolkata', ARRAY['wednesday','saturday','sunday'])
ON CONFLICT DO NOTHING;

-- Sample products
INSERT INTO products (name, name_bengali, name_hindi, category, unit, current_stock, price_per_unit, market_price) VALUES
('Tomato', 'টমেটো', 'टमाटर', 'vegetable', 'kg', 50, 20, 25),
('Potato', 'আলু', 'आलू', 'vegetable', 'kg', 100, 15, 18),
('Onion', 'পেঁয়াজ', 'प्याज', 'vegetable', 'kg', 80, 30, 35),
('Hilsa Fish', 'ইলিশ মাছ', 'हिल्सा मछली', 'fish', 'kg', 20, 600, 700),
('Rohu Fish', 'রুই মাছ', 'रोहू मछली', 'fish', 'kg', 30, 180, 200),
('Chicken', 'মুরগি', 'मुर्गी', 'non_veg', 'kg', 40, 200, 230),
('Spinach', 'পালং শাক', 'पालक', 'vegetable', 'bundle', 60, 10, 15),
('Banana', 'কলা', 'केला', 'fruit', 'dozen', 30, 40, 50)
ON CONFLICT DO NOTHING;

-- ============================================================
-- ENABLE REALTIME (run these in Supabase dashboard under
-- Database > Replication > enable for tables below)
-- ============================================================
-- kitchen_orders
-- market_dispatches
-- market_sales
-- complaints
-- call_logs

COMMENT ON TABLE users IS 'All CRM users — admins, staff, market agents';
COMMENT ON TABLE customers IS 'Online customers for MuktiFresh and Cloud Kitchen';
COMMENT ON TABLE leads IS 'Sales/marketing leads pipeline';
COMMENT ON TABLE call_logs IS 'All call records linked to leads or customers';
COMMENT ON TABLE complaints IS 'Customer complaints for both businesses';
COMMENT ON TABLE market_dispatches IS 'Morning dispatch records from warehouse to market agents';
COMMENT ON TABLE dispatch_items IS 'Product-level breakdown per dispatch';
COMMENT ON TABLE market_sales IS 'Individual sales entries by agents during market hours';
COMMENT ON TABLE offline_customers IS 'Customers at offline markets with full address details';
COMMENT ON TABLE offline_purchases IS 'Purchase history of offline customers';
COMMENT ON TABLE markets IS 'Physical market locations where offline sales happen';
COMMENT ON TABLE products IS 'Product catalog with trilingual names';
COMMENT ON TABLE market_blasts IS 'Daily WhatsApp blast messages for market customers';
COMMENT ON TABLE kitchen_orders IS 'Cloud kitchen live order board';
COMMENT ON TABLE whatsapp_drafts IS 'AI-generated and manual WhatsApp message drafts';
