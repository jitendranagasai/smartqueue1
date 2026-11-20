import { Router } from 'express';
import {
  getStaffDashboard,
  getStaffQueue,
  getCurrentTicket,
  callNext,
  callTicket,
  recallTicket,
  skipTicket,
  completeTicket
} from '../controllers/staff.controller.js';
import { authenticate, requireStaff } from '../middleware/auth.js';

export const staffRouter = Router();

staffRouter.use(authenticate, requireStaff);

staffRouter.get('/dashboard', getStaffDashboard);
staffRouter.get('/queue', getStaffQueue);
staffRouter.get('/current-ticket', getCurrentTicket);
staffRouter.post('/next', callNext);
staffRouter.post('/:ticketId/call', callTicket);
staffRouter.post('/:ticketId/recall', recallTicket);
staffRouter.post('/recall', recallTicket);
staffRouter.post('/:ticketId/skip', skipTicket);
staffRouter.post('/skip', skipTicket);
staffRouter.post('/:ticketId/complete', completeTicket);
staffRouter.post('/complete', completeTicket);
