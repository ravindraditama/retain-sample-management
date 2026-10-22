import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, BellRing, Boxes, CheckCircle2, Download, FileSpreadsheet, Loader2, MapPin, Plus, Trash2 } from 'lucide-react';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { daysLabel, formatDate, formatDateTime } from '@/lib/sampleStatus';
import type { DashboardData } from '@/lib/types';
import type { PageKey } from '@/components/AppShell';
import type { SamplesPreset } from './SamplesPage';
import Modal from '@/components/Modal';
import SampleForm from '@/components/SampleForm';
import ImportExcelModal from '@/components/ImportExcelModal';
import ExportModal from '@/components/ExportModal';

type Nav = (p: PageKey, f?: Omit<SamplesPreset, 'nonce'>) => void;

export default function Dashboard({ onNavigate }: { onNavigate: Nav }) {
  const { canWrite } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'import' | 'add' | 'export' | null>(null);

  const load = useCallback(async () => {
    try { setData(await api.get<DashboardData>('/dashboard')); setError(null); } catch (e) { setError(errMsg(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const closeAndRefresh = () => { setModal(null); load(); };

  const bandCards = data && [
    { label: 'Retention reached', sub: 'Due today or overdue', n: data.bands.due_now, tone: 'border-red-200 bg-red-50 text-red-700', go: () => onNavigate('disposal') },
    { label: 'Due within 7 days', sub: '', n: data.bands.within_7, tone: 'border-orange-200 bg-orange-50 text-orange-700', go: () => onNavigate('notifications') },
    { label: 'Due within 14 days', sub: '', n: data.bands.within_14, tone: 'border-amber-200 bg-amber-50 text-amber-700', go: () => onNavigate('notifications') },
    { label: 'Due within 30 days', sub: '', n: data.bands.within_30, tone: 'border-yellow-200 bg-yellow-50 text-yellow-700', go: () => onNavigate('notifications') },
  ];

  const action = 'flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-900 hover:shadow active:scale-[0.99]';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-0.5 text-sm text-slate-500">Retain sample overview · retention period is 13 months from production date</p>
      </div>

      {/* Primary actions */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {canWrite && <button className={action} onClick={() => setModal('import')}><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><FileSpreadsheet className="h-5 w-5" /></span>Import Excel</button>}
        {canWrite && <button className={action} onClick={() => setModal('add')}><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700"><Plus className="h-5 w-5" /></span>Add Sample Manually</button>}
        <button className={action} onClick={() => setModal('export')}><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700"><Download className="h-5 w-5" /></span>Export Report</button>
        <button className={action} onClick={() => onNavigate('disposal')}>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-700"><Trash2 className="h-5 w-5" /></span>
          <span className="flex-1">Disposal List</span>
          {data && data.totals.ready_for_disposal > 0 && <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">{data.totals.ready_for_disposal.toLocaleString()}</span>}
        </button>
      </div>

      {error && <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!data && !error && <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}

      {data && bandCards && (
        <>
          {data.totals.ready_for_disposal > 0 && (
            <button onClick={() => onNavigate('disposal')} className="flex w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-800">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="flex-1"><b>{data.totals.ready_for_disposal.toLocaleString()}</b> sample{data.totals.ready_for_disposal === 1 ? ' has' : 's have'} reached the retention period and {data.totals.ready_for_disposal === 1 ? 'is' : 'are'} ready for disposal.</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          <section aria-label="Retention alerts">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><BellRing className="h-4 w-4" />Retention alerts</div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {bandCards.map((b) => (
                <button key={b.label} onClick={b.go} className={`rounded-xl border p-4 text-left transition hover:shadow ${b.tone}`}>
                  <div className="text-3xl font-bold">{b.n.toLocaleString()}</div>
                  <div className="mt-1 text-sm font-medium">{b.label}</div>
                </button>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {([
              ['Total records', data.totals.all, '', 'text-slate-900'],
              ['Active', data.totals.active, 'active', 'text-emerald-600'],
              ['Near expired', data.totals.near_expired, 'near_expired', 'text-amber-600'],
              ['Ready for disposal', data.totals.ready_for_disposal, 'ready_for_disposal', 'text-orange-600'],
              ['Disposed', data.totals.disposed, 'disposed', 'text-slate-500'],
            ] as const).map(([l, n, st, c]) => (
              <button key={l} onClick={() => onNavigate('samples', st ? { status: st } : {})} className="card p-4 text-left transition hover:shadow-md">
                <div className={`text-2xl font-bold ${c}`}>{n.toLocaleString()}</div><div className="text-xs text-slate-500">{l}</div>
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><MapPin className="h-4 w-4" />Where samples are</div>
              {(['Rack', 'Transit Area', 'Dump Trash'] as const).map((l) => (
                <button key={l} onClick={() => onNavigate('samples', { storage_location: l })} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
                  <span className="text-slate-600">{l}</span><b>{(data.locations[l] ?? 0).toLocaleString()}</b>
                </button>
              ))}
            </section>
            <section className="card p-4 lg:col-span-2">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><Boxes className="h-4 w-4" />Next to reach retention</div>
              {data.upcoming.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Nothing upcoming.</p> : (
                <ul className="divide-y divide-slate-100">
                  {data.upcoming.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0"><div className="truncate font-medium text-slate-900">{u.five_l_number}</div><div className="truncate text-xs text-slate-500">{u.customer ?? '—'} · {u.storage_location}</div></div>
                      <div className="shrink-0 text-right text-xs"><div className="font-medium text-slate-700">{formatDate(u.expiration_date)}</div><div className="text-slate-400">{daysLabel(u.days_left)}</div></div>
                    </li>))}
                </ul>)}
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-4">
              <div className="mb-3 text-sm font-semibold text-slate-800">Recent movements</div>
              {data.recentMovements.length === 0 ? <p className="py-4 text-center text-sm text-slate-400">No movements yet.</p> : (
                <ul className="divide-y divide-slate-100 text-sm">{data.recentMovements.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2"><span className="truncate"><b>{m.five_l_number}</b> <span className="text-slate-500">{m.old_location ?? 'new'} → {m.new_location}</span></span><span className="shrink-0 text-xs text-slate-400">{formatDateTime(m.moved_at)}</span></li>))}</ul>)}
            </section>
            <section className="card p-4">
              <div className="mb-3 text-sm font-semibold text-slate-800">Recent disposals</div>
              {data.recentDisposals.length === 0 ? <p className="py-4 text-center text-sm text-slate-400">No disposals recorded.</p> : (
                <ul className="divide-y divide-slate-100 text-sm">{data.recentDisposals.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2"><span className="flex items-center gap-2 truncate"><CheckCircle2 className="h-4 w-4 text-slate-400" /><b>{d.five_l_number}</b> <span className="text-slate-500">{d.customer ?? ''}</span></span><span className="shrink-0 text-xs text-slate-400">{formatDateTime(d.disposed_at)}</span></li>))}</ul>)}
            </section>
          </div>
        </>
      )}

      <Modal open={modal === 'import'} onClose={() => setModal(null)} title="Import from Excel" size="xl"><ImportExcelModal onDone={closeAndRefresh} onCancel={() => setModal(null)} /></Modal>
      <Modal open={modal === 'add'} onClose={() => setModal(null)} title="Add Sample Manually" size="lg"><SampleForm sample={null} onSaved={closeAndRefresh} onCancel={() => setModal(null)} /></Modal>
      <Modal open={modal === 'export'} onClose={() => setModal(null)} title="Export Report" size="md"><ExportModal onDone={() => setModal(null)} /></Modal>
    </div>
  );
}
