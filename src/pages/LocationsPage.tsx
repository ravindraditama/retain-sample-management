import { useEffect, useState } from 'react';
import { Download, MapPin, MoveRight, Trash2, ArrowLeftRight, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useDebounced, useList } from '@/lib/hooks';
import { exportTable, type ExportFormat } from '@/lib/exporters';
import { formatDateTime } from '@/lib/sampleStatus';
import type { DashboardData, Movement, StorageLocation } from '@/lib/types';
import type { PageKey } from '@/components/AppShell';
import type { SamplesPreset } from './SamplesPage';
import Pagination from '@/components/Pagination';

const META: Record<StorageLocation, { icon: typeof MapPin; tone: string }> = {
  Rack: { icon: MapPin, tone: 'bg-sky-100 text-sky-700' },
  'Transit Area': { icon: ArrowLeftRight, tone: 'bg-amber-100 text-amber-700' },
  'Dump Trash': { icon: Trash2, tone: 'bg-slate-200 text-slate-600' },
};

export default function LocationsPage({ onNavigate }: { onNavigate: (p: PageKey, f?: Omit<SamplesPreset, 'nonce'>) => void }) {
  const [counts, setCounts] = useState<DashboardData['locations']>({});
  const [q, setQ] = useState(''); const [kind, setKind] = useState(''); const [location, setLocation] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(50);
  const dq = useDebounced(q);
  const list = useList<Movement>('/movements', { q: dq, kind, location, from, to, page, pageSize });

  useEffect(() => { api.get<DashboardData>('/dashboard').then((d) => setCounts(d.locations)).catch(() => undefined); }, []);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  async function exportLog(format: ExportFormat) {
    const r = await api.get<{ data: Movement[] }>('/movements', { q: dq, kind, location, from, to, all: '1' });
    exportTable(format, 'Movement History', 'movement-history', ['Date', '5L Number', 'Type', 'From', 'To', 'Rack Detail', 'By', 'Note'],
      r.data.map((m) => [formatDateTime(m.moved_at), m.five_l_number ?? '', m.kind, m.old_location ?? '', m.new_location, m.new_rack_detail ?? '', m.moved_by_name ?? '', m.note ?? '']));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Locations & Movements</h1><p className="mt-0.5 text-sm text-slate-500">Every move between Rack, Transit Area and Dump Trash is logged. Select samples on the Samples page to move them.</p></div>
        <div className="flex gap-2"><button className="btn-secondary" onClick={() => exportLog('excel')}><Download className="h-4 w-4" />Excel</button><button className="btn-secondary" onClick={() => exportLog('pdf')}><Download className="h-4 w-4" />PDF</button></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(META) as StorageLocation[]).map((l) => { const Icon = META[l].icon; return (
          <button key={l} className="card flex items-center gap-4 p-4 text-left transition hover:shadow-md" onClick={() => onNavigate('samples', { storage_location: l })}>
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${META[l].tone}`}><Icon className="h-5 w-5" /></span>
            <span><span className="block text-2xl font-bold text-slate-900">{(counts[l] ?? 0).toLocaleString()}</span><span className="text-sm text-slate-500">{l}</span></span>
          </button>); })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder="Search 5L, user, note…" aria-label="Search movements" value={q} onChange={(e) => reset(setQ)(e.target.value)} />
        <select className="input w-auto" aria-label="Type" value={kind} onChange={(e) => reset(setKind)(e.target.value)}><option value="">All types</option><option value="create">Initial placement</option><option value="move">Move</option><option value="dispose">Disposal</option></select>
        <select className="input w-auto" aria-label="Location" value={location} onChange={(e) => reset(setLocation)(e.target.value)}><option value="">Any location</option><option>Rack</option><option>Transit Area</option><option>Dump Trash</option></select>
        <input type="date" className="input w-auto" aria-label="From" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
        <input type="date" className="input w-auto" aria-label="To" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
      </div>
      {list.error && <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{list.error}</div>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr>{['Date', '5L Number', 'Movement', 'By', 'Note'].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr></thead>
            <tbody className={list.loading ? 'opacity-60' : ''}>{list.data.map((m) => (
              <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{formatDateTime(m.moved_at)}</td>
                <td className="px-3 py-2.5 font-semibold">{m.five_l_number ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5"><span className="inline-flex items-center gap-1.5">{m.old_location ?? <i className="text-slate-400">new</i>}<MoveRight className="h-3.5 w-3.5 text-slate-400" /><b>{m.new_location}</b>{m.new_rack_detail && <span className="text-slate-400">({m.new_rack_detail})</span>}</span></td>
                <td className="px-3 py-2.5">{m.moved_by_name ?? '—'}</td><td className="max-w-[260px] truncate px-3 py-2.5 text-slate-500">{m.note ?? ''}</td>
              </tr>))}</tbody>
          </table>
        </div>
        {list.loading && list.data.length === 0 && <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
        {!list.loading && list.data.length === 0 && <div className="px-4 py-14 text-center text-sm text-slate-400">No movements found.</div>}
        <Pagination page={page} pageSize={pageSize} total={list.total} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
      </div>
    </div>
  );
}
