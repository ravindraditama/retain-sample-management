import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from './api';
import type { AuthUser, Role } from './types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  role: Role;
  canWrite: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const signOut = useCallback(() => { tokenStore.clear(); setUser(null); }, []);

  const refreshUser = useCallback(async () => {
    try { setUser((await api.get<{ user: AuthUser }>('/auth/me')).user); }
    catch { tokenStore.clear(); setUser(null); }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    if (tokenStore.get()) refreshUser().finally(() => setLoading(false));
  }, [refreshUser, signOut]);

  const signIn = async (email: string, password: string) => {
    const r = await api.post<{ token: string; user: AuthUser }>('/auth/login', { email, password });
    tokenStore.set(r.token);
    setUser(r.user);
  };

  const role: Role = user?.role ?? 'viewer';
  return (
    <AuthContext.Provider value={{ user, loading, role, canWrite: role === 'admin' || role === 'quality_engineer', isAdmin: role === 'admin', signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
