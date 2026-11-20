import { Router } from 'express';
import {
  registerCustomer,
  registerOrganization,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  registerCustomerSchema,
  registerOrgSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from '../validators/auth.validator.js';

export const authRouter = Router();

authRouter.post('/register', validateRequest(registerCustomerSchema), registerCustomer);
authRouter.post('/register-organization', validateRequest(registerOrgSchema), registerOrganization);
authRouter.post('/login', validateRequest(loginSchema), login);
authRouter.post('/logout', logout);
authRouter.get('/me', authenticate, getMe);
authRouter.post('/forgot-password', validateRequest(forgotPasswordSchema), forgotPassword);
authRouter.post('/reset-password', validateRequest(resetPasswordSchema), resetPassword);
