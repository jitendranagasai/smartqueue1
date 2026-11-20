import { Request, Response, NextFunction } from 'express';
import { Organization, Service, Counter, Ticket } from '../models/index.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError } from '../utils/errors.js';
import { getOperatingDateKey } from '../utils/constants.js';

export async function getOrganizations(req: Request, res: Response, next: NextFunction) {
  try {
    const { type, city, query, code } = req.query as Record<string, string>;

    const filter: any = {};
    if (type) filter.type = type;
    if (city) filter.city = new RegExp(city.trim(), 'i');
    if (code) filter.code = code.trim().toUpperCase();
    if (query) {
      const q = query.trim();
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { city: new RegExp(q, 'i') },
        { address: new RegExp(q, 'i') },
        { pin: new RegExp(q, 'i') },
        { code: q.toUpperCase() }
      ];
    }

    const orgs = await Organization.find(filter).sort({ name: 1 });
    const dateKey = getOperatingDateKey();

    // Fetch live summary stats for each organization
    const orgsWithStats = await Promise.all(
      orgs.map(async org => {
        const json = org.toJSON();
        const services = await Service.find({ organizationId: org._id, enabled: true });
        const serviceIds = services.map(s => s._id);

        const waitingCount = await Ticket.countDocuments({
          serviceId: { $in: serviceIds },
          dateKey,
          status: 'WAITING'
        });

        const activeCountersCount = await Counter.countDocuments({
          organizationId: org._id,
          active: true
        });

        const avgWait = services.length
          ? services.reduce((acc, s) => acc + s.averageServiceTime, 0) / services.length
          : 5;

        const divisor = Math.max(1, activeCountersCount);
        const estWait = Math.round((waitingCount * avgWait) / divisor);

        return {
          ...json,
          stats: {
            waiting: waitingCount,
            wait: estWait,
            services: services.length
          }
        };
      })
    );

    return sendSuccess(res, 'Organizations retrieved successfully', orgsWithStats);
  } catch (err) {
    next(err);
  }
}

export async function getOrganizationById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const org = await Organization.findById(id);
    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    const dateKey = getOperatingDateKey();
    const services = await Service.find({ organizationId: org._id, enabled: true });
    const serviceIds = services.map(s => s._id);

    const waitingCount = await Ticket.countDocuments({
      serviceId: { $in: serviceIds },
      dateKey,
      status: 'WAITING'
    });

    const activeCountersCount = await Counter.countDocuments({
      organizationId: org._id,
      active: true
    });

    const avgWait = services.length
      ? services.reduce((acc, s) => acc + s.averageServiceTime, 0) / services.length
      : 5;

    const divisor = Math.max(1, activeCountersCount);
    const estWait = Math.round((waitingCount * avgWait) / divisor);

    const json = org.toJSON();
    return sendSuccess(res, 'Organization details', {
      ...json,
      stats: {
        waiting: waitingCount,
        wait: estWait,
        services: services.length
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getOrganizationServices(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const dateKey = getOperatingDateKey();

    const services = await Service.find({ organizationId: id }).sort({ createdAt: 1 });

    const servicesWithQueue = await Promise.all(
      services.map(async s => {
        const json = s.toJSON();
        const waitingCount = await Ticket.countDocuments({
          serviceId: s._id,
          dateKey,
          status: 'WAITING'
        });

        const currentServing = await Ticket.findOne({
          serviceId: s._id,
          dateKey,
          status: { $in: ['SERVING', 'CALLED'] }
        }).sort({ calledAt: -1 });

        return {
          ...json,
          waitingCount,
          currentServingToken: currentServing?.token || '—'
        };
      })
    );

    return sendSuccess(res, 'Services retrieved successfully', servicesWithQueue);
  } catch (err) {
    next(err);
  }
}
