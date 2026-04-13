export * from './api';

export type Role = 'super_admin' | 'fresh_admin' | 'kitchen_admin' | 'fresh_staff' | 'kitchen_staff' | 'market_agent';
export type Business = 'muktifresh' | 'cloud_kitchen' | 'offline_market' | 'all';

export interface User {
  id: string; name: string; email: string; role: Role; business: Business;
  phone?: string; department?: string; color?: string; is_active: boolean; created_at: string;
}
export interface Market { id: string; name: string; area: string; is_active: boolean; }
export interface Product { id: string; name: string; name_bengali?: string; name_hindi?: string; category: string; unit: string; current_stock: number; price_per_unit: number; market_price: number; is_active: boolean; }

export const supabase = {
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
  removeChannel: () => {},
  from: () => ({ select: () => Promise.resolve({ data: [], count: 0 }) }),
} as any;
