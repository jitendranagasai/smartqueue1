import { Types } from 'mongoose';
import {
  Ticket,
  Service,
  Organization,
  Counter,
  QueueSequence,
  Notification,
  User,
  ITicket
} from '../models/index.js';
import { AppError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { getOperatingDateKey, getTodayMidnight } from '../utils/constants.js';
import {
  emitToService,
  emitToOrg,
  emitToUser
} from '../sockets/socketManager.js';

export class QueueEngine {
  /**
   * Customer joins a queue atomically and safely
   */
  public static async joinQueue(params: {
    customerId: string;
    orgId: string;
    serviceId: string;
  }) {
    const { customerId, orgId, serviceId } = params;

    const org = await Organization.findById(orgId);
    if (!org) {
      throw new NotFoundError('Organization not found');
    }
    if (!org.open) {
      throw new AppError('This organization is currently closed', 400);
    }

    const service = await Service.findOne({ _id: serviceId, organizationId: orgId });
    if (!service) {
      throw new NotFoundError('Service not found in this organization');
    }
    if (!service.enabled || !service.open) {
      throw new AppError('This queue is currently closed', 400);
    }

    const dateKey = getOperatingDateKey();

    // Check if customer already has an active ticket for this service today
    const existingActive = await Ticket.findOne({
      customerId: new Types.ObjectId(customerId),
      serviceId: service._id,
      dateKey,
      status: { $in: ['WAITING', 'CALLED', 'SERVING'] }
    });

    if (existingActive) {
      throw new AppError('You are already in this queue', 400);
    }

    // Check capacity against current waiting tickets
    const waitingCount = await Ticket.countDocuments({
      serviceId: service._id,
      dateKey,
      status: 'WAITING'
    });

    if (waitingCount >= service.capacity) {
      throw new AppError('This queue is currently full to capacity', 400);
    }

    // Atomic sequence allocation - lock-free and race-condition proof
    const seqDoc = await QueueSequence.findOneAndUpdate(
      { serviceId: service._id, dateKey },
      {
        $inc: { lastSequenceNumber: 1 },
        $setOnInsert: { organizationId: org._id }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    const sequenceNumber = seqDoc.lastSequenceNumber;
    const token = `${service.prefix}-${String(sequenceNumber).padStart(3, '0')}`;

    // Create the ticket
    const ticket = await Ticket.create({
      organizationId: org._id,
      serviceId: service._id,
      customerId: new Types.ObjectId(customerId),
      token,
      sequenceNumber,
      dateKey,
      status: 'WAITING'
    });

    // Notify customer
    const notifMsg = `You joined ${service.name} at ${org.name}. Your token is ${token}.`;
    await Notification.create({
      userId: new Types.ObjectId(customerId),
      organizationId: org._id,
      message: notifMsg
    });

    // Real-time broadcasts
    emitToUser(customerId, 'ticket:created', ticket.toJSON());
    emitToUser(customerId, 'notification:new', { message: notifMsg, ts: Date.now() });
    emitToService(serviceId, 'queue:updated', { serviceId, token, action: 'joined' });
    emitToOrg(orgId, 'dashboard:updated', { orgId });

    const position = await this.getTicketPosition(ticket._id.toString(), customerId);

    return {
      ticket: ticket.toJSON(),
      position
    };
  }

  /**
   * Calculate live ticket position, people ahead, and estimated wait
   */
  public static async getTicketPosition(ticketId: string, customerId?: string) {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    if (customerId && ticket.customerId.toString() !== customerId) {
      throw new ForbiddenError('Unauthorized ticket access');
    }

    const service = await Service.findById(ticket.serviceId);
    const dateKey = ticket.dateKey;

    let aheadCount = 0;
    if (ticket.status === 'WAITING') {
      aheadCount = await Ticket.countDocuments({
        serviceId: ticket.serviceId,
        dateKey,
        status: 'WAITING',
        sequenceNumber: { $lt: ticket.sequenceNumber }
      });
    }

    // Latest serving ticket
    const currentServing = await Ticket.findOne({
      serviceId: ticket.serviceId,
      dateKey,
      status: { $in: ['SERVING', 'CALLED'] }
    }).sort({ calledAt: -1 });

    // Active counters for this service
    const activeCounters = await Counter.countDocuments({
      serviceId: ticket.serviceId,
      active: true
    });

    const divisor = Math.max(1, activeCounters);
    const avgServiceTime = service?.averageServiceTime || 8;
    const estimatedWaitMinutes = ticket.status === 'WAITING'
      ? Math.round(((aheadCount + 1) * avgServiceTime) / divisor)
      : 0;

    return {
      ticketId: ticket._id.toString(),
      token: ticket.token,
      status: ticket.status,
      sequenceNumber: ticket.sequenceNumber,
      currentServingToken: currentServing?.token || '—',
      ahead: aheadCount,
      estimatedWaitMinutes,
      activeCounters: divisor
    };
  }

  /**
   * Customer cancels their own waiting ticket
   */
  public static async cancelTicket(ticketId: string, customerId: string) {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    if (ticket.customerId.toString() !== customerId) {
      throw new ForbiddenError('You can only cancel your own ticket');
    }

    if (ticket.status !== 'WAITING') {
      throw new AppError(`Cannot cancel a ticket that is already ${ticket.status.toLowerCase()}`, 400);
    }

    ticket.status = 'CANCELLED';
    ticket.completedAt = new Date();
    await ticket.save();

    emitToUser(customerId, 'ticket:cancelled', { ticketId });
    emitToService(ticket.serviceId.toString(), 'queue:updated', {
      serviceId: ticket.serviceId.toString(),
      action: 'cancelled',
      ticketId
    });
    emitToOrg(ticket.organizationId.toString(), 'dashboard:updated', { orgId: ticket.organizationId.toString() });

    return ticket.toJSON();
  }

  /**
   * Staff calls the next waiting ticket atomically
   */
  public static async callNextTicket(staffUser: any) {
    if (!staffUser.serviceId) {
      throw new AppError('No service assigned to your staff account', 400);
    }

    const dateKey = getOperatingDateKey();

    // Check if staff currently has an unresolved ticket
    const activeCurrent = await Ticket.findOne({
      staffId: staffUser._id,
      dateKey,
      status: { $in: ['SERVING', 'CALLED'] }
    });

    if (activeCurrent) {
      throw new AppError('Complete or skip the current token before calling the next customer', 400);
    }

    // Atomic claim of next ticket
    const nextTicket = await Ticket.findOneAndUpdate(
      {
        serviceId: staffUser.serviceId,
        dateKey,
        status: 'WAITING'
      },
      {
        $set: {
          status: 'SERVING',
          staffId: staffUser._id,
          counterId: staffUser.counterId,
          calledAt: new Date()
        }
      },
      {
        sort: { sequenceNumber: 1 },
        new: true
      }
    );

    if (!nextTicket) {
      throw new AppError('No waiting customers in this queue', 400);
    }

    const counter = staffUser.counterId ? await Counter.findById(staffUser.counterId) : null;
    const counterName = counter?.name || 'the counter';

    // Notify called customer
    const msg = `Please proceed to ${counterName}. Token ${nextTicket.token} is now being served.`;
    await Notification.create({
      userId: nextTicket.customerId,
      organizationId: staffUser.organizationId,
      message: msg
    });
    emitToUser(nextTicket.customerId.toString(), 'ticket:called', nextTicket.toJSON());
    emitToUser(nextTicket.customerId.toString(), 'notification:new', { message: msg, ts: Date.now() });

    // Notify upcoming customers
    const upcoming = await Ticket.find({
      serviceId: staffUser.serviceId,
      dateKey,
      status: 'WAITING'
    }).sort({ sequenceNumber: 1 }).limit(2);

    if (upcoming[0]) {
      const upMsg = `Token ${upcoming[0].token} is next. Please be ready.`;
      await Notification.create({
        userId: upcoming[0].customerId,
        organizationId: staffUser.organizationId,
        message: upMsg
      });
      emitToUser(upcoming[0].customerId.toString(), 'notification:new', { message: upMsg, ts: Date.now() });
    }

    if (upcoming[1]) {
      const upMsg2 = `Your token ${upcoming[1].token} is approaching.`;
      await Notification.create({
        userId: upcoming[1].customerId,
        organizationId: staffUser.organizationId,
        message: upMsg2
      });
      emitToUser(upcoming[1].customerId.toString(), 'notification:new', { message: upMsg2, ts: Date.now() });
    }

    emitToService(staffUser.serviceId.toString(), 'queue:updated', {
      serviceId: staffUser.serviceId.toString(),
      action: 'called',
      ticket: nextTicket.toJSON()
    });
    emitToOrg(staffUser.organizationId.toString(), 'dashboard:updated', { orgId: staffUser.organizationId.toString() });

    return nextTicket.toJSON();
  }

  /**
   * Staff calls a specific waiting ticket
   */
  public static async callSpecificTicket(ticketId: string, staffUser: any) {
    if (!staffUser.serviceId) {
      throw new AppError('No service assigned to your staff account', 400);
    }

    const dateKey = getOperatingDateKey();

    // Check if staff has active ticket
    const activeCurrent = await Ticket.findOne({
      staffId: staffUser._id,
      dateKey,
      status: { $in: ['SERVING', 'CALLED'] }
    });

    if (activeCurrent) {
      throw new AppError('Complete or skip the current token before calling another customer', 400);
    }

    const ticket = await Ticket.findOneAndUpdate(
      {
        _id: ticketId,
        serviceId: staffUser.serviceId,
        dateKey,
        status: 'WAITING'
      },
      {
        $set: {
          status: 'SERVING',
          staffId: staffUser._id,
          counterId: staffUser.counterId,
          calledAt: new Date()
        }
      },
      { new: true }
    );

    if (!ticket) {
      throw new AppError('Ticket is no longer waiting or not found', 400);
    }

    const counter = staffUser.counterId ? await Counter.findById(staffUser.counterId) : null;
    const counterName = counter?.name || 'the counter';

    const msg = `Please proceed to ${counterName}. Token ${ticket.token} is now being served.`;
    await Notification.create({
      userId: ticket.customerId,
      organizationId: staffUser.organizationId,
      message: msg
    });

    emitToUser(ticket.customerId.toString(), 'ticket:called', ticket.toJSON());
    emitToUser(ticket.customerId.toString(), 'notification:new', { message: msg, ts: Date.now() });
    emitToService(staffUser.serviceId.toString(), 'queue:updated', {
      serviceId: staffUser.serviceId.toString(),
      action: 'called',
      ticket: ticket.toJSON()
    });
    emitToOrg(staffUser.organizationId.toString(), 'dashboard:updated', { orgId: staffUser.organizationId.toString() });

    return ticket.toJSON();
  }

  /**
   * Staff recalls current customer
   */
  public static async recallTicket(ticketId: string | undefined, staffUser: any) {
    const dateKey = getOperatingDateKey();
    const query: any = {
      staffId: staffUser._id,
      dateKey,
      status: { $in: ['SERVING', 'CALLED'] }
    };
    if (ticketId) query._id = ticketId;

    const ticket = await Ticket.findOne(query);
    if (!ticket) {
      throw new AppError('No active token to recall', 400);
    }

    const counter = staffUser.counterId ? await Counter.findById(staffUser.counterId) : null;
    const counterName = counter?.name || 'the counter';

    const msg = `Calling ${ticket.token} again — please proceed to ${counterName}.`;
    await Notification.create({
      userId: ticket.customerId,
      organizationId: staffUser.organizationId,
      message: msg
    });

    emitToUser(ticket.customerId.toString(), 'ticket:recalled', ticket.toJSON());
    emitToUser(ticket.customerId.toString(), 'notification:new', { message: msg, ts: Date.now() });

    return ticket.toJSON();
  }

  /**
   * Staff skips current customer
   */
  public static async skipTicket(ticketId: string | undefined, staffUser: any) {
    const dateKey = getOperatingDateKey();
    const query: any = {
      staffId: staffUser._id,
      dateKey,
      status: { $in: ['SERVING', 'CALLED'] }
    };
    if (ticketId) query._id = ticketId;

    const ticket = await Ticket.findOne(query);
    if (!ticket) {
      throw new AppError('No active token to skip', 400);
    }

    ticket.status = 'SKIPPED';
    ticket.completedAt = new Date();
    await ticket.save();

    const msg = `Token ${ticket.token} was skipped because you were not present.`;
    await Notification.create({
      userId: ticket.customerId,
      organizationId: staffUser.organizationId,
      message: msg
    });

    emitToUser(ticket.customerId.toString(), 'ticket:skipped', ticket.toJSON());
    emitToUser(ticket.customerId.toString(), 'notification:new', { message: msg, ts: Date.now() });
    emitToService(staffUser.serviceId.toString(), 'queue:updated', {
      serviceId: staffUser.serviceId.toString(),
      action: 'skipped',
      ticket: ticket.toJSON()
    });
    emitToOrg(staffUser.organizationId.toString(), 'dashboard:updated', { orgId: staffUser.organizationId.toString() });

    return ticket.toJSON();
  }

  /**
   * Staff completes current customer ticket
   */
  public static async completeTicket(ticketId: string | undefined, staffUser: any) {
    const dateKey = getOperatingDateKey();
    const query: any = {
      staffId: staffUser._id,
      dateKey,
      status: { $in: ['SERVING', 'CALLED'] }
    };
    if (ticketId) query._id = ticketId;

    const ticket = await Ticket.findOne(query);
    if (!ticket) {
      throw new AppError('No active token to complete', 400);
    }

    ticket.status = 'COMPLETED';
    ticket.completedAt = new Date();
    await ticket.save();

    const msg = `Your token ${ticket.token} has been completed. Thank you!`;
    await Notification.create({
      userId: ticket.customerId,
      organizationId: staffUser.organizationId,
      message: msg
    });

    emitToUser(ticket.customerId.toString(), 'ticket:completed', ticket.toJSON());
    emitToUser(ticket.customerId.toString(), 'notification:new', { message: msg, ts: Date.now() });
    emitToService(staffUser.serviceId.toString(), 'queue:updated', {
      serviceId: staffUser.serviceId.toString(),
      action: 'completed',
      ticket: ticket.toJSON()
    });
    emitToOrg(staffUser.organizationId.toString(), 'dashboard:updated', { orgId: staffUser.organizationId.toString() });

    return ticket.toJSON();
  }

  /**
   * Fetch current state of a service queue
   */
  public static async getServiceQueueState(serviceId: string, orgId: string) {
    const dateKey = getOperatingDateKey();

    const [waitingTickets, servingTickets, completedCount] = await Promise.all([
      Ticket.find({ serviceId, dateKey, status: 'WAITING' }).sort({ sequenceNumber: 1 }),
      Ticket.find({ serviceId, dateKey, status: { $in: ['SERVING', 'CALLED'] } }),
      Ticket.countDocuments({ serviceId, dateKey, status: 'COMPLETED' })
    ]);

    return {
      serviceId,
      orgId,
      dateKey,
      waiting: waitingTickets.map(t => t.toJSON()),
      serving: servingTickets.map(t => t.toJSON()),
      completedCount,
      currentServingToken: servingTickets[0]?.token || '—'
    };
  }
}
