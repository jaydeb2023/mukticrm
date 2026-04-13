import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

function db() {
  return neon(process.env.DATABASE_URL!);
}

export async function POST(req: NextRequest) {
  const { action, params } = await req.json();
  const sql = db();

  try {
    switch (action) {

      case 'login': {
        const rows = await sql`
          SELECT * FROM users
          WHERE email = ${params.email.toLowerCase().trim()}
          AND password = ${params.password}
          AND is_active = true
          LIMIT 1
        `;
        if (!rows.length) return NextResponse.json({ data: null });
        const user = rows[0];
        if (params.role !== 'super_admin' && user.role !== params.role && user.role !== 'super_admin') {
          return NextResponse.json({ data: null });
        }
        return NextResponse.json({ data: user });
      }

      case 'getDashboardStats': {
        const today = new Date().toISOString().slice(0, 10);
        const weekAgo = new Date(Date.now() - 7*86400000).toISOString().slice(0, 10);
        return NextResponse.json({ data: {
          freshLeads: 0, freshInterested: 0, freshDueToday: 0,
          freshOverdue: 0, freshComplaints: 0, freshCustomers: 0,
          kitchenActive: 0, kitchenLeads: 0, kitchenComplaints: 0,
          todayDispatches: 0, flaggedDispatches: 0, todaySalesTotal: 0,
          recentCalls: [],
        }});
      }

      case 'getLeads': {
        const { business, status, search, limit = 50, offset = 0, isAdmin, userId } = params;
        let rows;
        if (search) {
          rows = await sql`
            SELECT l.*, u.name as assignee_name, u.color as assignee_color
            FROM leads l LEFT JOIN users u ON l.assigned_to = u.id
            WHERE l.business = ${business} AND l.is_junk = false
            AND (l.name ILIKE ${'%'+search+'%'} OR l.phone ILIKE ${'%'+search+'%'})
            ORDER BY l.created_at DESC LIMIT ${limit} OFFSET ${offset}
          `;
        } else {
          rows = await sql`
            SELECT l.*, u.name as assignee_name, u.color as assignee_color
            FROM leads l LEFT JOIN users u ON l.assigned_to = u.id
            WHERE l.business = ${business} AND l.is_junk = false
            ORDER BY l.created_at DESC LIMIT ${limit} OFFSET ${offset}
          `;
        }
        const countRows = await sql`SELECT COUNT(*) FROM leads WHERE business = ${business} AND is_junk = false`;
        return NextResponse.json({ data: rows, count: parseInt(countRows[0].count) });
      }

      case 'createLead': {
        const p = params;
        const rows = await sql`
          INSERT INTO leads (name, phone, email, company, address, city, business, source, status, priority, created_by)
          VALUES (${p.name}, ${p.phone||null}, ${p.email||null}, ${p.company||null},
            ${p.address||null}, ${p.city||null}, ${p.business},
            ${p.source||'manual'}, ${p.status||'new'}, ${p.priority||'medium'}, ${p.created_by||null})
          RETURNING *
        `;
        return NextResponse.json({ data: rows[0] });
      }

      case 'bulkCreateLeads': {
        const results = [];
        for (const p of (params.leads || [])) {
          try {
            const rows = await sql`
              INSERT INTO leads (name, phone, email, business, source, status, created_by)
              VALUES (${p.name||'Unknown'}, ${p.phone||null}, ${p.email||null},
                ${params.business}, 'ai_paste', 'new', ${params.created_by||null})
              RETURNING id
            `;
            results.push(rows[0]);
          } catch {}
        }
        return NextResponse.json({ data: results, count: results.length });
      }

      case 'updateLead': {
        await sql`
          UPDATE leads SET
            status = COALESCE(${params.status||null}, status),
            last_remark = COALESCE(${params.last_remark||null}, last_remark),
            followup_date = COALESCE(${params.followup_date||null}, followup_date),
            updated_at = NOW()
          WHERE id = ${params.id}
        `;
        return NextResponse.json({ data: { success: true } });
      }

      case 'getCustomers': {
        const { business, search, limit = 50, offset = 0 } = params;
        let rows;
        if (search) {
          rows = await sql`
            SELECT * FROM customers
            WHERE (business = ${business} OR business = 'both')
            AND (name ILIKE ${'%'+search+'%'} OR phone ILIKE ${'%'+search+'%'})
            ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
          `;
        } else {
          rows = await sql`
            SELECT * FROM customers WHERE (business = ${business} OR business = 'both')
            ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
          `;
        }
        const countRows = await sql`SELECT COUNT(*) FROM customers WHERE business = ${business} OR business = 'both'`;
        return NextResponse.json({ data: rows, count: parseInt(countRows[0].count) });
      }

      case 'createCustomer': {
        const p = params;
        const rows = await sql`
          INSERT INTO customers (name, phone, whatsapp, email, address, flat_no, complex_name, area, city, pin_code, business, source, created_by, customer_type)
          VALUES (${p.name}, ${p.phone||null}, ${p.whatsapp||null}, ${p.email||null},
            ${p.address||null}, ${p.flat_no||null}, ${p.complex_name||null},
            ${p.area||null}, ${p.city||'Kolkata'}, ${p.pin_code||null},
            ${p.business}, ${p.source||'manual'}, ${p.created_by||null}, 'new')
          RETURNING *
        `;
        return NextResponse.json({ data: rows[0] });
      }

      case 'updateCustomer': {
        const p = params;
        await sql`
          UPDATE customers SET name=${p.name}, phone=${p.phone||null},
            area=${p.area||null}, city=${p.city||'Kolkata'}, updated_at=NOW()
          WHERE id = ${p.id}
        `;
        return NextResponse.json({ data: { success: true } });
      }

      case 'bulkCreateCustomers': {
        const results = [];
        for (const p of (params.customers || [])) {
          try {
            const rows = await sql`
              INSERT INTO customers (name, phone, area, city, business, source, created_by, customer_type)
              VALUES (${p.name||'Unknown'}, ${p.phone||null}, ${p.area||null},
                ${p.city||'Kolkata'}, ${params.business}, 'excel_upload', ${params.created_by||null}, 'new')
              RETURNING id
            `;
            results.push(rows[0]);
          } catch {}
        }
        return NextResponse.json({ data: results, count: results.length });
      }

      case 'getComplaints': {
        const { business, status, search, limit = 100 } = params;
        const rows = search
          ? await sql`SELECT c.*, u.name as assignee_name FROM complaints c LEFT JOIN users u ON c.assigned_to = u.id WHERE c.business = ${business} AND (c.customer_name ILIKE ${'%'+search+'%'} OR c.subject ILIKE ${'%'+search+'%'}) ORDER BY c.created_at DESC LIMIT ${limit}`
          : await sql`SELECT c.*, u.name as assignee_name FROM complaints c LEFT JOIN users u ON c.assigned_to = u.id WHERE c.business = ${business} ${status ? sql`AND c.status = ${status}` : sql``} ORDER BY c.created_at DESC LIMIT ${limit}`;
        const countRows = await sql`SELECT COUNT(*) FROM complaints WHERE business = ${business}`;
        return NextResponse.json({ data: rows, count: parseInt(countRows[0].count) });
      }

      case 'createComplaint': {
        const p = params;
        const rows = await sql`
          INSERT INTO complaints (customer_name, phone, business, complaint_type, subject, description, priority, assigned_to, created_by)
          VALUES (${p.customer_name}, ${p.phone||null}, ${p.business}, ${p.complaint_type},
            ${p.subject}, ${p.description||null}, ${p.priority||'medium'}, ${p.assigned_to||null}, ${p.created_by||null})
          RETURNING *
        `;
        return NextResponse.json({ data: rows[0] });
      }

      case 'updateComplaintStatus': {
        await sql`UPDATE complaints SET status=${params.status}, updated_at=NOW() WHERE id=${params.id}`;
        return NextResponse.json({ data: { success: true } });
      }

      case 'updateComplaint': {
        const p = params;
        await sql`UPDATE complaints SET customer_name=${p.customer_name}, complaint_type=${p.complaint_type}, subject=${p.subject}, priority=${p.priority}, updated_at=NOW() WHERE id=${p.id}`;
        return NextResponse.json({ data: { success: true } });
      }

      case 'getCallLogs': {
        const { business, isAdmin, userId, limit = 100 } = params;
        const rows = await sql`
          SELECT cl.*, u.name as emp_name, u.color as emp_color FROM call_logs cl
          LEFT JOIN users u ON cl.emp_id = u.id
          WHERE cl.business = ${business}
          ORDER BY cl.created_at DESC LIMIT ${limit}
        `;
        return NextResponse.json({ data: rows });
      }

      case 'createCallLog': {
        const p = params;
        const rows = await sql`
          INSERT INTO call_logs (lead_id, emp_id, business, call_status, duration_mins, remark, followup_date)
          VALUES (${p.lead_id||null}, ${p.emp_id}, ${p.business}, ${p.call_status},
            ${p.duration_mins||0}, ${p.remark||null}, ${p.followup_date||null})
          RETURNING *
        `;
        if (p.lead_id) {
          await sql`UPDATE leads SET last_remark=${p.remark||null}, call_count=call_count+1, updated_at=NOW() WHERE id=${p.lead_id}`;
        }
        return NextResponse.json({ data: rows[0] });
      }

      case 'getKitchenOrders': {
        const today = new Date().toISOString().slice(0, 10);
        const rows = await sql`SELECT * FROM kitchen_orders WHERE created_at >= ${today} AND order_status != 'cancelled' ORDER BY created_at DESC`;
        return NextResponse.json({ data: rows });
      }

      case 'createKitchenOrder': {
        const p = params;
        const orderNo = 'MK' + Date.now().toString().slice(-6);
        const rows = await sql`
          INSERT INTO kitchen_orders (order_no, customer_name, phone, address, items, total_amount, payment_mode, special_instructions, created_by)
          VALUES (${orderNo}, ${p.customer_name}, ${p.phone||null}, ${p.address||null},
            ${JSON.stringify(p.items||[])}::jsonb, ${p.total_amount}, ${p.payment_mode||'cash'},
            ${p.special_instructions||null}, ${p.created_by||null})
          RETURNING *
        `;
        return NextResponse.json({ data: rows[0] });
      }

      case 'updateKitchenOrderStatus': {
        await sql`UPDATE kitchen_orders SET order_status=${params.status}, updated_at=NOW() WHERE id=${params.id}`;
        return NextResponse.json({ data: { success: true } });
      }

      case 'getMarkets': {
        const rows = await sql`SELECT * FROM markets WHERE is_active = true ORDER BY name`;
        return NextResponse.json({ data: rows });
      }

      case 'getProducts': {
        const rows = await sql`SELECT * FROM products WHERE is_active = true ORDER BY category, name`;
        return NextResponse.json({ data: rows });
      }

      case 'getUsers': {
        const rows = params.role
          ? await sql`SELECT * FROM users WHERE is_active = true AND role = ${params.role} ORDER BY name`
          : await sql`SELECT * FROM users WHERE is_active = true ORDER BY name`;
        return NextResponse.json({ data: rows });
      }

      case 'createUser': {
        const p = params;
        const rows = await sql`
          INSERT INTO users (name, email, password, role, business, phone, department, color)
          VALUES (${p.name}, ${p.email}, ${p.password}, ${p.role},
            ${p.business||'muktifresh'}, ${p.phone||null}, ${p.department||null}, ${p.color||'#22c55e'})
          RETURNING *
        `;
        return NextResponse.json({ data: rows[0] });
      }

      case 'getTodayDispatches': {
        const today = new Date().toISOString().slice(0, 10);
        const rows = await sql`
          SELECT md.*, m.name as market_name, m.area as market_area,
            u.name as agent_name, u.color as agent_color
          FROM market_dispatches md
          LEFT JOIN markets m ON md.market_id = m.id
          LEFT JOIN users u ON md.agent_id = u.id
          WHERE md.dispatch_date = ${today}
          ORDER BY md.created_at DESC
        `;
        return NextResponse.json({ data: rows });
      }

      case 'createDispatch': {
        const p = params;
        const rows = await sql`
          INSERT INTO market_dispatches (market_id, agent_id, dispatch_date, dispatched_by, status, total_dispatch_value)
          VALUES (${p.market_id}, ${p.agent_id}, ${p.dispatch_date}, ${p.dispatched_by}, 'dispatched', ${p.total_dispatch_value})
          RETURNING *
        `;
        const dispatch = rows[0];
        for (const item of (p.items || [])) {
          await sql`INSERT INTO dispatch_items (dispatch_id, product_id, product_name, unit, dispatched_qty, price_per_unit) VALUES (${dispatch.id}, ${item.product_id}, ${item.product_name}, ${item.unit}, ${item.dispatched_qty}, ${item.price_per_unit})`;
        }
        return NextResponse.json({ data: dispatch });
      }

      case 'settleDispatch': {
        await sql`UPDATE market_dispatches SET status='settled', discrepancy=${params.discrepancy}, discrepancy_flagged=${params.flagged}, updated_at=NOW() WHERE id=${params.id}`;
        return NextResponse.json({ data: { success: true } });
      }

      case 'getTodaySales': {
        const today = new Date().toISOString().slice(0, 10);
        const rows = await sql`SELECT * FROM market_sales WHERE sale_date = ${today} AND market_id = ${params.market_id} ORDER BY created_at DESC`;
        return NextResponse.json({ data: rows });
      }

      case 'createSales': {
        const today = new Date().toISOString().slice(0, 10);
        for (const s of (params.sales || [])) {
          await sql`INSERT INTO market_sales (dispatch_id, agent_id, market_id, product_id, product_name, qty_sold, unit, price_per_unit, total_amount, sale_date, entry_method) VALUES (${s.dispatch_id||null}, ${s.agent_id}, ${s.market_id}, ${s.product_id}, ${s.product_name}, ${s.qty_sold}, ${s.unit}, ${s.price_per_unit}, ${s.total_amount}, ${today}, ${s.entry_method||'manual'})`;
        }
        return NextResponse.json({ data: { success: true } });
      }

      case 'getOfflineCustomers': {
        const { search, market_id, limit = 100 } = params;
        const rows = search
          ? await sql`SELECT oc.*, m.name as market_name FROM offline_customers oc LEFT JOIN markets m ON oc.preferred_market_id = m.id WHERE oc.name ILIKE ${'%'+search+'%'} OR oc.phone ILIKE ${'%'+search+'%'} ORDER BY oc.created_at DESC LIMIT ${limit}`
          : market_id
          ? await sql`SELECT oc.*, m.name as market_name FROM offline_customers oc LEFT JOIN markets m ON oc.preferred_market_id = m.id WHERE oc.preferred_market_id = ${market_id} ORDER BY oc.created_at DESC LIMIT ${limit}`
          : await sql`SELECT oc.*, m.name as market_name FROM offline_customers oc LEFT JOIN markets m ON oc.preferred_market_id = m.id ORDER BY oc.created_at DESC LIMIT ${limit}`;
        const countRows = await sql`SELECT COUNT(*) FROM offline_customers`;
        return NextResponse.json({ data: rows, count: parseInt(countRows[0].count) });
      }

      case 'createOfflineCustomer': {
        const p = params;
        const rows = await sql`
          INSERT INTO offline_customers (name, phone, whatsapp, flat_no, complex_name, street_address, area, pin_code, preferred_market_id, language_pref, created_by)
          VALUES (${p.name}, ${p.phone||null}, ${p.whatsapp||null}, ${p.flat_no||null},
            ${p.complex_name||null}, ${p.street_address||null}, ${p.area||null},
            ${p.pin_code||null}, ${p.preferred_market_id||null}, ${p.language_pref||'bengali'}, ${p.created_by||null})
          RETURNING *
        `;
        return NextResponse.json({ data: rows[0] });
      }

      case 'logWhatsApp': {
        const p = params;
        await sql`INSERT INTO whatsapp_drafts (customer_id, business, phone, message, message_type, language, sent_by, is_sent, sent_at) VALUES (${p.customer_id||null}, ${p.business}, ${p.phone}, ${p.message}, ${p.message_type||'manual'}, ${p.language||'english'}, ${p.sent_by||null}, true, NOW())`;
        return NextResponse.json({ data: { success: true } });
      }

      case 'getWhatsAppHistory': {
        const rows = await sql`SELECT * FROM whatsapp_drafts WHERE business = ${params.business} ORDER BY created_at DESC LIMIT 20`;
        return NextResponse.json({ data: rows });
      }

      case 'getReports': {
        const days = params.period === 'week' ? 7 : params.period === 'month' ? 30 : 365;
        const from = new Date(Date.now() - days*86400000).toISOString().slice(0, 10);
        const [fl, fc, kl, kc] = await Promise.all([
          sql`SELECT COUNT(*) FROM leads WHERE business='muktifresh' AND created_at >= ${from}`,
          sql`SELECT COUNT(*) FROM leads WHERE business='muktifresh' AND status='closed' AND created_at >= ${from}`,
          sql`SELECT COUNT(*) FROM leads WHERE business='cloud_kitchen' AND created_at >= ${from}`,
          sql`SELECT COUNT(*) FROM leads WHERE business='cloud_kitchen' AND status='closed' AND created_at >= ${from}`,
        ]);
        return NextResponse.json({ data: {
          freshLeads: parseInt(fl[0].count), freshClosed: parseInt(fc[0].count),
          kitchenLeads: parseInt(kl[0].count), kitchenClosed: parseInt(kc[0].count),
          totalSales: 0, totalDispatched: 0, totalSold: 0, flags: 0, complaints: [],
        }});
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('DB Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
