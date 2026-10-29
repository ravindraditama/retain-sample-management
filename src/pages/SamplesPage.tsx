import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, ArrowUpDown, Download, Eye, Filter, Loader2, MapPin, Pencil, Plus, Trash2, Upload, X,
} from 'lucide-react';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced, useList } from '@/lib/hooks';
import { daysLabel, formatDate } from '@/lib/sampleStatus';
import { LOCATION_OPTIONS, STATUS_LABEL, type Sample } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import SampleForm from '@/components/SampleForm';
import SampleDetail from '@/components/SampleDetail';
import MoveLocationModal from '@/components/MoveLocationModal';
import ImportExcelModal from '@/components/ImportExcelModal';
import ExportModal from '@/components/ExportModal';
import ConfirmModal from '@/components/ConfirmModal';
import Pagination from '@/components/Pagination';

export interface SamplesPreset { q?: string; status?: string; storage_location?: string; nonce: number }

type ColType = 'text' | 'date' | 'status' | 'location' | 'none';
const COLS: { key: string; label: string; type: ColType; sort?: string; dateKeys?: [string, string] }[] = [
  { key: 'five_l_number', label: 'PO Number', type: 'text', sort: 'five_l_number' },
  { key: 'specification', label: 'Specification', type: 'text', sort: 'specification' },
  { key: 'customer', label: 'Customer', type: 'text', sort: 'customer' },
  { key: 'paper_type', label: 'Paper Type', type: 'text', sort: 'paper_type' },
  { key: 'machine', label: 'Machine', type: 'text', sort: 'machine' },
  { key: 'shift', label: 'Shift', type: 'text', sort: 'shift' },
  { key: 'inspector', label: 'Inspector', type: 'text', sort: 'inspector' },
  { key: 'production_date', label: 'Production', type: 'date', sort: 'production_date', dateKeys: ['prod_from', 'prod_to'] },
  { key: 'expiration_date', label: 'Retention Until', type: 'date', sort: 'expiration_date', dateKeys: ['exp_from', 'exp_to'] },
  { key: 'days_left', label: 'Time Left', type: 'none', sort: 'days_left' },
  { key: 'storage_location', label: 'Location', type: 'location', sort: 'storage_location' },
  { key: 'status', label: 'Status', type: 'status', sort: 'status' },
  { key: 'remark', label: 'Remark', type: 'text', sort: 'remark' },
];

export default function SamplesPage({ preset }: { preset: SamplesPreset }) {
  const { canWrite, isAdmin } = useAuth();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState('created_at');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Map<string, Sample>>(new Map());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Sample | null>(null);
  const [viewing, setViewing] = useState<Sample | null>(null);
  const [moving, setMoving] = useState<Sample[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [deleting, setDeleting] = useState<Sample | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Apply filters coming from the dashboard / global search.
  useEffect(() => {
    if (preset.nonce === 0) return;
    setFilters({ ...(preset.status ? { status: preset.status } : {}), ...(preset.storage_location ? { storage_location: preset.storage_location } : {}) });
    setQ(preset.q ?? '');
    setPage(1); setSelected(new Map());
    setShowFilters(!!(preset.status || preset.storage_location));
  }, [preset]);

  const dFilters = useDebounced(filters);
  const dQ = useDebounced(q);
  const applied = useMemo(() => ({ ...dFilters, q: dQ }), [dFilters, dQ]);
  const list = useList<Sample>('/samples', { ...applied, page, pageSize, sort, dir });

  const setFilter = (k: string, v: string) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };
  const activeCount = Object.values(filters).filter(Boolean).length + (q ? 1 : 0);
  const clearAll = () => { setFilters({}); setQ(''); setPage(1); };
  const toggleSort = (s: string) => {
    if (sort === s) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(s); setDir('asc'); }
    setPage(1);
  };

  const selectable = list.data.filter((s) => s.status !== 'disposed');
  const allOnPage = selectable.length > 0 && selectable.every((s) => selected.has(s.id));
  const togglePage = () => setSelected((m) => {
    const n = new Map(m);
    if (allOnPage) selectable.forEach((s) => n.delete(s.id)); else selectable.forEach((s) => n.set(s.id, s));
    return n;
  });
  const toggleOne = (s: Sample) => setSelected((m) => { const n = new Map(m); if (n.has(s.id)) n.delete(s.id); else n.set(s.id, s); return n; });

  async function handleDelete() {
    if (!deleting) return;
    try { await api.del(`/samples/${deleting.id}`); setDeleting(null); list.reload(); } catch (e) { setActionError(errMsg(e)); setDeleting(null); }
  }

  const SortIcon = ({ s }: { s?: string }) => !s ? null : sort === s ? (dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;

  const actions = (s: Sample) => (
    <div className="flex justify-end gap-0.5">
      <button className="btn-ghost px-2 py-1.5" title="View details" aria-label="View details" onClick={() => setViewing(s)}><Eye className="h-4 w-4" /></button>
      {canWrite && s.status !== 'disposed' && <>
        <button className="btn-ghost px-2 py-1.5" title="Edit" aria-label="Edit" onClick={() => { setEditing(s); setFormOpen(true); }}><Pencil className="h-4 w-4" /></button>
        <button className="btn-ghost px-2 py-1.5" title="Move" aria-label="Move" onClick={() => setMoving([s])}><MapPin className="h-4 w-4" /></button>
      </>}
      {isAdmin && <button className="btn-ghost px-2 py-1.5 text-red-600" title="Delete" aria-label="Delete" onClick={() => setDeleting(s)}><Trash2 className="h-4 w-4" /></button>}
    </div>
  );

  const filterCell = (c: (typeof COLS)[number]) => {
    const base = 'w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-normal normal-case text-slate-800 outline-none focus:border-slate-900';
    if (c.type === 'text') return <input className={base} placeholder="Filter…" aria-label={`Filter ${c.label}`} value={filters[c.key] ?? ''} onChange={(e) => setFilter(c.key, e.target.value)} />;
    if (c.type === 'date' && c.dateKeys) return (
      <div className="space-y-1">
        <input type="date" className={base} aria-label={`${c.label} from`} value={filters[c.dateKeys[0]] ?? ''} onChange={(e) => setFilter(c.dateKeys![0], e.target.value)} />
        <input type="date" className={base} aria-label={`${c.label} to`} value={filters[c.dateKeys[1]] ?? ''} onChange={(e) => setFilter(c.dateKeys![1], e.target.value)} />
      </div>);
    if (c.type === 'status') return <select className={base} aria-label="Filter status" value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)}><option value="">All</option>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>;
    if (c.type === 'location') return <select className={base} aria-label="Filter location" value={filters.storage_location ?? ''} onChange={(e) => setFilter('storage_location', e.target.value)}><option value="">All</option>{LOCATION_OPTIONS.map((l) => <option key={l}>{l}</option>)}</select>;
    return null;
  };

  const cell = (s: Sample, key: string) => {
    switch (key) {
      case 'five_l_number': return <span className="font-semibold text-slate-900">{s.five_l_number}</span>;
      case 'production_date': case 'expiration_date': return formatDate(s[key]);
      case 'days_left': return s.status === 'disposed' ? '—' : <span className={s.status === 'ready_for_disposal' ? 'font-semibold text-orange-600' : s.status === 'near_expired' ? 'text-amber-600' : ''}>{daysLabel(s.days_left)}</span>;
      case 'storage_location': return <>{s.storage_location}{s.rack_detail && <span className="text-slate-400"> · {s.rack_detail}</span>}</>;
      case 'status': return <StatusBadge status={s.status} />;
      default: return (s as unknown as Record<string, string | null>)[key] ?? '—';
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Samples</h1>
          <p className="mt-0.5 text-sm text-slate-500">{list.total.toLocaleString()} record{list.total === 1 ? '' : 's'}{activeCount > 0 && ' match your filters'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className={`btn-secondary ${showFilters ? 'ring-2 ring-slate-900/10' : ''}`} onClick={() => setShowFilters((v) => !v)}><Filter className="h-4 w-4" />Column filters{activeCount > 0 && <span className="rounded-full bg-slate-900 px-1.5 text-[10px] text-white">{activeCount}</span>}</button>
          <button className="btn-secondary" onClick={() => setExportOpen(true)}><Download className="h-4 w-4" />Export</button>
          {canWrite && <button className="btn-secondary" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" />Import</button>}
          {canWrite && <button className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" />Add Sample</button>}
        </div>
      </div>

      {(q || activeCount > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {q && <span className="badge border-slate-300 bg-white text-slate-700">Search: “{q}”<button aria-label="Clear search" onClick={() => { setQ(''); setPage(1); }}><X className="h-3 w-3" /></button></span>}
          <button className="text-slate-500 underline" onClick={clearAll}>Clear all filters</button>
        </div>
      )}

      {selected.size > 0 && canWrite && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white">
          <span><b>{selected.size}</b> selected</span>
          <div className="flex gap-2">
            <button className="rounded-lg bg-white px-3 py-1.5 font-medium text-slate-900" onClick={() => setMoving([...selected.values()])}><MapPin className="mr-1.5 inline h-4 w-4" />Move selected</button>
            <button className="rounded-lg px-3 py-1.5 text-slate-300 hover:text-white" onClick={() => setSelected(new Map())}>Clear</button>
          </div>
        </div>
      )}
      {(list.error || actionError) && <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{list.error ?? actionError}</div>}

      <div className="card overflow-hidden">
        {/* Desktop / tablet table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                {canWrite && <th className="w-10 px-3 py-3"><input type="checkbox" aria-label="Select all on page" checked={allOnPage} onChange={togglePage} /></th>}
                {COLS.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-3 py-3 align-top" aria-sort={sort === c.sort ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {c.sort ? <button className="inline-flex items-center gap-1 hover:text-slate-900" onClick={() => toggleSort(c.sort!)}>{c.label}<SortIcon s={c.sort} /></button> : c.label}
                  </th>
                ))}
                <th className="px-3 py-3" />
              </tr>
              {showFilters && (
                <tr className="bg-slate-50/60">
                  {canWrite && <th />}
                  {COLS.map((c) => <th key={c.key} className="px-3 pb-3 align-top">{filterCell(c)}</th>)}
                  <th />
                </tr>
              )}
            </thead>
            <tbody className={list.loading ? 'opacity-60 transition' : 'transition'}>
              {list.data.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                  {canWrite && <td className="px-3 py-2.5">{s.status !== 'disposed' && <input type="checkbox" aria-label={`Select ${s.five_l_number}`} checked={selected.has(s.id)} onChange={() => toggleOne(s)} />}</td>}
                  {COLS.map((c) => <td key={c.key} className={`px-3 py-2.5 text-slate-700 ${c.key === 'customer' || c.key === 'remark' ? 'max-w-[220px] truncate' : 'whitespace-nowrap'}`} title={c.key === 'customer' || c.key === 'remark' ? String(cell(s, c.key) ?? '') : undefined}>{cell(s, c.key)}</td>)}
                  <td className="px-3 py-2">{actions(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-slate-100 md:hidden">
          <div className="space-y-2 p-3">
            <input className="input" placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search samples" />
            <div className="grid grid-cols-2 gap-2">
              <select className="input" aria-label="Status" value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)}><option value="">All statuses</option>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <select className="input" aria-label="Location" value={filters.storage_location ?? ''} onChange={(e) => setFilter('storage_location', e.target.value)}><option value="">All locations</option>{LOCATION_OPTIONS.map((l) => <option key={l}>{l}</option>)}</select>
            </div>
          </div>
          {list.data.map((s) => (
            <div key={s.id} className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2"><div><div className="font-semibold text-slate-900">{s.five_l_number}</div><div className="text-xs text-slate-500">{s.customer ?? '—'}</div></div><StatusBadge status={s.status} /></div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                <span>Spec: {s.specification ?? '—'}</span><span>Machine: {s.machine ?? '—'}</span>
                <span>Produced: {formatDate(s.production_date)}</span><span>Until: {formatDate(s.expiration_date)}</span>
                <span>{s.storage_location}</span><span>{s.status !== 'disposed' && daysLabel(s.days_left)}</span>
              </div>
              {actions(s)}
            </div>
          ))}
        </div>

        {list.loading && list.data.length === 0 && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
        {!list.loading && list.data.length === 0 && <div className="px-4 py-16 text-center text-sm text-slate-400">No samples match.</div>}
        <Pagination page={page} pageSize={pageSize} total={list.total} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Sample' : 'Add Sample Manually'} size="lg">
        <SampleForm sample={editing} onSaved={() => { setFormOpen(false); list.reload(); }} onCancel={() => setFormOpen(false)} />
      </Modal>
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Sample Details" size="lg">{viewing && <SampleDetail sample={viewing} />}</Modal>
      <Modal open={!!moving} onClose={() => setMoving(null)} title="Move Sample Location" size="md">
        {moving && <MoveLocationModal samples={moving} onDone={() => { setMoving(null); setSelected(new Map()); list.reload(); }} onCancel={() => setMoving(null)} />}
      </Modal>
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import from Excel" size="xl">
        <ImportExcelModal onDone={() => { setImportOpen(false); list.reload(); }} onCancel={() => setImportOpen(false)} />
      </Modal>
      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Export Report" size="md"><ExportModal filters={applied} onDone={() => setExportOpen(false)} /></Modal>
      <ConfirmModal open={!!deleting} title="Delete sample" danger confirmLabel="Delete" onConfirm={handleDelete} onClose={() => setDeleting(null)}>
        Permanently delete <b>{deleting?.five_l_number}</b>? The deletion is recorded in the audit trail; movement history is kept.
      </ConfirmModal>
    </div>
  );
}
