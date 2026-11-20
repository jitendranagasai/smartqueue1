import { Router } from 'express';
import {
  getNotifications,
  markNotificationsRead,
  clearNotifications
} from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.js';

export const notificationRouter = Router();

notificationRouter.get('/', authenticate, getNotifications);
notificationRouter.patch('/read', authenticate, markNotificationsRead);
notificationRouter.delete('/', authenticate, clearNotifications);
