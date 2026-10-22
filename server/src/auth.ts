import type { NextFunction, Request, Response } from 'express';

export type Role = 'admin' | 'quality_engineer' | 'viewer';

export interface AuthUser {
  id: string; email: string; display_name: string | null; role: Role;
  must_change_password: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: AuthUser } }
}

/**
 * Login is disabled: every request is treated as the shared "open access" user with full rights.
 * Anyone who can reach the server can read and change data — restrict access at the network level
 * (VPN / office network / reverse-proxy allow-list).
 */
export const OPEN_USER: AuthUser = {
  id: '00000000-0000-0000-0000-000000000000', email: 'open-access', display_name: 'Team', role: 'admin', must_change_password: false,
};

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  req.user = OPEN_USER;
  next();
}

export const requireRole = (..._roles: Role[]) => (_req: Request, _res: Response, next: NextFunction): void => { next(); };

export const WRITERS: Role[] = ['admin', 'quality_engineer'];

export const actorOf = (req: Request) => ({ id: req.user!.id, email: req.user!.email, name: req.user!.display_name || req.user!.email });
