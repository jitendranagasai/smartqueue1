const BASE_URL = process.env.TEST_URL || 'https://sculpture-toll-episode-status.trycloudflare.com';

interface TestResult {
  name: string;
  category: string;
  status: 'PASS' | 'FAIL';
  details?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runTest(category: string, name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({ category, name, status: 'PASS', durationMs: Date.now() - start });
    console.log(`[PASS] (${Date.now() - start}ms) [${category}] ${name}`);
  } catch (err: any) {
    results.push({ category, name, status: 'FAIL', details: err.message, durationMs: Date.now() - start });
    console.error(`[FAIL] (${Date.now() - start}ms) [${category}] ${name}: ${err.message}`);
  }
}

async function api(path: string, options: any = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  let data: any;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log(`================================================================`);
  console.log(`🧪 Running Comprehensive Live E2E Verification on Public Tunnel:`);
  console.log(`🔗 Target: ${BASE_URL}`);
  console.log(`================================================================\n`);

  let customerToken = '';
  let staffToken = '';
  let adminToken = '';
  let apolloOrgId = '';
  let apolloServiceId = '';
  let testTicketId = '';

  // 1. Health & Connectivity
  await runTest('System', 'Health Check Endpoint (/api/health)', async () => {
    const res = await api('/api/health');
    if (!res.ok || res.data.data?.status !== 'UP') throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
  });

  await runTest('System', 'Frontend HTML Delivery (/)', async () => {
    const res = await fetch(BASE_URL);
    const text = await res.text();
    if (res.status !== 200 || !text.includes('<title>SmartQueue</title>')) throw new Error('Frontend index.html failed to deliver');
  });

  // 2. Organization Discovery
  await runTest('Discovery', 'Get All Organizations with live stats (/api/organizations)', async () => {
    const res = await api('/api/organizations');
    if (!res.ok || !Array.isArray(res.data.data) || res.data.data.length === 0) throw new Error('No organizations returned');
    const apollo = res.data.data.find((o: any) => o.code === 'SQ-HOSP-1024');
    if (!apollo) throw new Error('Apollo hospital missing');
    apolloOrgId = apollo.id;
  });

  await runTest('Discovery', 'Search Organization by Query (/api/organizations?query=Apollo)', async () => {
    const res = await api('/api/organizations?query=Apollo');
    if (!res.ok || res.data.data.length === 0 || !res.data.data[0].name.includes('Apollo')) throw new Error('Search failed');
  });

  await runTest('Discovery', 'Get Organization Services (/api/organizations/:id/services)', async () => {
    const res = await api(`/api/organizations/${apolloOrgId}/services`);
    if (!res.ok || res.data.data.length === 0) throw new Error('No services returned');
    apolloServiceId = res.data.data[0].id;
  });

  // 3. Authentication
  await runTest('Auth', 'Admin Login (admin@smartqueue.com)', async () => {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@smartqueue.com', password: 'Demo@1234' })
    });
    if (!res.ok || res.data.data?.user?.role !== 'ADMIN') throw new Error(`Admin login failed: ${res.data?.message}`);
    adminToken = res.data.data.token;
  });

  await runTest('Auth', 'Staff Login (staff@smartqueue.com)', async () => {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'staff@smartqueue.com', password: 'Demo@1234' })
    });
    if (!res.ok || res.data.data?.user?.role !== 'STAFF') throw new Error(`Staff login failed: ${res.data?.message}`);
    staffToken = res.data.data.token;
  });

  await runTest('Auth', 'Customer Login (customer@smartqueue.com)', async () => {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'customer@smartqueue.com', password: 'Demo@1234' })
    });
    if (!res.ok || res.data.data?.user?.role !== 'CUSTOMER') throw new Error(`Customer login failed: ${res.data?.message}`);
    customerToken = res.data.data.token;
  });

  await runTest('Auth', 'Reject Wrong Password (401)', async () => {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'customer@smartqueue.com', password: 'WrongPassword!' })
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await runTest('Auth', 'Register New Customer Account', async () => {
    const email = `new_live_cust_${Date.now()}@example.com`;
    const res = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'DemoPassword123' })
    });
    if (res.status !== 201 || res.data.data?.user?.role !== 'CUSTOMER') throw new Error(`Registration failed: ${res.data?.message}`);
  });

  await runTest('Auth', 'Reject Duplicate Customer Registration (409)', async () => {
    const res = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'customer@smartqueue.com', password: 'DemoPassword123' })
    });
    if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
  });

  await runTest('Auth', 'Session User Verification (/api/auth/me)', async () => {
    const res = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    if (!res.ok || res.data.data?.user?.email !== 'customer@smartqueue.com') throw new Error('Session verify failed');
  });

  // 4. Customer Queue Flow
  await runTest('Queue', 'Customer Join Queue (/api/queues/join)', async () => {
    // Pick an open service from another org (e.g. Bank)
    const orgsRes = await api('/api/organizations');
    const bank = orgsRes.data.data.find((o: any) => o.code === 'SQ-BANK-2056');
    const svcsRes = await api(`/api/organizations/${bank.id}/services`);
    const targetService = svcsRes.data.data[1]; // 2nd service

    const res = await api('/api/queues/join', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ orgId: bank.id, serviceId: targetService.id })
    });

    if (res.status !== 201 && res.status !== 400) throw new Error(`Join queue failed with status ${res.status}: ${res.data?.message}`);
    if (res.status === 201) {
      testTicketId = res.data.data.ticket.id;
      if (!res.data.data.ticket.token) throw new Error('Token not generated');
    }
  });

  await runTest('Queue', 'Prevent Duplicate Active Ticket in Same Queue (400)', async () => {
    const orgsRes = await api('/api/organizations');
    const bank = orgsRes.data.data.find((o: any) => o.code === 'SQ-BANK-2056');
    const svcsRes = await api(`/api/organizations/${bank.id}/services`);
    const targetService = svcsRes.data.data[1];

    const res = await api('/api/queues/join', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ orgId: bank.id, serviceId: targetService.id })
    });

    if (res.status !== 400 || !res.data.message.includes('already in this queue')) {
      throw new Error(`Expected 400 duplicate error, got: ${res.status} - ${res.data.message}`);
    }
  });

  await runTest('Queue', 'Fetch Customer Active Tickets (/api/queues/my-tickets)', async () => {
    const res = await api('/api/queues/my-tickets', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    if (!res.ok || !Array.isArray(res.data.data)) throw new Error('Failed to fetch customer tickets');
    if (!testTicketId && res.data.data.length > 0) {
      testTicketId = res.data.data[0].id;
    }
  });

  if (testTicketId) {
    await runTest('Queue', 'Customer Check Queue Position (/api/queues/tickets/:id/position)', async () => {
      const res = await api(`/api/queues/tickets/${testTicketId}/position`, {
        headers: { Authorization: `Bearer ${customerToken}` }
      });
      if (!res.ok || res.data.data?.ahead === undefined) throw new Error('Position calculation failed');
    });

    await runTest('Queue', 'Customer Cancel Waiting Ticket (/api/queues/tickets/:id)', async () => {
      const res = await api(`/api/queues/tickets/${testTicketId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${customerToken}` }
      });
      // May succeed if WAITING, or return 400 if already resolved
      if (!res.ok && !res.data?.message?.includes('already')) throw new Error(`Cancel ticket failed: ${res.data?.message}`);
    });
  }

  // 5. Staff Flow
  await runTest('Staff', 'Staff Dashboard (/api/staff/dashboard)', async () => {
    const res = await api('/api/staff/dashboard', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!res.ok || !res.data.data?.hasService) throw new Error(`Staff dashboard error: ${res.data?.message}`);
  });

  await runTest('Staff', 'Staff Queue View (/api/staff/queue)', async () => {
    const res = await api('/api/staff/queue', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!res.ok || !Array.isArray(res.data.data?.rows)) throw new Error('Queue rows missing');
  });

  await runTest('Staff', 'Staff Call or Complete Flow', async () => {
    // If staff already has active ticket, complete it
    await api('/api/staff/complete', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` }
    });

    // Try calling NEXT customer
    const nextRes = await api('/api/staff/next', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` }
    });

    // Either a ticket was called or queue is empty
    if (!nextRes.ok && !nextRes.data.message.includes('No waiting customers')) {
      throw new Error(`Unexpected error: ${nextRes.data.message}`);
    }
  });

  // 6. Admin Flow
  await runTest('Admin', 'Admin Dashboard KPI Metrics (/api/admin/dashboard)', async () => {
    const res = await api('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!res.ok || res.data.data?.totalCustomers === undefined) throw new Error('Admin KPI missing');
  });

  await runTest('Admin', 'Admin Analytics Data (/api/admin/analytics)', async () => {
    const res = await api('/api/admin/analytics', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!res.ok || !Array.isArray(res.data.data?.perDay) || !Array.isArray(res.data.data?.peak)) {
      throw new Error('Analytics payload malformed');
    }
  });

  await runTest('Admin', 'Admin Services Management (Create, Update, Delete)', async () => {
    const name = `E2E Test Dept ${Date.now()}`;
    // Create
    const createRes = await api('/api/admin/services', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name, avg: 12, cap: 40 })
    });
    if (createRes.status !== 201) throw new Error(`Create service failed: ${createRes.data.message}`);
    const serviceId = createRes.data.data.id;

    // Update
    const updateRes = await api(`/api/admin/services/${serviceId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ avg: 14, open: false })
    });
    if (!updateRes.ok) throw new Error(`Update service failed: ${updateRes.data.message}`);

    // Delete
    const deleteRes = await api(`/api/admin/services/${serviceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!deleteRes.ok) throw new Error(`Delete service failed: ${deleteRes.data.message}`);
  });

  await runTest('Admin', 'Admin Counters Listing (/api/admin/counters)', async () => {
    const res = await api('/api/admin/counters', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!res.ok || !Array.isArray(res.data.data)) throw new Error('Counters listing failed');
  });

  await runTest('Admin', 'Admin Staff Management Listing (/api/admin/staff)', async () => {
    const res = await api('/api/admin/staff', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!res.ok || !Array.isArray(res.data.data)) throw new Error('Staff listing failed');
  });

  // 7. Security & RBAC Enforcement
  await runTest('Security', 'Block Customer from Admin APIs (403 Forbidden)', async () => {
    const res = await api('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await runTest('Security', 'Block Staff from Admin APIs (403 Forbidden)', async () => {
    const res = await api('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await runTest('Security', 'Block Unauthenticated Access (401 Unauthorized)', async () => {
    const res = await api('/api/admin/dashboard');
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // Summary
  console.log(`\n================================================================`);
  console.log(`📊 LIVE VERIFICATION SUMMARY:`);
  console.log(`================================================================`);
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`Total Tests Run: ${results.length}`);
  console.log(`Passed:          ${passed} ✅`);
  console.log(`Failed:          ${failed} ❌`);
  console.log(`Success Rate:    ${Math.round((passed / results.length) * 100)}%`);
  console.log(`================================================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
