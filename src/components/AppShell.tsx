import { useState, type FormEvent, type ReactNode } from 'react';
import {
  LayoutDashboard, FlaskConical, MapPin, ScrollText, Users, Bell, LogOut, Beaker, Menu, X, Trash2, Search, KeyRound, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ROLE_LABEL, type Role } from '@/lib/types';
import Modal from './Modal';
import ChangePasswordModal from './ChangePasswordModal';

export type PageKey = 'dashboard' | 'samples' | 'disposal' | 'locations' | 'notifications' | 'audit' | 'users';

const NAV: { key: PageKey; label: string; icon: typeof LayoutDashboard; roles?: Role[] }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'samples', label: 'Samples', icon: FlaskConical },
  { key: 'disposal', label: 'Disposal', icon: Trash2 },
  { key: 'locations', label: 'Locations & Movements', icon: MapPin },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'audit', label: 'Audit Trail', icon: ScrollText, roles: ['admin', 'quality_engineer'] },
  { key: 'users', label: 'Users', icon: Users, roles: ['admin'] },
];

interface Props {
  page: PageKey; onNavigate: (p: PageKey) => void; onSearch: (q: string) => void;
  unread: number; children: ReactNode;
}

export default function AppShell({ page, onNavigate, onSearch, unread, children }: Props) {
  const { user, role, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [q, setQ] = useState('');
  const items = NAV.filter((n) => !n.roles || n.roles.includes(role));

  function submitSearch(e: FormEvent) { e.preventDefault(); onSearch(q.trim()); }

  const navList = (close?: () => void) => items.map((item) => {
    const Icon = item.icon;
    const active = page === item.key;
    return (
      <button key={item.key} onClick={() => { onNavigate(item.key); close?.(); }}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
        <Icon className="h-[18px] w-[18px]" />
        <span className="flex-1 text-left">{item.label}</span>
        {item.key === 'notifications' && unread > 0 && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread > 999 ? '999+' : unread}</span>}
      </button>
    );
  });

  const account = (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="truncate text-sm font-semibold text-slate-900">{user?.display_name || user?.email}</div>
      <div className="text-xs text-slate-500">{ROLE_LABEL[role]}</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button onClick={() => setPwOpen(true)} className="flex items-center justify-center gap-1.5 rounded-md bg-white py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"><KeyRound className="h-3.5 w-3.5" />Password</button>
        <button onClick={signOut} className="flex items-center justify-center gap-1.5 rounded-md bg-white py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"><LogOut className="h-3.5 w-3.5" />Sign out</button>
      </div>
    </div>
  );

  const brand = (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900"><Beaker className="h-5 w-5 text-white" /></div>
      <div className="leading-tight"><div className="text-sm font-bold text-slate-900">Retain</div><div className="text-xs text-slate-500">Sample Manager</div></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="px-5 py-5">{brand}</div>
        <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-3">{navList()}</nav>
        <div className="border-t border-slate-200 p-3">{account}</div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <button onClick={() => setMobileOpen(true)} className="btn-ghost px-2 lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <form onSubmit={submitSearch} className="relative max-w-xl flex-1" role="search">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input className="input pl-9" placeholder="Search 5L number, customer, spec, machine, inspector…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Global search" />
          </form>
          <button onClick={() => onNavigate('notifications')} className="btn-ghost relative px-2" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
          </button>
        </header>

        {user?.must_change_password && (
          <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:px-6 lg:px-8">
            <AlertTriangle className="h-4 w-4" /> Your password was set by an administrator or is the default one.
            <button className="font-semibold underline" onClick={() => setPwOpen(true)}>Change it now</button>
          </div>
        )}

        <main><div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div></main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">{brand}
              <button onClick={() => setMobileOpen(false)} className="btn-ghost px-2" aria-label="Close menu"><X className="h-5 w-5" /></button></div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">{navList(() => setMobileOpen(false))}</nav>
            <div className="border-t border-slate-200 p-3">{account}</div>
          </div>
        </div>
      )}

      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Change password" size="sm"><ChangePasswordModal onDone={() => setPwOpen(false)} /></Modal>
    </div>
  );
}
