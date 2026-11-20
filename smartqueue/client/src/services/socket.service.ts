import { io, Socket } from 'socket.io-client';
import { getAuthToken } from './api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  public connect(): Socket {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    const token = getAuthToken();

    this.socket = io(SOCKET_URL, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      // Re-register any event handlers on reconnect
      this.listeners.forEach((callbacks, event) => {
        callbacks.forEach(cb => {
          this.socket?.off(event, cb);
          this.socket?.on(event, cb);
        });
      });
    });

    return this.socket;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public joinOrganization(orgId: string): void {
    this.connect().emit('join:organization', orgId);
  }

  public joinService(serviceId: string): void {
    this.connect().emit('join:service', serviceId);
  }

  public leaveService(serviceId: string): void {
    this.connect().emit('leave:service', serviceId);
  }

  public on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    const s = this.connect();
    s.on(event, callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
      s.off(event, callback);
    };
  }
}

export const socketService = new SocketService();
