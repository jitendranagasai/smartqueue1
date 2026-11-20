import { Request } from 'express';
import { Types } from 'mongoose';

export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export type TicketStatus = 'WAITING' | 'CALLED' | 'SERVING' | 'COMPLETED' | 'SKIPPED' | 'CANCELLED';

export type UserStatus = 'ACTIVE' | 'DISABLED';

export type OrgType = 'HOSPITAL' | 'BANK' | 'OFFICE' | 'GOVERNMENT' | 'INSTITUTE' | 'SERVICE';

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
  organizationId?: string;
}

export interface AuthenticatedUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: Role;
  organizationId?: Types.ObjectId;
  serviceId?: Types.ObjectId;
  counterId?: Types.ObjectId;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
