import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useDebounced, useList } from '@/lib/hooks';
import { exportTable, type ExportFormat } from '@/lib/exporters';
import { formatDateTime } from '@/lib/sampleStatus';
import type { AuditEntry } from '@/lib/types';
import Pagination from '@/components/Pagination';

const ACTIONS = ['insert', 'update', 'delete', 'move', 'dispose', 'import', 'login', 'password_change', 'password_reset'];

export default function AuditPage() {
  const [q, setQ] = useState(''); const [action, setAction] = useState(''); const [table, setTable] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(50);
  const [open, setOpen] = useState<number | null>(null);
  const dq = useDebounced(q);
  const list = useList<AuditEntry>('/audit', { q: dq, action, table, from, to, page, pageSize });
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  async function exportLog(format: ExportFormat) {
    const r = await api.get<{ data: AuditEntry[] }>('/audit', { q: dq, action, table, from, to, all: '1' });
    exportTable(format, 'Audit Trail', 'audit-trail', ['Date', 'User', 'Action', 'Table', 'Record', 'Old', 'New'],
      r.data.map((a) => [formatDateTime(a.changed_at), a.user_email ?? '', a.action, a.table_name, a.record_id ?? '', a.old_values ? JSON.stringify(a.old_values) : '', a.new_values ? JSON.stringify(a.new_values) : '']));
  }
  const json = (v: unknown) => <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{v ? JSON.stringify(v, null, 2) : '—'}</pre>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Audit Trail</h1><p className="mt-0.5 text-sm text-slate-500">Read-only record of every change, move, disposal, import and user action.</p></div>
        <div className="flex gap-2"><button className="btn-secondary" onClick={() => exportLog('excel')}><Download className="h-4 w-4" />Excel</button><button className="btn-secondary" onClick={() => exportLog('pdf')}><Download className="h-4 w-4" />PDF</button></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder="Search user or record id…" aria-label="Search audit" value={q} onChange={(e) => reset(setQ)(e.target.value)} />
        <select className="input w-auto" aria-label="Action" value={action} onChange={(e) => reset(setAction)(e.target.value)}><option value="">All actions</option>{ACTIONS.map((a) => <option key={a}>{a}</option>)}</select>
        <select className="input w-auto" aria-label="Table" value={table} onChange={(e) => reset(setTable)(e.target.value)}><option value="">All records</option><option value="samples">Samples</option><option value="users">Users</option><option value="import_batches">Imports</option></select>
        <input type="date" className="input w-auto" aria-label="From" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
        <input type="date" className="input w-auto" aria-label="To" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
      </div>
      {list.error && <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{list.error}</div>}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="w-8" />{['Date', 'User', 'Action', 'Record'].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr></thead>
            <tbody className={list.loading ? 'opacity-60' : ''}>{list.data.map((a) => (
              <Fragment key={a.id}>
                <tr className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => setOpen(open === a.id ? null : a.id)}>
                  <td className="pl-3">{open === a.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{formatDateTime(a.changed_at)}</td><td className="px-3 py-2.5">{a.user_email ?? '—'}</td>
                  <td className="px-3 py-2.5"><span className="badge border-slate-200 bg-slate-50 text-slate-700">{a.action}</span></td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{a.table_name}{a.record_id ? ` · ${a.record_id.slice(0, 8)}` : ''}</td>
                </tr>
                {open === a.id && <tr className="bg-slate-50"><td /><td colSpan={4} className="grid gap-3 px-3 py-3 md:grid-cols-2"><div><div className="label">Before</div>{json(a.old_values)}</div><div><div className="label">After</div>{json(a.new_values)}</div></td></tr>}
              </Fragment>))}</tbody>
          </table>
        </div>
        {list.loading && list.data.length === 0 && <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
        {!list.loading && list.data.length === 0 && <div className="px-4 py-14 text-center text-sm text-slate-400">No audit entries.</div>}
        <Pagination page={page} pageSize={pageSize} total={list.total} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
      </div>
    </div>
  );
}
