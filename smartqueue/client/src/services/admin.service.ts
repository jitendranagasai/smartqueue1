import { api } from './api';
import { Service } from './organization.service';

export interface Counter {
  id: string;
  orgId: string;
  name: string;
  serviceId: string;
  active: boolean;
}

export const adminService = {
  async getDashboard(): Promise<any> {
    return api.get('/admin/dashboard');
  },

  async getAnalytics(): Promise<any> {
    return api.get('/admin/analytics');
  },

  async getCustomers(query?: string): Promise<any[]> {
    const q = query ? `?query=${encodeURIComponent(query)}` : '';
    return api.get(`/admin/customers${q}`);
  },

  // Services
  async getServices(): Promise<Service[]> {
    return api.get<Service[]>('/admin/services');
  },

  async createService(data: Partial<Service>): Promise<Service> {
    return api.post<Service>('/admin/services', data);
  },

  async updateService(id: string, data: Partial<Service>): Promise<Service> {
    return api.put<Service>(`/admin/services/${id}`, data);
  },

  async deleteService(id: string): Promise<void> {
    return api.delete(`/admin/services/${id}`);
  },

  // Counters
  async getCounters(): Promise<Counter[]> {
    return api.get<Counter[]>('/admin/counters');
  },

  async createCounter(data: Partial<Counter>): Promise<Counter> {
    return api.post<Counter>('/admin/counters', data);
  },

  async updateCounter(id: string, data: Partial<Counter>): Promise<Counter> {
    return api.put<Counter>(`/admin/counters/${id}`, data);
  },

  async deleteCounter(id: string): Promise<void> {
    return api.delete(`/admin/counters/${id}`);
  },

  // Staff
  async getStaff(): Promise<any[]> {
    return api.get<any[]>('/admin/staff');
  },

  async createStaff(data: any): Promise<any> {
    return api.post('/admin/staff', data);
  },

  async updateStaff(id: string, data: any): Promise<any> {
    return api.put(`/admin/staff/${id}`, data);
  },

  async toggleStaffStatus(id: string): Promise<any> {
    return api.patch(`/admin/staff/${id}/status`);
  },

  async resetStaffPassword(id: string, passwordCandidate: string): Promise<any> {
    return api.patch(`/admin/staff/${id}/reset-password`, { password: passwordCandidate });
  },

  async deleteStaff(id: string): Promise<void> {
    return api.delete(`/admin/staff/${id}`);
  },

  // Organization
  async getOrganization(): Promise<any> {
    return api.get('/admin/organization');
  },

  async updateOrganization(data: any): Promise<any> {
    return api.put('/admin/organization', data);
  },

  async resetDemo(): Promise<void> {
    return api.post('/admin/reset-demo');
  }
};
