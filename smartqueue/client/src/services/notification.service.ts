import { api } from './api';

export interface Notif {
  id: string;
  userId: string;
  msg: string;
  ts: number;
}

export const notificationService = {
  async getNotifications(): Promise<Notif[]> {
    return api.get<Notif[]>('/notifications');
  },

  async markAsRead(): Promise<void> {
    return api.patch('/notifications/read');
  },

  async clearNotifications(): Promise<void> {
    return api.delete('/notifications');
  }
};
