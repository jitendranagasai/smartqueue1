import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { AuthenticatedRequest } from '../types/index.js';
import {
  Organization,
  Service,
  Counter,
  User,
  Ticket
} from '../models/index.js';
import { sendSuccess } from '../utils/response.js';
import { AppError, NotFoundError, ConflictError } from '../utils/errors.js';
import { getOperatingDateKey, getTodayMidnight } from '../utils/constants.js';
import { emitToOrg } from '../sockets/socketManager.js';
import { seedDatabase } from '../utils/seed.js';

// --- Dashboard & Analytics ---

export async function getAdminDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const dateKey = getOperatingDateKey();

    const [org, services, counters, staff, allOrgTickets] = await Promise.all([
      Organization.findById(orgId),
      Service.find({ organizationId: orgId }),
      Counter.find({ organizationId: orgId }),
      User.find({ organizationId: orgId, role: 'STAFF' }),
      Ticket.find({ organizationId: orgId })
    ]);

    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    const todayTickets = allOrgTickets.filter(t => t.dateKey === dateKey);
    const waitingTickets = todayTickets.filter(t => t.status === 'WAITING');
    const completedToday = todayTickets.filter(t => t.status === 'COMPLETED');
    const uniqueCustomerIds = Array.from(new Set(allOrgTickets.map(t => t.customerId.toString())));

    // Average waiting time
    const completedWithTimes = allOrgTickets.filter(t => t.status === 'COMPLETED' && t.calledAt && t.createdAt);
    const avgWait = completedWithTimes.length
      ? completedWithTimes.reduce((acc, t) => acc + (t.calledAt!.getTime() - t.createdAt.getTime()) / 6e4, 0) / completedWithTimes.length
      : 0;

    // Service list with live queue indicators
    const servicesWithQueue = await Promise.all(
      services.map(async s => {
        const waitingForSvc = waitingTickets.filter(t => t.serviceId.toString() === s._id.toString());
        const servingForSvc = todayTickets.filter(
          t => t.serviceId.toString() === s._id.toString() && (t.status === 'SERVING' || t.status === 'CALLED')
        ).sort((a, b) => (b.calledAt?.getTime() || 0) - (a.calledAt?.getTime() || 0));

        return {
          ...s.toJSON(),
          waitingCount: waitingForSvc.length,
          currentServingToken: servingForSvc[0]?.token || '—'
        };
      })
    );

    return sendSuccess(res, 'Admin dashboard metrics', {
      organization: org.toJSON(),
      totalCustomers: uniqueCustomerIds.length,
      activeQueues: services.filter(s => s.open && s.enabled).length,
      waitingCustomers: waitingTickets.length,
      staffCount: staff.length,
      completedToday: completedToday.length,
      avgWaitingMinutes: Math.round(avgWait),
      services: servicesWithQueue
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const [tickets, services, staff] = await Promise.all([
      Ticket.find({ organizationId: orgId }),
      Service.find({ organizationId: orgId }),
      User.find({ organizationId: orgId, role: 'STAFF' })
    ]);

    const completed = tickets.filter(t => t.status === 'COMPLETED' && t.calledAt && t.completedAt);

    // 7-day trend
    const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - 6 + i);
      return d;
    });

    const perDay = days.map(d => {
      const dayTickets = completed.filter(t => new Date(t.createdAt).toDateString() === d.toDateString());
      const avgWait = dayTickets.length
        ? dayTickets.reduce((acc, t) => acc + (t.calledAt!.getTime() - t.createdAt.getTime()) / 6e4, 0) / dayTickets.length
        : 0;

      return {
        day: d.toLocaleDateString(undefined, { weekday: 'short' }),
        served: dayTickets.length,
        wait: Math.round(avgWait * 10) / 10
      };
    });

    // Peak hours (8:00 to 18:00)
    const peak = [...Array(11)].map((_, i) => {
      const hour = i + 8;
      const count = tickets.filter(t => new Date(t.createdAt).getHours() === hour).length;
      return {
        h: `${hour}:00`,
        n: count
      };
    });

    // Department breakdown
    const dept = services.map(s => {
      const count = completed.filter(t => t.serviceId.toString() === s._id.toString()).length;
      return {
        name: s.name,
        value: count
      };
    }).filter(x => x.value > 0);

    // Staff performance
    const perf = staff.map(st => {
      const servedCount = tickets.filter(t => t.staffId?.toString() === st._id.toString() && t.status === 'COMPLETED').length;
      return {
        name: st.name.split(' ')[0],
        served: servedCount
      };
    });

    // Completion vs cancellation vs skipped
    const completionCounts = [
      { name: 'Completed', value: tickets.filter(t => t.status === 'COMPLETED').length },
      { name: 'Cancelled', value: tickets.filter(t => t.status === 'CANCELLED').length },
      { name: 'Skipped', value: tickets.filter(t => t.status === 'SKIPPED').length }
    ];

    return sendSuccess(res, 'Analytics data', {
      perDay,
      peak,
      dept,
      perf,
      completionCounts,
      totalServed: completed.length
    });
  } catch (err) {
    next(err);
  }
}

// --- Customer Audit ---

export async function getAdminCustomers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const { query } = req.query as Record<string, string>;

    const tickets = await Ticket.find({ organizationId: orgId }).sort({ createdAt: -1 });
    const customerIds = Array.from(new Set(tickets.map(t => t.customerId.toString())));

    let customers = await User.find({ _id: { $in: customerIds } });
    if (query) {
      const q = query.toLowerCase();
      customers = customers.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
    }

    const customerData = customers.map(c => {
      const custTickets = tickets.filter(t => t.customerId.toString() === c._id.toString());
      const hasActive = custTickets.some(t => t.status === 'WAITING' || t.status === 'SERVING' || t.status === 'CALLED');
      const completedCount = custTickets.filter(t => t.status === 'COMPLETED').length;

      return {
        id: c._id.toString(),
        name: c.name,
        email: c.email,
        inQueueNow: hasActive,
        visits: custTickets.length,
        completed: completedCount,
        history: custTickets.slice(0, 15).map(t => t.toJSON())
      };
    });

    return sendSuccess(res, 'Customers retrieved', customerData);
  } catch (err) {
    next(err);
  }
}

// --- Services CRUD ---

export async function getAdminServices(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const services = await Service.find({ organizationId: orgId }).sort({ createdAt: 1 });
    return sendSuccess(res, 'Services list', services.map(s => s.toJSON()));
  } catch (err) {
    next(err);
  }
}

export async function createAdminService(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const { name, avg, cap } = req.body;

    if (!name || !name.trim()) {
      throw new AppError('Service name is required', 400);
    }

    const count = await Service.countDocuments({ organizationId: orgId });
    const prefix = String.fromCharCode(65 + (count % 26));

    const service = await Service.create({
      organizationId: orgId,
      name: name.trim(),
      prefix,
      averageServiceTime: avg ? Number(avg) : 8,
      capacity: cap ? Number(cap) : 50,
      enabled: true,
      open: true
    });

    emitToOrg(orgId.toString(), 'dashboard:updated', { orgId: orgId.toString() });
    return sendSuccess(res, 'Service created successfully', service.toJSON(), 201);
  } catch (err) {
    next(err);
  }
}

export async function updateAdminService(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const { id } = req.params;
    const { name, avg, cap, open, enabled } = req.body;

    const service = await Service.findOne({ _id: id, organizationId: orgId });
    if (!service) {
      throw new NotFoundError('Service not found in your organization');
    }

    if (name !== undefined) service.name = name.trim();
    if (avg !== undefined) service.averageServiceTime = Number(avg);
    if (cap !== undefined) service.capacity = Number(cap);
    if (open !== undefined) service.open = Boolean(open);
    if (enabled !== undefined) service.enabled = Boolean(enabled);

    await service.save();

    emitToOrg(orgId.toString(), 'dashboard:updated', { orgId: orgId.toString() });
    return sendSuccess(res, 'Service updated successfully', service.toJSON());
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminService(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const { id } = req.params;

    const service = await Service.findOne({ _id: id, organizationId: orgId });
    if (!service) {
      throw new NotFoundError('Service not found');
    }

    // Check if there are active tickets
    const activeTickets = await Ticket.countDocuments({
      serviceId: id,
      status: { $in: ['WAITING', 'CALLED', 'SERVING'] }
    });

    if (activeTickets > 0) {
      throw new AppError('Cannot delete service with active tickets in queue. Clear active tokens first.', 400);
    }

    await Service.deleteOne({ _id: id });
    await Counter.updateMany({ organizationId: orgId, serviceId: id }, { $unset: { serviceId: 1 } });
    await User.updateMany({ organizationId: orgId, serviceId: id }, { $unset: { serviceId: 1 } });

    emitToOrg(orgId.toString(), 'dashboard:updated', { orgId: orgId.toString() });
    return sendSuccess(res, 'Service deleted successfully');
  } catch (err) {
    next(err);
  }
}

// --- Counters CRUD ---

export async function getAdminCounters(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const counters = await Counter.find({ organizationId: orgId }).sort({ createdAt: 1 });
    return sendSuccess(res, 'Counters list', counters.map(c => c.toJSON()));
  } catch (err) {
    next(err);
  }
}

export async function createAdminCounter(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const { name, serviceId } = req.body;

    if (!name || !name.trim()) {
      throw new AppError('Counter name is required', 400);
    }

    if (serviceId) {
      const svc = await Service.findOne({ _id: serviceId, organizationId: orgId });
      if (!svc) throw new NotFoundError('Service not found in your organization');
    }

    const counter = await Counter.create({
      organizationId: orgId,
      name: name.trim(),
      serviceId: serviceId || undefined,
      active: true
    });

    return sendSuccess(res, 'Counter created successfully', counter.toJSON(), 201);
  } catch (err) {
    next(err);
  }
}

export async function updateAdminCounter(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const { id } = req.params;
    const { name, serviceId, active, staffId } = req.body;

    const counter = await Counter.findOne({ _id: id, organizationId: orgId });
    if (!counter) {
      throw new NotFoundError('Counter not found');
    }

    if (name !== undefined) counter.name = name.trim();
    if (serviceId !== undefined) counter.serviceId = serviceId ? serviceId : undefined;
    if (active !== undefined) counter.active = Boolean(active);

    await counter.save();

    if (staffId !== undefined) {
      if (staffId) {
        await User.updateOne(
          { _id: staffId, organizationId: orgId, role: 'STAFF' },
          { counterId: counter._id, ...(serviceId ? { serviceId } : {}) }
        );
      }
    }

    return sendSuccess(res, 'Counter updated successfully', counter.toJSON());
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminCounter(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const { id } = req.params;

    const counter = await Counter.findOne({ _id: id, organizationId: orgId });
    if (!counter) {
      throw new NotFoundError('Counter not found');
    }

    await Counter.deleteOne({ _id: id });
    await User.updateMany({ organizationId: orgId, counterId: id }, { $unset: { counterId: 1 } });

    return sendSuccess(res, 'Counter deleted successfully');
  } catch (err) {
    next(err);
  }
}

// --- Staff CRUD ---

export async function getAdminStaff(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const staff = await User.find({ organizationId: orgId, role: 'STAFF' }).sort({ createdAt: 1 });
    return sendSuccess(res, 'Staff list', staff.map(s => s.toJSON()));
  } catch (err) {
    next(err);
  }
}

export async function createAdminStaff(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const { name, email, password, serviceId, counterId } = req.body;

    if (!name || !name.trim()) throw new AppError('Name is required', 400);
    if (!email || !email.trim()) throw new AppError('Email is required', 400);
    if (!password || password.length < 8) throw new AppError('Password must be at least 8 characters', 400);

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw new ConflictError('Email already in use');
    }

    if (serviceId) {
      const svc = await Service.findOne({ _id: serviceId, organizationId: orgId });
      if (!svc) throw new NotFoundError('Service not found in your organization');
    }

    if (counterId) {
      const ctr = await Counter.findOne({ _id: counterId, organizationId: orgId });
      if (!ctr) throw new NotFoundError('Counter not found in your organization');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const staff = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'STAFF',
      organizationId: orgId,
      serviceId: serviceId || undefined,
      counterId: counterId || undefined,
      status: 'ACTIVE'
    });

    return sendSuccess(res, 'Staff created successfully', staff.toJSON(), 201);
  } catch (err) {
    next(err);
  }
}

export async function updateAdminStaff(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const { id } = req.params;
    const { name, email, serviceId, counterId } = req.body;

    const staff = await User.findOne({ _id: id, organizationId: orgId, role: 'STAFF' });
    if (!staff) {
      throw new NotFoundError('Staff account not found');
    }

    if (name !== undefined) staff.name = name.trim();
    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== staff.email) {
        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) throw new ConflictError('Email already in use');
        staff.email = normalizedEmail;
      }
    }
    if (serviceId !== undefined) staff.serviceId = serviceId || undefined;
    if (counterId !== undefined) staff.counterId = counterId || undefined;

    await staff.save();
    return sendSuccess(res, 'Staff updated successfully', staff.toJSON());
  } catch (err) {
    next(err);
  }
}

export async function toggleStaffStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const { id } = req.params;

    const staff = await User.findOne({ _id: id, organizationId: orgId, role: 'STAFF' });
    if (!staff) {
      throw new NotFoundError('Staff account not found');
    }

    staff.status = staff.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    await staff.save();

    return sendSuccess(res, `Staff account ${staff.status === 'ACTIVE' ? 'enabled' : 'disabled'}`, staff.toJSON());
  } catch (err) {
    next(err);
  }
}

export async function resetStaffPassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    const staff = await User.findOne({ _id: id, organizationId: orgId, role: 'STAFF' });
    if (!staff) {
      throw new NotFoundError('Staff account not found');
    }

    staff.passwordHash = await bcrypt.hash(password, 10);
    await staff.save();

    return sendSuccess(res, 'Staff password reset successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminStaff(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const { id } = req.params;

    const staff = await User.findOne({ _id: id, organizationId: orgId, role: 'STAFF' });
    if (!staff) {
      throw new NotFoundError('Staff account not found');
    }

    await User.deleteOne({ _id: id });
    return sendSuccess(res, 'Staff account deleted');
  } catch (err) {
    next(err);
  }
}

// --- Organization Settings ---

export async function getAdminOrg(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const org = await Organization.findById(orgId);
    if (!org) throw new NotFoundError('Organization not found');

    return sendSuccess(res, 'Organization settings', org.toJSON());
  } catch (err) {
    next(err);
  }
}

export async function updateAdminOrg(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId!;
    const { name, address, city, state, pin, open } = req.body;

    const org = await Organization.findById(orgId);
    if (!org) throw new NotFoundError('Organization not found');

    if (name !== undefined) org.name = name.trim();
    if (address !== undefined) org.address = address.trim();
    if (city !== undefined) org.city = city.trim();
    if (state !== undefined) org.state = state.trim();
    if (pin !== undefined) org.pin = pin.trim();
    if (open !== undefined) org.open = Boolean(open);

    await org.save();

    emitToOrg(orgId.toString(), 'dashboard:updated', { orgId: orgId.toString() });
    return sendSuccess(res, 'Organization settings updated', org.toJSON());
  } catch (err) {
    next(err);
  }
}

export async function resetDemoData(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    await seedDatabase(true);
    return sendSuccess(res, 'Demo data reset successfully');
  } catch (err) {
    next(err);
  }
}
