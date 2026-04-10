import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const scrapeSchema = z.object({
  keyword: z.string().min(1, 'Keyword is required').max(100),
  location: z.string().min(1, 'Location is required').max(100),
  limit: z.number().int().min(1).max(100).default(20),
});

export const leadUpdateSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'IGNORED']),
});

export const leadsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['NEW', 'CONTACTED', 'IGNORED']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(25),
});