import { useState } from 'react';
import { BellRing, CheckCheck, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useList } from '@/lib/hooks';
import { formatDate, formatDateTime } from '@/lib/sampleStatus';
import type { AppNotification } from '@/lib/types';
import type { PageKey } from '@/components/AppShell';
import type { SamplesPreset } from './SamplesPage';
import Pagination from '@/components/Pagination';

const BANDS: { v: string; label: string; cls: string }[] = [
  { v: '', label: 'All', cls: '' }, { v: '0', label: 'Due now', cls: 'border-red-200 bg-red-50 text-red-700' },
  { v: '7', label: '7 days', cls: 'border-orange-200 bg-orange-50 text-orange-700' }, { v: '14', label: '14 days', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  { v: '30', label: '30 days', cls: 'border-yellow-200 bg-yellow-50 text-yellow-700' },
];
const tone = (t: number) => BANDS.find((b) => b.v === String(t))?.cls ?? '';

export default function NotificationsPage({ onNavigate, onChanged }: { onNavigate: (p: PageKey, f?: Omit<SamplesPreset, 'nonce'>) => void; onChanged: () => void }) {
  const [band, setBand] = useState(''); const [unread, setUnread] = useState(false);
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(25);
  const [busy, setBusy] = useState(false);
  const list = useList<AppNotification>('/notifications', { threshold: band, unread: unread ? '1' : undefined, page, pageSize });

  async function run(fn: () => Promise<unknown>) { setBusy(true); try { await fn(); list.reload(); onChanged(); } finally { setBusy(false); } }
  const open = (n: AppNotification) => { if (!n.is_read) api.post(`/notifications/${n.id}/read`).then(onChanged).catch(() => undefined); onNavigate('samples', { q: n.five_l_number }); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Notifications</h1><p className="mt-0.5 text-sm text-slate-500">Raised automatically 30, 14 and 7 days before the retention date, and when it is reached.</p></div>
        <div className="flex gap-2">
          <button className="btn-secondary" disabled={busy} onClick={() => run(() => api.post('/notifications/refresh'))}><RefreshCw className="h-4 w-4" />Check now</button>
          <button className="btn-secondary" disabled={busy} onClick={() => run(() => api.post('/notifications/read-all'))}><CheckCheck className="h-4 w-4" />Mark all read</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {BANDS.map((b) => <button key={b.v} onClick={() => { setBand(b.v); setPage(1); }} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${band === b.v ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{b.label}</button>)}
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={unread} onChange={(e) => { setUnread(e.target.checked); setPage(1); }} />Unread only</label>
      </div>
      {list.error && <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{list.error}</div>}
      <div className="card overflow-hidden">
        <ul className={`divide-y divide-slate-100 ${list.loading ? 'opacity-60' : ''}`}>
          {list.data.map((n) => (
            <li key={n.id}><button onClick={() => open(n)} className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 ${n.is_read ? '' : 'bg-sky-50/40'}`}>
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${tone(n.threshold)}`}><BellRing className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className={`block text-sm ${n.is_read ? 'text-slate-600' : 'font-semibold text-slate-900'}`}>{n.message}</span>
                <span className="mt-0.5 block text-xs text-slate-400">Retention until {formatDate(n.expiration_date)} · {n.storage_location} · raised {formatDateTime(n.created_at)}</span></span>
              {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-label="Unread" />}
            </button></li>))}
        </ul>
        {list.loading && list.data.length === 0 && <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
        {!list.loading && list.data.length === 0 && <div className="px-4 py-14 text-center text-sm text-slate-400">No notifications.</div>}
        <Pagination page={page} pageSize={pageSize} total={list.total} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
      </div>
    </div>
  );
}
