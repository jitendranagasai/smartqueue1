import { Router } from 'express';
import {
  joinQueue,
  getMyTickets,
  getTicketById,
  getTicketPosition,
  cancelTicket
} from '../controllers/queue.controller.js';
import { authenticate, requireCustomer } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { z } from 'zod';

export const queueRouter = Router();

const joinSchema = z.object({
  body: z.object({
    orgId: z.string().min(1, 'Organization ID is required'),
    serviceId: z.string().min(1, 'Service ID is required')
  })
});

queueRouter.post('/join', authenticate, requireCustomer, validateRequest(joinSchema), joinQueue);
queueRouter.get('/my-tickets', authenticate, requireCustomer, getMyTickets);
queueRouter.get('/tickets/:id', authenticate, getTicketById);
queueRouter.get('/tickets/:id/position', authenticate, getTicketPosition);
queueRouter.delete('/tickets/:id', authenticate, requireCustomer, cancelTicket);
