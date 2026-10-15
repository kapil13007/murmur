// File: app/schemas/auth_schema.js
import { z } from 'zod';
import { passwordSchema } from '../core/validators.js';

const email = z.email('Enter a valid email address').max(255).transform((e) => e.trim().toLowerCase());
const name = z.string().trim().min(1, 'Required').max(100);

export const RegisterRequest = z.object({
  email,
  password: passwordSchema,
  first_name: name,
  last_name: z.string().trim().max(100).optional().nullable(),
  timezone: z.string().max(64).optional(),
});

export const LoginRequest = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(128),
  remember_me: z.boolean().default(false),
});

export const ChangePasswordRequest = z.object({
  old_password: z.string().min(1).max(128),
  new_password: passwordSchema,
});
