// Integrated store connected to Express / MongoDB / Socket.IO backend.
// Preserves existing data contracts, read helpers, and exported signatures.
import { useEffect, useState } from 'react';
import { api, getAuthToken } from './api';
import { authService, User as AuthUser } from './auth.service';
import { organizationService, Org as ApiOrg, Service as ApiService } from './organization.service';
import { queueService, Ticket as ApiTicket } from './queue.service';
import { staffService } from './staff.service';
import { adminService, Counter as ApiCounter } from './admin.service';
import { notificationService, Notif as ApiNotif } from './notification.service';
import { socketService } from './socket.service';

export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN';
export type Status = 'WAITING' | 'CALLED' | 'SERVING' | 'COMPLETED' | 'SKIPPED' | 'CANCELLED';

export interface Org {
  id: string;
  code: string;
  name: string;
  type: string;
  address: string;
  city: string;
  state: string;
  pin: string;
  lat: number;
  lng: number;
  open: boolean;
  email: string;
  stats?: {
    waiting: number;
    wait: number;
    services: number;
  };
}

export interface Service {
  id: string;
  orgId: string;
  name: string;
  prefix: string;
  avg: number;
  enabled: boolean;
  open: boolean;
  cap: number;
  waitingCount?: number;
  currentServingToken?: string;
}

export interface Counter {
  id: string;
  orgId: string;
  name: string;
  serviceId: string;
  active: boolean;
}

export interface User {
  id: string;
  email: string;
  password?: string;
  role: Role;
  orgId?: string;
  organizationId?: string;
  name: string;
  serviceId?: string;
  counterId?: string;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: number;
}

export interface Ticket {
  id: string;
  orgId: string;
  serviceId: string;
  token: string;
  seq: number;
  customerId: string;
  status: Status;
  createdAt: number;
  calledAt?: number;
  completedAt?: number;
  counterId?: string;
  staffId?: string;
}

export interface Notif {
  id: string;
  userId: string;
  msg: string;
  ts: number;
}

export interface DB {
  orgs: Org[];
  services: Service[];
  counters: Counter[];
  users: User[];
  tickets: Ticket[];
  notifs: Notif[];
}

// Reusable organization-type templates
export const TYPES: Record<string, { label: string; icon: string; code: string; person: string; unit: string; services: string[] }> = {
  HOSPITAL: { label: 'Hospital', icon: '🏥', code: 'HOSP', person: 'Patient', unit: 'Department', services: ['General Consultation', 'Cardiology', 'Pediatrics', 'Pharmacy', 'Billing', 'Laboratory'] },
  BANK: { label: 'Bank', icon: '🏦', code: 'BANK', person: 'Customer', unit: 'Banking Service', services: ['Cash Deposit', 'Withdrawal', 'Account Services', 'Loans', 'Customer Support'] },
  OFFICE: { label: 'Private Office', icon: '🏢', code: 'OFFICE', person: 'Visitor', unit: 'Service', services: ['Customer Support', 'Documentation', 'HR', 'Payments', 'Enquiries'] },
  GOVERNMENT: { label: 'Government Office', icon: '🏛️', code: 'GOV', person: 'Citizen', unit: 'Service', services: ['Certificates', 'Applications', 'Verification', 'Payments', 'Citizen Services'] },
  INSTITUTE: { label: 'Educational Institute', icon: '🎓', code: 'INST', person: 'Student', unit: 'Office', services: ['Admissions', 'Certificates', 'Fees', 'Examination Cell', 'Student Services'] },
  SERVICE: { label: 'Service Center', icon: '🛠️', code: 'SERV', person: 'Customer', unit: 'Service', services: ['Repair', 'Customer Support', 'Product Collection', 'Warranty', 'Payments'] }
};

const USER_SESSION_KEY = 'sq_session_user';
const midnight = () => new Date().setHours(0, 0, 0, 0);

// In-memory reactive state
let currentUser: User | null = (() => {
  try {
    const cached = sessionStorage.getItem(USER_SESSION_KEY) || localStorage.getItem(USER_SESSION_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
})();

let db: DB = {
  orgs: [],
  services: [],
  counters: [],
  users: currentUser ? [currentUser] : [],
  tickets: [],
  notifs: []
};

const subs = new Set<()=>void>();
const notifySubscribers = () => {
  subs.forEach(f => f());
};

export const err = (m: string): never => {
  throw new Error(m);
};

// Central sync from backend
export async function syncAll(): Promise<void> {
  try {
    // 1. Fetch current user if token exists
    const token = getAuthToken();
    if (token) {
      try {
        const u = await authService.getMe();
        if (u) {
          currentUser = u as User;
          sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(currentUser));
          // Connect real-time socket
          socketService.connect();
          if (currentUser.orgId) socketService.joinOrganization(currentUser.orgId);
          if (currentUser.serviceId) socketService.joinService(currentUser.serviceId);
        } else {
          currentUser = null;
          sessionStorage.removeItem(USER_SESSION_KEY);
        }
      } catch {
        // Token may be invalid
      }
    }

    // 2. Fetch Organizations
    const orgs = await organizationService.getOrganizations();
    db.orgs = orgs;

    // 3. Role-specific syncing
    if (currentUser) {
      // Sync notifications for all authenticated users
      try {
        const notifs = await notificationService.getNotifications();
        db.notifs = notifs;
      } catch {}

      if (currentUser.role === 'CUSTOMER') {
        try {
          const myTickets = await queueService.getMyTickets();
          db.tickets = myTickets;
        } catch {}

        // Fetch services for orgs in parallel
        try {
          const svcLists = await Promise.all(
            orgs.map(o => organizationService.getOrganizationServices(o.id).catch(() => []))
          );
          db.services = svcLists.flat();
        } catch {}
      } else if (currentUser.role === 'STAFF') {
        const orgId = currentUser.orgId;
        if (orgId) {
          try {
            const svcs = await organizationService.getOrganizationServices(orgId);
            db.services = svcs;
          } catch {}
          try {
            const staffQueue = await staffService.getQueue();
            db.tickets = staffQueue.rows;
          } catch {}
        }
      } else if (currentUser.role === 'ADMIN') {
        try {
          const [adminSvcs, adminCtrs, adminStaff, dashData] = await Promise.all([
            adminService.getServices(),
            adminService.getCounters(),
            adminService.getStaff(),
            adminService.getDashboard()
          ]);
          db.services = adminSvcs;
          db.counters = adminCtrs;
          db.users = [currentUser, ...adminStaff.filter(s => s.id !== currentUser?.id)];

          // Fetch all customer tickets for this org
          try {
            const customers = await adminService.getCustomers();
            const collectedTickets: Ticket[] = [];
            customers.forEach(c => {
              if (c.history) collectedTickets.push(...c.history);
            });
            db.tickets = collectedTickets;
          } catch {}
        } catch {}
      }
    } else {
      // Unauthenticated visitor: fetch services for top organizations
      try {
        const allSvcs: Service[] = [];
        for (const o of orgs.slice(0, 10)) {
          const svcs = await organizationService.getOrganizationServices(o.id);
          allSvcs.push(...svcs);
        }
        db.services = allSvcs;
      } catch {}
    }

    notifySubscribers();
  } catch (e) {
    console.error('[Store] Sync failed:', e);
  }
}

// Initial boot sync
if (typeof window !== 'undefined') {
  syncAll();

  // Setup real-time socket listener to re-sync
  const setupRealtime = () => {
    socketService.connect();
    const events = [
      'queue:updated',
      'ticket:created',
      'ticket:called',
      'ticket:recalled',
      'ticket:skipped',
      'ticket:completed',
      'ticket:cancelled',
      'dashboard:updated',
      'notification:new'
    ];
    events.forEach(evt => {
      socketService.on(evt, () => {
        syncAll();
      });
    });
  };
  setupRealtime();
}

/** Subscribe to live DB changes (backed by Socket.IO & API sync) */
export function useDB(): DB {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick(x => x + 1);
    subs.add(listener);
    // Trigger fresh sync on mount
    syncAll();
    return () => {
      subs.delete(listener);
    };
  }, []);
  return db;
}

// ---------- auth ----------
export const me = (): User | undefined => currentUser || undefined;

export async function login(email: string, pw: string, remember: boolean): Promise<User> {
  const u = await authService.login(email, pw, remember);
  currentUser = u as User;
  (remember ? localStorage : sessionStorage).setItem(USER_SESSION_KEY, JSON.stringify(currentUser));
  notifySubscribers();
  syncAll(); // Background sync without blocking navigation
  return currentUser;
}

export async function logout(): Promise<void> {
  await authService.logout();
  currentUser = null;
  localStorage.removeItem(USER_SESSION_KEY);
  sessionStorage.removeItem(USER_SESSION_KEY);
  db.tickets = [];
  db.notifs = [];
  notifySubscribers();
}

export async function registerCustomer(email: string, pw: string, pw2: string): Promise<User> {
  const u = await authService.registerCustomer(email, pw, pw2);
  currentUser = u as User;
  sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(currentUser));
  notifySubscribers();
  syncAll();
  return currentUser;
}

export async function registerOrg(f: any): Promise<Org> {
  const org = await authService.registerOrg(f);
  await syncAll();
  return org;
}

// ---------- read helpers ----------
export const svcOf = (orgId: string): Service[] => db.services.filter(s => s.orgId === orgId);
export const isActive = (t: Ticket): boolean => t.status === 'WAITING' || t.status === 'CALLED' || t.status === 'SERVING';
export const todayT = (t: Ticket): boolean => t.createdAt >= midnight();
export const waiting = (serviceId: string): Ticket[] =>
  db.tickets.filter(t => t.serviceId === serviceId && t.status === 'WAITING' && todayT(t)).sort((a, b) => a.seq - b.seq);

export function currentToken(serviceId: string): string {
  const l = db.tickets.filter(t => t.serviceId === serviceId && todayT(t) && (t.status === 'SERVING' || t.status === 'CALLED' || t.calledAt)).sort((a, b) => (b.calledAt || 0) - (a.calledAt || 0));
  return l[0]?.token || '—';
}

export const ahead = (t: Ticket): number => (t.status === 'WAITING' ? waiting(t.serviceId).filter(x => x.seq < t.seq).length : 0);
export const estWait = (t: Ticket): number => {
  const s = db.services.find(x => x.id === t.serviceId);
  return t.status === 'WAITING' ? (ahead(t) + 1) * (s?.avg || 5) : 0;
};

export function orgStats(orgId: string) {
  const org = db.orgs.find(o => o.id === orgId);
  if (org?.stats) {
    return org.stats;
  }
  const ss = svcOf(orgId).filter(s => s.enabled);
  const w = ss.reduce((a, s) => a + waiting(s.id).length, 0);
  const c = Math.max(1, db.counters.filter(c => c.orgId === orgId && c.active).length);
  const avg = ss.length ? ss.reduce((a, s) => a + s.avg, 0) / ss.length : 5;
  return { waiting: w, wait: Math.round((w * avg) / c), services: ss.length };
}

export const avgOf = (a: number[]): number => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : 0);

// ---------- notifications ----------
export async function clearNotifs(): Promise<void> {
  await notificationService.clearNotifications();
  db.notifs = [];
  notifySubscribers();
}

// ---------- customer ----------
export async function joinQueue(orgId: string, serviceId: string): Promise<Ticket> {
  const res = await queueService.joinQueue(orgId, serviceId);
  await syncAll();
  return res.ticket;
}

export async function cancelTicket(id: string): Promise<void> {
  await queueService.cancelTicket(id);
  await syncAll();
}

// ---------- staff ----------
export async function staffAct(a: 'next' | 'call' | 'recall' | 'skip' | 'complete', tid?: string): Promise<any> {
  let res: any;
  if (a === 'next') res = await staffService.callNext();
  else if (a === 'call') res = await staffService.callTicket(tid!);
  else if (a === 'recall') res = await staffService.recall(tid);
  else if (a === 'skip') res = await staffService.skip(tid);
  else if (a === 'complete') res = await staffService.complete(tid);

  await syncAll();
  return res;
}

// ---------- admin ----------
export async function saveService(p: Partial<Service> & { id?: string }): Promise<void> {
  if (p.id) {
    await adminService.updateService(p.id, p);
  } else {
    await adminService.createService(p);
  }
  await syncAll();
}

export async function deleteService(id: string): Promise<void> {
  await adminService.deleteService(id);
  await syncAll();
}

export async function saveCounter(p: Partial<Counter> & { id?: string; staffId?: string }): Promise<void> {
  if (p.id) {
    await adminService.updateCounter(p.id, p);
  } else {
    await adminService.createCounter(p);
  }
  await syncAll();
}

export async function deleteCounter(id: string): Promise<void> {
  await adminService.deleteCounter(id);
  await syncAll();
}

export async function saveStaff(p: { id?: string; name: string; email: string; password?: string; serviceId?: string; counterId?: string }): Promise<void> {
  if (p.id) {
    await adminService.updateStaff(p.id, p);
  } else {
    await adminService.createStaff(p);
  }
  await syncAll();
}

export async function staffToggle(id: string): Promise<void> {
  await adminService.toggleStaffStatus(id);
  await syncAll();
}

export async function staffReset(id: string, pw: string): Promise<void> {
  await adminService.resetStaffPassword(id, pw);
}

export async function staffDelete(id: string): Promise<void> {
  await adminService.deleteStaff(id);
  await syncAll();
}

export async function saveOrg(p: Partial<Org>): Promise<void> {
  await adminService.updateOrganization(p);
  await syncAll();
}

export async function resetDemo(): Promise<void> {
  await adminService.resetDemo();
  await syncAll();
}
