import { Request, Response, NextFunction } from 'express';
import {
  registerCustomerService,
  registerOrgService,
  loginService,
  generatePasswordResetToken,
  resetPasswordWithToken
} from '../services/auth.service.js';
import { sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';
import { config } from '../config/environment.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: (config.nodeEnv === 'production' ? 'none' : 'lax') as any,
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

export async function registerCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const { user, token } = await registerCustomerService(email, password);

    res.cookie('token', token, COOKIE_OPTIONS);
    return sendSuccess(res, 'Account created successfully', { user, token }, 201);
  } catch (err) {
    next(err);
  }
}

export async function registerOrganization(req: Request, res: Response, next: NextFunction) {
  try {
    const { org, admin, token } = await registerOrgService(req.body);

    res.cookie('token', token, COOKIE_OPTIONS);
    return sendSuccess(res, 'Organization registered successfully', { org, admin, token }, 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, remember } = req.body;
    const { user, token } = await loginService(email, password);

    const cookieOpts = remember ? COOKIE_OPTIONS : { ...COOKIE_OPTIONS, maxAge: undefined };
    res.cookie('token', token, cookieOpts);

    return sendSuccess(res, 'Welcome back!', { user, token });
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie('token');
  return sendSuccess(res, 'Logged out successfully');
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  return sendSuccess(res, 'Current session user', { user: req.user });
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    const result = await generatePasswordResetToken(email);
    return sendSuccess(res, result.message, {
      sent: result.sent,
      // If in development/testing, expose reset token to facilitate testing
      devResetToken: config.nodeEnv !== 'production' ? result.resetToken : undefined
    });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, newPassword } = req.body;
    await resetPasswordWithToken(token, newPassword);
    return sendSuccess(res, 'Password has been reset successfully. You may now log in.');
  } catch (err) {
    next(err);
  }
}
