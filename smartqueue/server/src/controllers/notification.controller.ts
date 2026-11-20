import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { Notification } from '../models/Notification.js';
import { sendSuccess } from '../utils/response.js';

export async function getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!._id;
    const notifs = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(50);
    return sendSuccess(res, 'Notifications retrieved', notifs.map(n => n.toJSON()));
  } catch (err) {
    next(err);
  }
}

export async function markNotificationsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!._id;
    await Notification.updateMany({ userId, read: false }, { $set: { read: true } });
    return sendSuccess(res, 'Notifications marked as read');
  } catch (err) {
    next(err);
  }
}

export async function clearNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!._id;
    await Notification.deleteMany({ userId });
    return sendSuccess(res, 'Notifications cleared successfully');
  } catch (err) {
    next(err);
  }
}
