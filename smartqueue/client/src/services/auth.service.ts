import { api, setAuthToken, removeAuthToken } from './api';

export interface User {
  id: string;
  email: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  name: string;
  status: 'ACTIVE' | 'DISABLED';
  organizationId?: string;
  orgId?: string;
  serviceId?: string;
  counterId?: string;
  createdAt: number;
}

export const authService = {
  async login(email: string, passwordCandidate: string, remember = false): Promise<User> {
    const res = await api.post<{ user: any; token: string }>('/auth/login', {
      email,
      password: passwordCandidate,
      remember
    });
    if (res.token) {
      setAuthToken(res.token, remember);
    }
    const user = {
      ...res.user,
      orgId: res.user.organizationId || res.user.orgId
    };
    return user;
  },

  async registerCustomer(email: string, password: string, confirmPassword?: string): Promise<User> {
    const res = await api.post<{ user: any; token: string }>('/auth/register', {
      email,
      password,
      confirmPassword
    });
    if (res.token) {
      setAuthToken(res.token, true);
    }
    return {
      ...res.user,
      orgId: res.user.organizationId || res.user.orgId
    };
  },

  async registerOrg(form: any): Promise<any> {
    const res = await api.post<{ org: any; admin: any; token: string }>('/auth/register-organization', form);
    if (res.token) {
      setAuthToken(res.token, true);
    }
    return res.org;
  },

  async getMe(): Promise<User | null> {
    try {
      const res = await api.get<{ user: any }>('/auth/me');
      if (!res?.user) return null;
      return {
        ...res.user,
        orgId: res.user.organizationId || res.user.orgId
      };
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      removeAuthToken();
    }
  },

  async forgotPassword(email: string): Promise<any> {
    return api.post('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, newPassword: string): Promise<any> {
    return api.post('/auth/reset-password', { token, newPassword });
  }
};
