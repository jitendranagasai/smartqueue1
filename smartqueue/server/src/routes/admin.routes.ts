import { Router } from 'express';
import {
  getAdminDashboard,
  getAdminAnalytics,
  getAdminCustomers,
  getAdminServices,
  createAdminService,
  updateAdminService,
  deleteAdminService,
  getAdminCounters,
  createAdminCounter,
  updateAdminCounter,
  deleteAdminCounter,
  getAdminStaff,
  createAdminStaff,
  updateAdminStaff,
  toggleStaffStatus,
  resetStaffPassword,
  deleteAdminStaff,
  getAdminOrg,
  updateAdminOrg,
  resetDemoData
} from '../controllers/admin.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

export const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);

// Dashboard & Analytics
adminRouter.get('/dashboard', getAdminDashboard);
adminRouter.get('/statistics', getAdminAnalytics);
adminRouter.get('/analytics', getAdminAnalytics);
adminRouter.get('/customers', getAdminCustomers);

// Services
adminRouter.get('/services', getAdminServices);
adminRouter.post('/services', createAdminService);
adminRouter.put('/services/:id', updateAdminService);
adminRouter.delete('/services/:id', deleteAdminService);

// Counters
adminRouter.get('/counters', getAdminCounters);
adminRouter.post('/counters', createAdminCounter);
adminRouter.put('/counters/:id', updateAdminCounter);
adminRouter.delete('/counters/:id', deleteAdminCounter);

// Staff
adminRouter.get('/staff', getAdminStaff);
adminRouter.post('/staff', createAdminStaff);
adminRouter.put('/staff/:id', updateAdminStaff);
adminRouter.patch('/staff/:id/status', toggleStaffStatus);
adminRouter.patch('/staff/:id/reset-password', resetStaffPassword);
adminRouter.delete('/staff/:id', deleteAdminStaff);

// Organization Settings
adminRouter.get('/organization', getAdminOrg);
adminRouter.put('/organization', updateAdminOrg);
adminRouter.post('/reset-demo', resetDemoData);
