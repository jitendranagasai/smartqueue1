import { api } from './api';

export interface Org {
  id: string;
  code: string;
  name: string;
  type: string;
  address: string;
  city: string;
  state: string;
  pin: string;
  lat: number;
  lng: number;
  open: boolean;
  email: string;
  stats?: {
    waiting: number;
    wait: number;
    services: number;
  };
}

export interface Service {
  id: string;
  orgId: string;
  name: string;
  prefix: string;
  avg: number;
  enabled: boolean;
  open: boolean;
  cap: number;
  waitingCount?: number;
  currentServingToken?: string;
}

export const organizationService = {
  async getOrganizations(params?: Record<string, string>): Promise<Org[]> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get<Org[]>(`/organizations${qs}`);
  },

  async getOrganizationById(id: string): Promise<Org> {
    return api.get<Org>(`/organizations/${id}`);
  },

  async getOrganizationServices(id: string): Promise<Service[]> {
    return api.get<Service[]>(`/organizations/${id}/services`);
  }
};
