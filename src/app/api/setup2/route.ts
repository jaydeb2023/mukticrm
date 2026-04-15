import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET() {
  const sql = neon(process.env.DATABASE_URL!);
  try {
    await sql`CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      phone TEXT,
      whatsapp TEXT,
      email TEXT,
      company TEXT,
      address TEXT,
      city TEXT,
      business TEXT NOT NULL,
      category TEXT,
      product_interest TEXT,
      source TEXT DEFAULT 'manual',
      status TEXT DEFAULT 'new',
      priority TEXT DEFAULT 'medium',
      score TEXT DEFAULT 'warm',
      deal_value NUMERIC DEFAULT 0,
      followup_date DATE,
      assigned_to UUID,
      created_by UUID,
      call_count INT DEFAULT 0,
      last_remark TEXT,
      is_junk BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
      business TEXT NOT NULL,
      customer_type TEXT DEFAULT 'new',
      source TEXT DEFAULT 'manual',
      wallet_balance NUMERIC DEFAULT 0,
      due_amount NUMERIC DEFAULT 0,
      total_orders INT DEFAULT 0,
      total_spent NUMERIC DEFAULT 0,
      avg_rating NUMERIC DEFAULT 0,
      last_purchase DATE,
      last_contact DATE,
      notes TEXT,
      assigned_to UUID,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS complaints (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_name TEXT NOT NULL,
      phone TEXT,
      business TEXT NOT NULL,
      complaint_type TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'medium',
      assigned_to UUID,
      created_by UUID,
      resolved_by UUID,
      resolution_note TEXT,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS call_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID,
      customer_id UUID,
      emp_id UUID NOT NULL,
      business TEXT NOT NULL,
      call_status TEXT NOT NULL,
      duration_mins INT DEFAULT 0,
      remark TEXT,
      followup_date DATE,
      new_status TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS kitchen_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_no TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      items JSONB DEFAULT '[]',
      total_amount NUMERIC NOT NULL,
      payment_mode TEXT DEFAULT 'cash',
      payment_status TEXT DEFAULT 'pending',
      order_status TEXT DEFAULT 'new',
      special_instructions TEXT,
      rating INT,
      review TEXT,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS markets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      area TEXT NOT NULL,
      address TEXT,
      city TEXT DEFAULT 'Kolkata',
      pin_code TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      name_bengali TEXT,
      name_hindi TEXT,
      category TEXT NOT NULL,
      unit TEXT DEFAULT 'kg',
      current_stock NUMERIC DEFAULT 0,
      price_per_unit NUMERIC DEFAULT 0,
      market_price NUMERIC DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS market_dispatches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      market_id UUID,
      agent_id UUID NOT NULL,
      dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
      dispatched_by UUID NOT NULL,
      status TEXT DEFAULT 'dispatched',
      total_dispatch_value NUMERIC DEFAULT 0,
      total_sold_value NUMERIC DEFAULT 0,
      total_returned_value NUMERIC DEFAULT 0,
      cash_collected NUMERIC DEFAULT 0,
      discrepancy NUMERIC DEFAULT 0,
      discrepancy_flagged BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS dispatch_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dispatch_id UUID NOT NULL,
      product_id UUID NOT NULL,
      product_name TEXT NOT NULL,
      unit TEXT NOT NULL,
      dispatched_qty NUMERIC DEFAULT 0,
      sold_qty NUMERIC DEFAULT 0,
      returned_qty NUMERIC DEFAULT 0,
      price_per_unit NUMERIC NOT NULL,
      total_sold_amount NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS market_sales (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dispatch_id UUID,
      agent_id UUID NOT NULL,
      market_id UUID NOT NULL,
      product_id UUID NOT NULL,
      product_name TEXT NOT NULL,
      qty_sold NUMERIC NOT NULL,
      unit TEXT NOT NULL,
      price_per_unit NUMERIC NOT NULL,
      total_amount NUMERIC NOT NULL,
      sale_date DATE DEFAULT CURRENT_DATE,
      entry_method TEXT DEFAULT 'manual',
      voice_transcript TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS offline_customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      phone TEXT,
      whatsapp TEXT,
      flat_no TEXT,
      floor_no TEXT,
      complex_name TEXT,
      street_address TEXT,
      area TEXT,
      landmark TEXT,
      city TEXT DEFAULT 'Kolkata',
      pin_code TEXT,
      preferred_market_id UUID,
      language_pref TEXT DEFAULT 'bengali',
      notes TEXT,
      total_purchases INT DEFAULT 0,
      last_purchase_date DATE,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS whatsapp_drafts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID,
      business TEXT NOT NULL,
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      message_type TEXT DEFAULT 'manual',
      language TEXT DEFAULT 'english',
      sent_by UUID,
      is_sent BOOLEAN DEFAULT false,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    -- Sample markets
    await sql`INSERT INTO markets (name, area, address) VALUES
      ('Sector 5 Market', 'Salt Lake Sector 5', 'Sector 5, Salt Lake, Kolkata'),
      ('Lake Town Market', 'Lake Town', 'Lake Town, Kolkata'),
      ('New Town Market', 'New Town', 'Action Area 1, New Town, Kolkata')
      ON CONFLICT DO NOTHING`;

    -- Sample products
    await sql`INSERT INTO products (name, name_bengali, name_hindi, category, unit, current_stock, price_per_unit, market_price) VALUES
      ('Tomato', 'টমেটো', 'टमाटर', 'vegetable', 'kg', 50, 20, 25),
      ('Potato', 'আলু', 'आलू', 'vegetable', 'kg', 100, 15, 18),
      ('Hilsa Fish', 'ইলিশ মাছ', 'हिल्सा', 'fish', 'kg', 20, 600, 700),
      ('Chicken', 'মুরগি', 'मुर्गी', 'non_veg', 'kg', 40, 200, 230)
      ON CONFLICT DO NOTHING`;

    return NextResponse.json({ success: true, message: 'All 12 tables created successfully!' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
