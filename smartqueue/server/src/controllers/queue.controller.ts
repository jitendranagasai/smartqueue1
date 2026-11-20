import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { QueueEngine } from '../services/queueEngine.js';
import { Ticket, Organization, Service, Counter } from '../models/index.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

export async function joinQueue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { orgId, serviceId } = req.body;
    const customerId = req.user!._id.toString();

    const result = await QueueEngine.joinQueue({
      customerId,
      orgId,
      serviceId
    });

    return sendSuccess(res, 'Token generated successfully', result, 201);
  } catch (err) {
    next(err);
  }
}

export async function getMyTickets(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const customerId = req.user!._id;
    const tickets = await Ticket.find({ customerId })
      .sort({ createdAt: -1 })
      .populate('organizationId', 'name code city address')
      .populate('serviceId', 'name prefix averageServiceTime')
      .populate('counterId', 'name');

    const formatted = await Promise.all(
      tickets.map(async t => {
        const json: any = t.toJSON();
        if (json.status === 'WAITING' || json.status === 'SERVING' || json.status === 'CALLED') {
          const position = await QueueEngine.getTicketPosition(t._id.toString());
          json.position = position;
        }
        return json;
      })
    );

    return sendSuccess(res, 'My tickets retrieved', formatted);
  } catch (err) {
    next(err);
  }
}

export async function getTicketById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findById(id)
      .populate('organizationId', 'name code city')
      .populate('serviceId', 'name prefix averageServiceTime')
      .populate('counterId', 'name');

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Role-based authorization check
    if (req.user!.role === 'CUSTOMER' && ticket.customerId.toString() !== req.user!._id.toString()) {
      throw new ForbiddenError('Unauthorized to view this ticket');
    }
    if (req.user!.role === 'STAFF' && ticket.organizationId.toString() !== req.user!.organizationId?.toString()) {
      throw new ForbiddenError('Unauthorized to view this ticket');
    }
    if (req.user!.role === 'ADMIN' && ticket.organizationId.toString() !== req.user!.organizationId?.toString()) {
      throw new ForbiddenError('Unauthorized to view this ticket');
    }

    const json = ticket.toJSON();
    const position = await QueueEngine.getTicketPosition(ticket._id.toString());

    return sendSuccess(res, 'Ticket details', {
      ...json,
      position
    });
  } catch (err) {
    next(err);
  }
}

export async function getTicketPosition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const customerId = req.user!.role === 'CUSTOMER' ? req.user!._id.toString() : undefined;
    const position = await QueueEngine.getTicketPosition(id, customerId);

    return sendSuccess(res, 'Ticket position', position);
  } catch (err) {
    next(err);
  }
}

export async function cancelTicket(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const customerId = req.user!._id.toString();

    const cancelled = await QueueEngine.cancelTicket(id, customerId);
    return sendSuccess(res, 'Ticket cancelled successfully', cancelled);
  } catch (err) {
    next(err);
  }
}
