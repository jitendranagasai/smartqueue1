import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';

let ioInstance: SocketIOServer | null = null;

export function initializeSocketIO(io: SocketIOServer) {
  ioInstance = io;

  // Middleware to authenticate socket connections if token provided
  io.use((socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (token) {
        const payload = verifyToken(token);
        (socket as any).user = payload;
      }
    } catch {
      // Allow unauthenticated connection for public queue viewers (e.g. OrgPortal)
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;

    // Auto-join personal user room if authenticated
    if (user?.userId) {
      socket.join(`user:${user.userId}`);
    }

    // Client-to-server: join organization room
    socket.on('join:organization', (orgId: string) => {
      if (orgId) {
        socket.join(`org:${orgId}`);
      }
    });

    // Client-to-server: join service room
    socket.on('join:service', (serviceId: string) => {
      if (serviceId) {
        socket.join(`service:${serviceId}`);
      }
    });

    // Client-to-server: leave service room
    socket.on('leave:service', (serviceId: string) => {
      if (serviceId) {
        socket.leave(`service:${serviceId}`);
      }
    });

    socket.on('disconnect', () => {
      // Cleanup automatically handled by Socket.IO
    });
  });

  return ioInstance;
}

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function emitToService(serviceId: string, event: string, payload: any) {
  if (ioInstance) {
    ioInstance.to(`service:${serviceId}`).emit(event, payload);
  }
}

export function emitToOrg(orgId: string, event: string, payload: any) {
  if (ioInstance) {
    ioInstance.to(`org:${orgId}`).emit(event, payload);
  }
}

export function emitToUser(userId: string, event: string, payload: any) {
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit(event, payload);
  }
}
