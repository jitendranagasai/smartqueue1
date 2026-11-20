import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { QueueEngine } from '../services/queueEngine.js';
import { Ticket, Service, Counter, Organization, User } from '../models/index.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/errors.js';
import { getOperatingDateKey } from '../utils/constants.js';

export async function getStaffDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const staff = req.user!;
    if (!staff.serviceId) {
      return sendSuccess(res, 'Staff dashboard', {
        hasService: false,
        message: 'No service assigned yet. Ask your admin to assign a department and counter.'
      });
    }

    const dateKey = getOperatingDateKey();
    const service = await Service.findById(staff.serviceId);
    const counter = staff.counterId ? await Counter.findById(staff.counterId) : null;
    const org = await Organization.findById(staff.organizationId);

    // Today's tickets for staff's service
    const [waitingCount, currentTicket, completedTickets] = await Promise.all([
      Ticket.countDocuments({ serviceId: staff.serviceId, dateKey, status: 'WAITING' }),
      Ticket.findOne({
        staffId: staff._id,
        dateKey,
        status: { $in: ['SERVING', 'CALLED'] }
      }).populate('customerId', 'name email'),
      Ticket.find({
        staffId: staff._id,
        dateKey,
        status: 'COMPLETED'
      })
    ]);

    // Calculate staff's average service time in minutes
    let avgServiceTime = 0;
    const timedTickets = completedTickets.filter(t => t.calledAt && t.completedAt);
    if (timedTickets.length > 0) {
      const totalTime = timedTickets.reduce((acc, t) => {
        return acc + (t.completedAt!.getTime() - t.calledAt!.getTime()) / 6e4;
      }, 0);
      avgServiceTime = Math.round((totalTime / timedTickets.length) * 10) / 10;
    }

    return sendSuccess(res, 'Staff dashboard data', {
      hasService: true,
      service: service ? service.toJSON() : null,
      counter: counter ? counter.toJSON() : null,
      organization: org ? org.toJSON() : null,
      waitingCount,
      currentTicket: currentTicket ? currentTicket.toJSON() : null,
      servedTodayCount: completedTickets.length,
      averageServiceTime: avgServiceTime
    });
  } catch (err) {
    next(err);
  }
}

export async function getStaffQueue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const staff = req.user!;
    if (!staff.serviceId) {
      return sendSuccess(res, 'Queue retrieved', { rows: [], current: null, waiting: [] });
    }

    const dateKey = getOperatingDateKey();

    const [currentTicket, waitingTickets] = await Promise.all([
      Ticket.findOne({
        staffId: staff._id,
        dateKey,
        status: { $in: ['SERVING', 'CALLED'] }
      }).populate('customerId', 'name email'),
      Ticket.find({
        serviceId: staff.serviceId,
        dateKey,
        status: 'WAITING'
      })
        .sort({ sequenceNumber: 1 })
        .populate('customerId', 'name email')
    ]);

    const rows = [
      ...(currentTicket ? [currentTicket.toJSON()] : []),
      ...waitingTickets.map(t => t.toJSON())
    ];

    return sendSuccess(res, 'Queue retrieved', {
      current: currentTicket ? currentTicket.toJSON() : null,
      waiting: waitingTickets.map(t => t.toJSON()),
      rows
    });
  } catch (err) {
    next(err);
  }
}

export async function getCurrentTicket(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const staff = req.user!;
    const dateKey = getOperatingDateKey();

    const current = await Ticket.findOne({
      staffId: staff._id,
      dateKey,
      status: { $in: ['SERVING', 'CALLED'] }
    }).populate('customerId', 'name email');

    return sendSuccess(res, 'Current ticket', current ? current.toJSON() : null);
  } catch (err) {
    next(err);
  }
}

export async function callNext(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const ticket = await QueueEngine.callNextTicket(req.user);
    return sendSuccess(res, 'Customer called', ticket);
  } catch (err) {
    next(err);
  }
}

export async function callTicket(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { ticketId } = req.params;
    const ticket = await QueueEngine.callSpecificTicket(ticketId, req.user);
    return sendSuccess(res, 'Customer called', ticket);
  } catch (err) {
    next(err);
  }
}

export async function recallTicket(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { ticketId } = req.params;
    const ticket = await QueueEngine.recallTicket(ticketId, req.user);
    return sendSuccess(res, 'Customer notified again', ticket);
  } catch (err) {
    next(err);
  }
}

export async function skipTicket(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { ticketId } = req.params;
    const ticket = await QueueEngine.skipTicket(ticketId, req.user);
    return sendSuccess(res, 'Token skipped', ticket);
  } catch (err) {
    next(err);
  }
}

export async function completeTicket(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { ticketId } = req.params;
    const ticket = await QueueEngine.completeTicket(ticketId, req.user);
    return sendSuccess(res, 'Token completed', ticket);
  } catch (err) {
    next(err);
  }
}
