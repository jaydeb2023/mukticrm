export async function dbCall(action: string, params: any = {}) {
  const res = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}
export async function loginUser(email: string, password: string, role: string) {
  const { data } = await dbCall('login', { email, password, role });
  return data;
}
export async function getDashboardStats() {
  const { data } = await dbCall('getDashboardStats');
  return data || {};
}
export async function getLeads(p: any) { return await dbCall('getLeads', p); }
export async function createLead(p: any) { const { data } = await dbCall('createLead', p); return data; }
export async function bulkCreateLeads(leads: any[], business: string, created_by: string) { return await dbCall('bulkCreateLeads', { leads, business, created_by }); }
export async function updateLead(p: any) { await dbCall('updateLead', p); }
export async function getCustomers(p: any) { return await dbCall('getCustomers', p); }
export async function createCustomer(p: any) { const { data } = await dbCall('createCustomer', p); return data; }
export async function updateCustomer(p: any) { await dbCall('updateCustomer', p); }
export async function bulkCreateCustomers(c: any[], business: string, created_by: string) { return await dbCall('bulkCreateCustomers', { customers: c, business, created_by }); }
export async function getComplaints(p: any) { return await dbCall('getComplaints', p); }
export async function createComplaint(p: any) { const { data } = await dbCall('createComplaint', p); return data; }
export async function updateComplaintStatus(id: string, status: string) { await dbCall('updateComplaintStatus', { id, status }); }
export async function updateComplaint(p: any) { await dbCall('updateComplaint', p); }
export async function getCallLogs(p: any) { return await dbCall('getCallLogs', p); }
export async function createCallLog(p: any) { const { data } = await dbCall('createCallLog', p); return data; }
export async function getKitchenOrders() { const { data } = await dbCall('getKitchenOrders'); return data || []; }
export async function createKitchenOrder(p: any) { const { data } = await dbCall('createKitchenOrder', p); return data; }
export async function updateKitchenOrderStatus(id: string, status: string) { await dbCall('updateKitchenOrderStatus', { id, status }); }
export async function getMarkets() { const { data } = await dbCall('getMarkets'); return data || []; }
export async function getProducts() { const { data } = await dbCall('getProducts'); return data || []; }
export async function getTodayDispatches(agent_id?: string) { const { data } = await dbCall('getTodayDispatches', { agent_id }); return data || []; }
export async function createDispatch(p: any) { const { data } = await dbCall('createDispatch', p); return data; }
export async function settleDispatch(id: string, discrepancy: number, flagged: boolean) { await dbCall('settleDispatch', { id, discrepancy, flagged }); }
export async function getTodaySales(market_id: string) { const { data } = await dbCall('getTodaySales', { market_id }); return data || []; }
export async function createSales(sales: any[], dispatch_id?: string) { await dbCall('createSales', { sales, dispatch_id }); }
export async function getOfflineCustomers(p: any) { return await dbCall('getOfflineCustomers', p); }
export async function createOfflineCustomer(p: any) { const { data } = await dbCall('createOfflineCustomer', p); return data; }
export async function logWhatsApp(p: any) { await dbCall('logWhatsApp', p); }
export async function getWhatsAppHistory(business: string) { const { data } = await dbCall('getWhatsAppHistory', { business }); return data || []; }
export async function getReports(period: string) { const { data } = await dbCall('getReports', { period }); return data || {}; }
