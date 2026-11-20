import { api } from './api';

export type Status = 'WAITING' | 'CALLED' | 'SERVING' | 'COMPLETED' | 'SKIPPED' | 'CANCELLED';

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
  position?: {
    ahead: number;
    estimatedWaitMinutes: number;
    currentServingToken: string;
  };
}

export const queueService = {
  async joinQueue(orgId: string, serviceId: string): Promise<{ ticket: Ticket; position: any }> {
    return api.post('/queues/join', { orgId, serviceId });
  },

  async getMyTickets(): Promise<Ticket[]> {
    return api.get<Ticket[]>('/queues/my-tickets');
  },

  async getTicketById(id: string): Promise<Ticket> {
    return api.get<Ticket>(`/queues/tickets/${id}`);
  },

  async getTicketPosition(id: string): Promise<any> {
    return api.get(`/queues/tickets/${id}/position`);
  },

  async cancelTicket(id: string): Promise<Ticket> {
    return api.delete<Ticket>(`/queues/tickets/${id}`);
  }
};
