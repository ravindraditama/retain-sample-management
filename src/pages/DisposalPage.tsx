import { useState } from 'react';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced, useList } from '@/lib/hooks';
import { exportSamples, exportTable, type ExportFormat } from '@/lib/exporters';
import { daysLabel, formatDate, formatDateTime } from '@/lib/sampleStatus';
import type { Disposal, Sample } from '@/lib/types';
import ConfirmModal from '@/components/ConfirmModal';
import Pagination from '@/components/Pagination';

type Tab = 'ready' | 'history';

export default function DisposalPage() {
  const { canWrite } = useAuth();
  const [tab, setTab] = useState<Tab>('ready');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<'selected' | 'all' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dq = useDebounced(q);

  const ready = useList<Sample>('/samples', { status: 'ready_for_disposal', q: dq, page, pageSize, sort: 'expiration_date', dir: 'asc' }, tab === 'ready');
  const hist = useList<Disposal>('/disposals', { q: dq, from, to, page, pageSize }, tab === 'history');

  const rows = ready.data;
  const allOnPage = rows.length > 0 && rows.every((s) => selected.has(s.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function dispose() {
    try {
      const body = confirm === 'all' ? { all_ready: true } : { ids: [...selected] };
      const r = await api.post<{ disposed: number }>('/samples/dispose', body);
      setMsg({ ok: true, text: `${r.disposed.toLocaleString()} sample${r.disposed === 1 ? '' : 's'} disposed and moved to Dump Trash.` });
      setSelected(new Set()); ready.reload();
    } catch (e) { setMsg({ ok: false, text: errMsg(e) }); }
    setConfirm(null);
  }

  async function exportReady(format: ExportFormat) {
    const r = await api.get<{ data: Sample[] }>('/samples/export', { status: 'ready_for_disposal', q: dq, sort: 'expiration_date', dir: 'asc' });
    exportSamples(format, r.data, 'Disposal List — samples ready for disposal', 'disposal-list');
  }
  async function exportHistory(format: ExportFormat) {
    const r = await api.get<{ data: Disposal[] }>('/disposals', { q: dq, from, to, all: '1' });
    exportTable(format, 'Disposal History', 'disposal-history',
      ['5L Number', 'Specification', 'Customer', 'Machine', 'Production', 'Retention Until', 'Previous Location', 'Disposed By', 'Disposed At', 'Note'],
      r.data.map((d) => [d.five_l_number ?? '', d.specification ?? '', d.customer ?? '', d.machine ?? '', formatDate(d.production_date), formatDate(d.expiration_date), d.previous_location ?? '', d.disposed_by_name ?? '', formatDateTime(d.disposed_at), d.note ?? '']));
  }

  const cur = tab === 'ready' ? ready : hist;
  const tabBtn = (t: Tab, label: string, n?: number) => (
    <button onClick={() => { setTab(t); setPage(1); setSelected(new Set()); }} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}{n !== undefined && <span className="ml-2 rounded-full bg-white/20 px-1.5 text-xs">{n.toLocaleString()}</span>}</button>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Disposal</h1><p className="mt-0.5 text-sm text-slate-500">Samples whose 13-month retention has ended, and the disposal record.</p></div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => (tab === 'ready' ? exportReady('excel') : exportHistory('excel'))}><Download className="h-4 w-4" />Excel</button>
          <button className="btn-secondary" onClick={() => (tab === 'ready' ? exportReady('pdf') : exportHistory('pdf'))}><Download className="h-4 w-4" />PDF</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabBtn('ready', 'Ready for Disposal', tab === 'ready' ? ready.total : undefined)}
        {tabBtn('history', 'Disposal History')}
        <input className="input ml-auto max-w-xs" placeholder="Search…" aria-label="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        {tab === 'history' && <>
          <input type="date" className="input w-auto" aria-label="From" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <input type="date" className="input w-auto" aria-label="To" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </>}
      </div>

      {msg && <div role="status" className={`rounded-lg px-4 py-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}
      {cur.error && <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{cur.error}</div>}

      {tab === 'ready' && canWrite && ready.total > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm">
          <span className="flex-1 text-orange-900">Disposing records the action, moves the sample to <b>Dump Trash</b> and keeps its full history.</span>
          <button className="btn-secondary" disabled={selected.size === 0} onClick={() => setConfirm('selected')}><Trash2 className="h-4 w-4" />Dispose selected ({selected.size})</button>
          <button className="btn-danger" onClick={() => setConfirm('all')}><Trash2 className="h-4 w-4" />Dispose all {ready.total.toLocaleString()}</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {tab === 'ready' ? (
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr>
                {canWrite && <th className="w-10 px-3 py-3"><input type="checkbox" aria-label="Select all on page" checked={allOnPage} onChange={() => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)))} /></th>}
                {['5L Number', 'Specification', 'Customer', 'Machine', 'Production', 'Retention Until', 'Overdue', 'Location'].map((h) => <th key={h} className="whitespace-nowrap px-3 py-3">{h}</th>)}</tr></thead>
              <tbody className={ready.loading ? 'opacity-60' : ''}>{rows.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                  {canWrite && <td className="px-3 py-2.5"><input type="checkbox" aria-label={`Select ${s.five_l_number}`} checked={selected.has(s.id)} onChange={() => toggle(s.id)} /></td>}
                  <td className="px-3 py-2.5 font-semibold">{s.five_l_number}</td><td className="px-3 py-2.5">{s.specification ?? '—'}</td>
                  <td className="max-w-[220px] truncate px-3 py-2.5">{s.customer ?? '—'}</td><td className="px-3 py-2.5">{s.machine ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{formatDate(s.production_date)}</td><td className="whitespace-nowrap px-3 py-2.5">{formatDate(s.expiration_date)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-orange-600">{daysLabel(s.days_left)}</td><td className="px-3 py-2.5">{s.storage_location}</td>
                </tr>))}</tbody>
            </table>
          ) : (
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr>{['Disposed At', '5L Number', 'Specification', 'Customer', 'Machine', 'Retention Until', 'From', 'Disposed By'].map((h) => <th key={h} className="whitespace-nowrap px-3 py-3">{h}</th>)}</tr></thead>
              <tbody className={hist.loading ? 'opacity-60' : ''}>{hist.data.map((d) => (
                <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2.5">{formatDateTime(d.disposed_at)}</td><td className="px-3 py-2.5 font-semibold">{d.five_l_number}</td>
                  <td className="px-3 py-2.5">{d.specification ?? '—'}</td><td className="max-w-[220px] truncate px-3 py-2.5">{d.customer ?? '—'}</td><td className="px-3 py-2.5">{d.machine ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{formatDate(d.expiration_date)}</td><td className="px-3 py-2.5">{d.previous_location ?? '—'}</td><td className="px-3 py-2.5">{d.disposed_by_name ?? '—'}</td>
                </tr>))}</tbody>
            </table>
          )}
        </div>
        {cur.loading && cur.data.length === 0 && <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
        {!cur.loading && cur.data.length === 0 && <div className="px-4 py-14 text-center text-sm text-slate-400">{tab === 'ready' ? 'No samples are waiting for disposal.' : 'No disposals recorded.'}</div>}
        <Pagination page={page} pageSize={pageSize} total={cur.total} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
      </div>

      <ConfirmModal open={!!confirm} title="Confirm disposal" danger confirmLabel="Dispose" onConfirm={dispose} onClose={() => setConfirm(null)}>
        {confirm === 'all' ? <>Dispose <b>all {ready.total.toLocaleString()}</b> samples that reached their retention date?</> : <>Dispose <b>{selected.size}</b> selected sample{selected.size === 1 ? '' : 's'}?</>} This cannot be undone.
      </ConfirmModal>
    </div>
  );
}
