import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { seedDatabase } from '../utils/seed.js';
import { User, Organization, Service, Counter, Ticket } from '../models/index.js';
import { QueueEngine } from '../services/queueEngine.js';

let customerToken = '';
let staffToken = '';
let adminToken = '';
let apolloOrgId = '';
let apolloServiceId = '';
let apolloCounterId = '';

beforeAll(async () => {
  await connectDatabase();
  await seedDatabase(true);

  // Authenticate demo users to retrieve JWT tokens
  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@smartqueue.com', password: 'Demo@1234' });
  adminToken = adminRes.body.data.token;
  apolloOrgId = adminRes.body.data.user.organizationId;

  const staffRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'staff@smartqueue.com', password: 'Demo@1234' });
  staffToken = staffRes.body.data.token;

  const customerRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'customer@smartqueue.com', password: 'Demo@1234' });
  customerToken = customerRes.body.data.token;

  const service = await Service.findOne({ organizationId: apolloOrgId });
  apolloServiceId = service!._id.toString();

  const counter = await Counter.findOne({ organizationId: apolloOrgId });
  apolloCounterId = counter!._id.toString();
});

afterAll(async () => {
  await disconnectDatabase();
});

describe('1. Authentication Tests', () => {
  it('should register a new customer independently', async () => {
    const randomEmail = `testcust_${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: randomEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('CUSTOMER');
    expect(res.body.data.token).toBeDefined();
  });

  it('should register a new organization and create its initial admin', async () => {
    const orgName = `Test Clinic ${Date.now()}`;
    const adminEmail = `clinicadmin_${Date.now()}@test.com`;
    const res = await request(app)
      .post('/api/auth/register-organization')
      .send({
        name: orgName,
        type: 'HOSPITAL',
        address: '123 Medical Way',
        city: 'Hyderabad',
        state: 'Telangana',
        pin: '500001',
        email: 'info@testclinic.com',
        services: ['General', 'Pediatrics'],
        counters: 2,
        adminEmail,
        adminPassword: 'Password123!'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.org.code).toMatch(/^SQ-HOSP-\d{4}$/);
    expect(res.body.data.admin.role).toBe('ADMIN');
  });

  it('should reject login with incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@smartqueue.com', password: 'WrongPassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject registration with duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'customer@smartqueue.com',
        password: 'Password123!'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should block disabled accounts from logging in', async () => {
    const passwordHash = await bcrypt.hash('Demo@1234', 10);
    const testUser = await User.create({
      name: 'Disabled User',
      email: `disabled_${Date.now()}@mail.com`,
      passwordHash,
      role: 'CUSTOMER',
      status: 'DISABLED'
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'Demo@1234' });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('disabled');
  });
});

describe('2. Authorization & RBAC Tests', () => {
  it('should forbid customer from accessing admin APIs', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });

  it('should forbid staff from accessing admin APIs', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it('should forbid unauthenticated access to protected endpoints', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('should forbid customer from cancelling another customer ticket', async () => {
    // Find a ticket belonging to someone else
    const otherTicket = await Ticket.findOne({ status: 'WAITING' });
    expect(otherTicket).toBeDefined();

    // Create a new separate customer
    const newCustRes = await request(app)
      .post('/api/auth/register')
      .send({ email: `intruder_${Date.now()}@mail.com`, password: 'Password123!' });
    const intruderToken = newCustRes.body.data.token;

    const res = await request(app)
      .delete(`/api/queues/tickets/${otherTicket!._id}`)
      .set('Authorization', `Bearer ${intruderToken}`);

    expect(res.status).toBe(403);
  });
});

describe('3. Queue Management & Concurrency Tests', () => {
  it('should allow customer to join queue and receive a token', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: `joiner_${Date.now()}@mail.com`, password: 'Password123!' });
    const joinerToken = regRes.body.data.token;

    const res = await request(app)
      .post('/api/queues/join')
      .set('Authorization', `Bearer ${joinerToken}`)
      .send({ orgId: apolloOrgId, serviceId: apolloServiceId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ticket.token).toBeDefined();
    expect(res.body.data.position.ahead).toBeGreaterThanOrEqual(0);
  });

  it('should prevent duplicate active tickets for the same service', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: `dup_${Date.now()}@mail.com`, password: 'Password123!' });
    const dupToken = regRes.body.data.token;

    // First join - succeeds
    const res1 = await request(app)
      .post('/api/queues/join')
      .set('Authorization', `Bearer ${dupToken}`)
      .send({ orgId: apolloOrgId, serviceId: apolloServiceId });
    expect(res1.status).toBe(201);

    // Second join - fails with duplicate queue error
    const res2 = await request(app)
      .post('/api/queues/join')
      .set('Authorization', `Bearer ${dupToken}`)
      .send({ orgId: apolloOrgId, serviceId: apolloServiceId });

    expect(res2.status).toBe(400);
    expect(res2.body.message).toContain('already in this queue');
  });

  it('should prevent duplicate token sequence numbers under concurrent joins', async () => {
    // Create 10 distinct customers
    const customers = [];
    for (let i = 0; i < 10; i++) {
      const reg = await request(app)
        .post('/api/auth/register')
        .send({ email: `concurrent_${i}_${Date.now()}@mail.com`, password: 'Password123!' });
      customers.push(reg.body.data);
    }

    // Pick a service with enough capacity
    const secondService = (await Service.find({ organizationId: apolloOrgId }))[1];

    // Fire 10 simultaneous join requests
    const joinPromises = customers.map(c =>
      request(app)
        .post('/api/queues/join')
        .set('Authorization', `Bearer ${c.token}`)
        .send({ orgId: apolloOrgId, serviceId: secondService._id.toString() })
    );

    const results = await Promise.all(joinPromises);
    const tokens = results.map(r => r.body.data?.ticket?.token).filter(Boolean);

    // Verify all 10 succeeded and each token is completely unique
    expect(tokens.length).toBe(10);
    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBe(10);
  });

  it('should allow customer to cancel their own waiting ticket', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: `canceller_${Date.now()}@mail.com`, password: 'Password123!' });
    const token = reg.body.data.token;

    const thirdService = (await Service.find({ organizationId: apolloOrgId }))[2];
    const joinRes = await request(app)
      .post('/api/queues/join')
      .set('Authorization', `Bearer ${token}`)
      .send({ orgId: apolloOrgId, serviceId: thirdService._id.toString() });

    const ticketId = joinRes.body.data.ticket.id;

    const cancelRes = await request(app)
      .delete(`/api/queues/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    // Cancelling again should fail with invalid state transition
    const secondCancel = await request(app)
      .delete(`/api/queues/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(secondCancel.status).toBe(400);
  });
});

describe('4. Staff & Admin Operations', () => {
  it('should provide staff queue and allow calling NEXT customer', async () => {
    // Check if staff has current ticket, complete it first
    await request(app)
      .post('/api/staff/complete')
      .set('Authorization', `Bearer ${staffToken}`);

    const res = await request(app)
      .post('/api/staff/next')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('SERVING');
  });

  it('should allow admin to manage services and counters scoped to their organization', async () => {
    const svcName = `New Dept ${Date.now()}`;
    const createRes = await request(app)
      .post('/api/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: svcName, avg: 10, cap: 60 });

    expect(createRes.status).toBe(201);
    const newSvcId = createRes.body.data.id;

    // Admin updates service
    const updateRes = await request(app)
      .put(`/api/admin/services/${newSvcId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ avg: 15, open: false });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.avg).toBe(15);
    expect(updateRes.body.data.open).toBe(false);

    // Admin deletes service
    const delRes = await request(app)
      .delete(`/api/admin/services/${newSvcId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(delRes.status).toBe(200);
  });
});
