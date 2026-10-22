import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.js';
import { one } from './db.js';
import { HttpError } from './util.js';

export type Role = 'admin' | 'quality_engineer' | 'viewer';

export interface AuthUser {
  id: string; email: string; display_name: string | null; role: Role;
  must_change_password: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: AuthUser } }
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
}

export function validatePassword(pw: unknown): string {
  if (typeof pw !== 'string' || pw.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
  if (pw.length > 100) throw new HttpError(400, 'Password is too long.');
  return pw;
}

/** Loads the user from the DB on every request, so role changes and deactivation apply immediately. */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Authentication required.');
  let sub: string;
  try {
    sub = (jwt.verify(token, config.jwtSecret) as { sub: string }).sub;
  } catch {
    throw new HttpError(401, 'Session expired. Please sign in again.');
  }
  const u = await one<{ id: string; email: string; display_name: string | null; role: Role; is_active: number; must_change_password: number }>(
    'SELECT id, email, display_name, role, is_active, must_change_password FROM users WHERE id = ?', [sub]);
  if (!u || !u.is_active) throw new HttpError(401, 'Account is disabled or no longer exists.');
  req.user = { id: u.id, email: u.email, display_name: u.display_name, role: u.role, must_change_password: !!u.must_change_password };
  next();
}

export const requireRole = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user || !roles.includes(req.user.role)) throw new HttpError(403, 'You do not have permission to do this.');
  next();
};

export const WRITERS: Role[] = ['admin', 'quality_engineer'];

export const actorOf = (req: Request) => ({ id: req.user!.id, email: req.user!.email, name: req.user!.display_name || req.user!.email });
