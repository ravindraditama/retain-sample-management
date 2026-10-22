import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AuthPage from '@/pages/AuthPage';
import AppShell, { type PageKey } from '@/components/AppShell';
import Dashboard from '@/pages/Dashboard';
import SamplesPage, { type SamplesPreset } from '@/pages/SamplesPage';
import DisposalPage from '@/pages/DisposalPage';
import LocationsPage from '@/pages/LocationsPage';
import AuditPage from '@/pages/AuditPage';
import UsersPage from '@/pages/UsersPage';
import NotificationsPage from '@/pages/NotificationsPage';

function AppContent() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<PageKey>('dashboard');
  const [preset, setPreset] = useState<SamplesPreset>({ nonce: 0 });
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    try { setUnread((await api.get<{ count: number }>('/notifications/unread-count')).count); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshUnread();
    const t = setInterval(refreshUnread, 60000);
    return () => clearInterval(t);
  }, [user, refreshUnread]);

  /** Navigate, optionally opening the Samples page with filters pre-applied. */
  const go = useCallback((p: PageKey, filters?: Omit<SamplesPreset, 'nonce'>) => {
    if (p === 'samples') setPreset((s) => ({ ...filters, nonce: s.nonce + 1 }));
    setPage(p);
    window.scrollTo({ top: 0 });
  }, []);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  if (!user) return <AuthPage />;

  return (
    <AppShell page={page} onNavigate={(p) => go(p)} onSearch={(q) => go('samples', { q })} unread={unread}>
      {page === 'dashboard' && <Dashboard onNavigate={go} />}
      {page === 'samples' && <SamplesPage preset={preset} />}
      {page === 'disposal' && <DisposalPage />}
      {page === 'locations' && <LocationsPage onNavigate={go} />}
      {page === 'notifications' && <NotificationsPage onNavigate={go} onChanged={refreshUnread} />}
      {page === 'audit' && <AuditPage />}
      {page === 'users' && <UsersPage />}
    </AppShell>
  );
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}
