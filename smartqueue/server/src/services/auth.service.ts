import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Organization, Service, Counter } from '../models/index.js';
import { signToken, verifyToken } from '../utils/jwt.js';
import { AppError, ConflictError, UnauthorizedError, NotFoundError } from '../utils/errors.js';
import { ORGANIZATION_TYPES } from '../utils/constants.js';
import { config } from '../config/environment.js';

export async function registerCustomerService(email: string, password: string, name?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const customerName = name?.trim() || normalizedEmail.split('@')[0];

  const user = await User.create({
    name: customerName,
    email: normalizedEmail,
    passwordHash,
    role: 'CUSTOMER',
    status: 'ACTIVE'
  });

  const token = signToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role
  });

  return { user, token };
}

export async function registerOrgService(data: {
  name: string;
  type: string;
  address: string;
  city: string;
  state?: string;
  pin?: string;
  email: string;
  services: string[];
  counters: number;
  adminEmail: string;
  adminPassword: string;
}) {
  const adminEmail = data.adminEmail.trim().toLowerCase();
  const orgEmail = data.email.trim().toLowerCase();

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (existingAdmin) {
    throw new ConflictError('An account with this admin email already exists');
  }

  const typeConfig = ORGANIZATION_TYPES[data.type];
  if (!typeConfig) {
    throw new AppError('Invalid organization type', 400);
  }

  // Generate unique organization code
  let code = '';
  let isUnique = false;
  while (!isUnique) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    code = `SQ-${typeConfig.code}-${randomNum}`;
    const found = await Organization.findOne({ code });
    if (!found) isUnique = true;
  }

  const org = await Organization.create({
    name: data.name.trim(),
    code,
    type: data.type as any,
    address: data.address.trim(),
    city: data.city.trim(),
    state: data.state?.trim() || '',
    pin: data.pin?.trim() || '',
    lat: 16.5 + Math.random() * 0.3,
    lng: 80.5 + Math.random() * 0.3,
    open: true,
    email: orgEmail
  });

  // Create initial Admin account
  const passwordHash = await bcrypt.hash(data.adminPassword, 10);
  const adminUser = await User.create({
    name: `${data.name.trim()} Admin`,
    email: adminEmail,
    passwordHash,
    role: 'ADMIN',
    organizationId: org._id,
    status: 'ACTIVE'
  });

  // Create configured services
  const createdServices = [];
  for (let i = 0; i < data.services.length; i++) {
    const sName = data.services[i].trim();
    if (!sName) continue;
    const prefix = String.fromCharCode(65 + (i % 26));
    const svc = await Service.create({
      organizationId: org._id,
      name: sName,
      prefix,
      averageServiceTime: 8,
      enabled: true,
      open: true,
      capacity: 50
    });
    createdServices.push(svc);
  }

  // Create configured counters
  const counterCount = Math.min(Math.max(data.counters || 1, 1), 20);
  for (let i = 0; i < counterCount; i++) {
    const assignedServiceId = createdServices[i % createdServices.length]?._id;
    await Counter.create({
      organizationId: org._id,
      name: `Counter ${i + 1}`,
      serviceId: assignedServiceId,
      active: true
    });
  }

  const token = signToken({
    userId: adminUser._id.toString(),
    email: adminUser.email,
    role: adminUser.role,
    organizationId: org._id.toString()
  });

  return {
    org,
    admin: adminUser,
    token
  };
}

export async function loginService(email: string, passwordCandidate: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isMatch = await user.comparePassword(passwordCandidate);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.status === 'DISABLED') {
    throw new AppError('This account has been disabled. Please contact support.', 403);
  }

  const token = signToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    organizationId: user.organizationId?.toString()
  });

  return { user, token };
}

export async function generatePasswordResetToken(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    // Return standard message to prevent user enumeration
    return {
      sent: true,
      message: 'If an account exists with this email, password reset instructions have been generated.'
    };
  }

  // Generate 1-hour reset token
  const resetToken = jwt.sign(
    { userId: user._id.toString(), purpose: 'password_reset' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  return {
    sent: true,
    resetToken,
    message: 'If an account exists with this email, password reset instructions have been generated.'
  };
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as any;
    if (payload.purpose !== 'password_reset') {
      throw new AppError('Invalid reset token', 400);
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return { success: true };
  } catch (err: any) {
    throw new AppError('Invalid or expired password reset token', 400);
  }
}
