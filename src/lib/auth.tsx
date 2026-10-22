import type { ReactNode } from 'react';
import type { AuthUser, Role } from './types';

// Login is disabled: the app opens directly and everyone has full access.
const OPEN_USER: AuthUser = { id: 'open-access', email: 'open-access', display_name: null, role: 'admin', must_change_password: false };

export function AuthProvider({ children }: { children: ReactNode }) { return <>{children}</>; }

export function useAuth() {
  const role: Role = 'admin';
  return { user: OPEN_USER, role, canWrite: true, isAdmin: true };
}
