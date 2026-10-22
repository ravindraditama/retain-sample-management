import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { api, errMsg } from '@/lib/api';
import { exportSamples, type ExportFormat } from '@/lib/exporters';
import type { Sample } from '@/lib/types';

interface Props {
  /** Filters currently applied (when opened from the Samples page). */
  filters?: Record<string, string>;
  onDone: () => void;
}

const SCOPES = [
  { key: 'filtered', label: 'Current view (applied filters)' },
  { key: 'all', label: 'All samples' },
  { key: 'near_expired', label: 'Near expiry (≤ 30 days)' },
  { key: 'ready_for_disposal', label: 'Ready for disposal' },
  { key: 'disposed', label: 'Disposed samples' },
] as const;

export default function ExportModal({ filters, onDone }: Props) {
  const hasFilters = !!filters && Object.values(filters).some(Boolean);
  const [scope, setScope] = useState<(typeof SCOPES)[number]['key']>(hasFilters ? 'filtered' : 'all');
  const [format, setFormat] = useState<ExportFormat>('excel');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true); setError(null);
    try {
      const query = scope === 'filtered' ? { ...filters } : scope === 'all' ? {} : { status: scope };
      const r = await api.get<{ data: Sample[]; total: number }>('/samples/export', { ...query, sort: 'expiration_date', dir: 'asc' });
      if (r.total === 0) { setError('Nothing to export for this selection.'); return; }
      const label = SCOPES.find((s) => s.key === scope)!.label;
      exportSamples(format, r.data, `Retain Sample Report — ${label}`, `retain-samples-${scope}`);
      onDone();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  const opt = (active: boolean) => `flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${active ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'}`;
  return (
    <div className="space-y-5">
      <div>
        <div className="label">Format</div>
        <div className="grid grid-cols-2 gap-3">
          <label className={opt(format === 'excel')}><input type="radio" className="hidden" checked={format === 'excel'} onChange={() => setFormat('excel')} /><FileSpreadsheet className="h-5 w-5 text-emerald-600" /> Excel (.xlsx)</label>
          <label className={opt(format === 'pdf')}><input type="radio" className="hidden" checked={format === 'pdf'} onChange={() => setFormat('pdf')} /><FileText className="h-5 w-5 text-red-600" /> PDF</label>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">PDF is best for up to a few thousand rows; use Excel for the full list.</p>
      </div>
      <div>
        <div className="label">What to export</div>
        <div className="space-y-2">
          {SCOPES.filter((s) => s.key !== 'filtered' || hasFilters).map((s) => (
            <label key={s.key} className={opt(scope === s.key)}>
              <input type="radio" checked={scope === s.key} onChange={() => setScope(s.key)} /> {s.label}
            </label>
          ))}
        </div>
      </div>
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="flex justify-end gap-3">
        <button className="btn-secondary" onClick={onDone}>Cancel</button>
        <button className="btn-primary" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
        </button>
      </div>
    </div>
  );
}
