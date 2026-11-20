import { z } from 'zod';

export const registerCustomerSchema = z.object({
  body: z.object({
    email: z.string().email('Enter a valid email address').trim().toLowerCase(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().optional()
  }).refine(data => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })
});

export const registerOrgSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Organization name is required').trim(),
    type: z.enum(['HOSPITAL', 'BANK', 'OFFICE', 'GOVERNMENT', 'INSTITUTE', 'SERVICE'], {
      errorMap: () => ({ message: 'Invalid organization type' })
    }),
    address: z.string().min(1, 'Address is required').trim(),
    city: z.string().min(1, 'City is required').trim(),
    state: z.string().optional().default(''),
    pin: z.string().optional().default(''),
    email: z.string().email('Enter a valid organization email').trim().toLowerCase(),
    services: z.union([
      z.array(z.string().min(1)),
      z.string().min(1)
    ]).transform(val => {
      if (Array.isArray(val)) return val.map(s => s.trim()).filter(Boolean);
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }).refine(arr => arr.length > 0, { message: 'Add at least one service' }),
    counters: z.coerce.number().min(1).max(20).default(3),
    adminEmail: z.string().email('Enter a valid admin email').trim().toLowerCase(),
    adminPassword: z.string().min(8, 'Admin password must be at least 8 characters')
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Enter a valid email address').trim().toLowerCase(),
    password: z.string().min(1, 'Password is required'),
    remember: z.boolean().optional().default(false)
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Enter a valid email address').trim().toLowerCase()
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters')
  })
});
