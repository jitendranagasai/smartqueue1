import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config/environment.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.routes.js';
import { organizationRouter } from './routes/organization.routes.js';
import { queueRouter } from './routes/queue.routes.js';
import { notificationRouter } from './routes/notification.routes.js';
import { staffRouter } from './routes/staff.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { sendSuccess } from './utils/response.js';
import { NotFoundError } from './utils/errors.js';

import path from 'path';
import fs from 'fs';

export const app = express();

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        config.clientUrl,
        'http://localhost:5173',
        'http://127.0.0.1:5173'
      ];
      if (allowedOrigins.includes(origin) || config.nodeEnv !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser(config.cookieSecret));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.nodeEnv === 'development' ? 5000 : 500,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', apiLimiter);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  return sendSuccess(res, 'SmartQueue API is healthy and operational', {
    status: 'UP',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/organizations', organizationRouter);
app.use('/api/queues', queueRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/staff', staffRouter);
app.use('/api/admin', adminRouter);

// Serve frontend production build if present
const possibleDistPaths = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(process.cwd(), 'smartqueue/client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), 'dist/client')
];
const distPath = possibleDistPaths.find(p => fs.existsSync(p));

if (distPath) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// 404 handler for undefined API routes
app.all('*', (req, _res, next) => {
  next(new NotFoundError(`Endpoint not found: ${req.method} ${req.originalUrl}`));
});

// Global error handler
app.use(errorHandler);
