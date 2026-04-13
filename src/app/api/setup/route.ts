import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET() {
  const sql = neon(process.env.DATABASE_URL!);
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    await sql`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      business TEXT,
      phone TEXT,
      department TEXT,
      color TEXT DEFAULT '#22c55e',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`INSERT INTO users (name, email, password, role, business, color)
      VALUES ('Super Admin', 'admin@muktifresh.com', 'mukti@2024', 'super_admin', 'all', '#a855f7')
      ON CONFLICT (email) DO NOTHING`;
    return NextResponse.json({ success: true, message: 'Users table created and admin seeded!' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
