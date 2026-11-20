import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { app } from './app.js';
import { config } from './config/environment.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initializeSocketIO } from './sockets/socketManager.js';
import { User } from './models/User.js';
import { seedDatabase } from './utils/seed.js';

const server = http.createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: [
      config.clientUrl,
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ],
    credentials: true
  }
});

initializeSocketIO(io);

async function startServer() {
  try {
    console.log('[Server] Connecting to database...');
    await connectDatabase();

    // Auto-seed if database is empty
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[Server] Empty database detected. Seeding initial demo data and accounts...');
      await seedDatabase();
    }

    server.listen(config.port, () => {
      console.log(`===============================================`);
      console.log(`🚀 SmartQueue API Server running on port ${config.port}`);
      console.log(`📡 Socket.IO initialized for real-time queues`);
      console.log(`🌐 Health check: http://localhost:${config.port}/api/health`);
      console.log(`===============================================`);
    });
  } catch (err: any) {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  }
}

// Graceful shutdown handling
function handleShutdown(signal: string) {
  console.log(`[Server] Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log('[Server] HTTP and Socket.IO servers closed.');
    await disconnectDatabase();
    process.exit(0);
  });

  // Force close after 10s if stuck
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

startServer();
