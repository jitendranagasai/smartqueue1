import { Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { User } from '../models/User.js';
import { AuthenticatedRequest, Role } from '../types/index.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    let token: string | undefined;

    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next(new UnauthorizedError('Please log in to continue'));
    }

    const payload = verifyToken(token);
    const user = await User.findById(payload.userId);

    if (!user) {
      return next(new UnauthorizedError('User account not found'));
    }

    if (user.status === 'DISABLED') {
      return next(new ForbiddenError('This account has been disabled'));
    }

    req.user = user as any;
    next();
  } catch (err: any) {
    return next(new UnauthorizedError('Invalid or expired authentication session'));
  }
}

export async function optionalAuthenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      const payload = verifyToken(token);
      const user = await User.findById(payload.userId);
      if (user && user.status === 'ACTIVE') {
        req.user = user as any;
      }
    }
  } catch {
    // Continue unauthenticated
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to access this resource'));
    }
    next();
  };
}

export const requireCustomer = requireRole('CUSTOMER');
export const requireStaff = requireRole('STAFF');
export const requireAdmin = requireRole('ADMIN');
