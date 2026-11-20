import { api } from './api';
import { Ticket } from './queue.service';

export const staffService = {
  async getDashboard(): Promise<any> {
    return api.get('/staff/dashboard');
  },

  async getQueue(): Promise<{ current: Ticket | null; waiting: Ticket[]; rows: Ticket[] }> {
    return api.get('/staff/queue');
  },

  async getCurrentTicket(): Promise<Ticket | null> {
    return api.get('/staff/current-ticket');
  },

  async callNext(): Promise<Ticket> {
    return api.post('/staff/next');
  },

  async callTicket(ticketId: string): Promise<Ticket> {
    return api.post(`/staff/${ticketId}/call`);
  },

  async recall(ticketId?: string): Promise<Ticket> {
    return api.post(ticketId ? `/staff/${ticketId}/recall` : '/staff/recall');
  },

  async skip(ticketId?: string): Promise<Ticket> {
    return api.post(ticketId ? `/staff/${ticketId}/skip` : '/staff/skip');
  },

  async complete(ticketId?: string): Promise<Ticket> {
    return api.post(ticketId ? `/staff/${ticketId}/complete` : '/staff/complete');
  }
};
