import { useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { api, errMsg } from '@/lib/api';
import { downloadTemplate, readExcelFile, type RawSheet } from '@/lib/exporters';
import { formatDate } from '@/lib/sampleStatus';
import { LOCATION_OPTIONS, type StorageLocation } from '@/lib/types';
import Pagination from './Pagination';

type RowState = 'new' | 'duplicate_existing' | 'duplicate_in_file' | 'invalid';
interface PreviewRow {
  row: number; state: RowState; errors: string[]; five_l_number: string | null; customer: string | null; specification: string | null;
  machine: string | null; shift: string | null; production_date: string | null; expiration_date: string | null;
}
interface Preview {
  total: number; blank: number; counts: Record<RowState, number>; expirationMismatches: number; rows: PreviewRow[];
}
interface Result { inserted: number; updated: number; skipped: number; invalid: number }

const STATE_META: Record<RowState, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  duplicate_existing: { label: 'Already exists', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  duplicate_in_file: { label: 'Duplicate in file', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  invalid: { label: 'Invalid', cls: 'bg-red-100 text-red-700 border-red-200' },
};

export default function ImportExcelModal({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState<RawSheet | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [mode, setMode] = useState<'skip' | 'update'>('skip');
  const [location, setLocation] = useState<StorageLocation>('Rack');
  const [filter, setFilter] = useState<RowState | 'all'>('all');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<'reading' | 'importing' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(f: File) {
    setFile(f); setError(null); setPreview(null); setResult(null); setFilter('all'); setPage(1); setBusy('reading');
    try {
      const s = await readExcelFile(f);
      setSheet(s);
      setPreview(await api.post<Preview>('/import/preview', { headers: s.headers, rows: s.rows, firstDataRow: s.firstDataRow }));
    } catch (e) { setSheet(null); setError(errMsg(e)); } finally { setBusy(null); }
  }

  async function commit() {
    if (!sheet || !file) return;
    setBusy('importing'); setError(null);
    try {
      setResult(await api.post<Result>('/import/commit', {
        headers: sheet.headers, rows: sheet.rows, firstDataRow: sheet.firstDataRow, mode, default_location: location, filename: file.name,
      }));
    } catch (e) { setError(errMsg(e)); } finally { setBusy(null); }
  }

  const shown = useMemo(() => (preview?.rows ?? []).filter((r) => filter === 'all' || r.state === filter), [preview, filter]);
  const PAGE = 50;
  const pageRows = shown.slice((page - 1) * PAGE, page * PAGE);
  const willSave = preview ? preview.counts.new + (mode === 'update' ? preview.counts.duplicate_existing : 0) : 0;

  if (result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-base font-semibold text-slate-900"><CheckCircle2 className="h-5 w-5 text-emerald-600" />Import complete</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Added', result.inserted], ['Updated', result.updated], ['Skipped', result.skipped], ['Invalid', result.invalid]].map(([l, n]) => (
            <div key={l as string} className="rounded-lg border border-slate-200 p-3 text-center"><div className="text-2xl font-bold">{(n as number).toLocaleString()}</div><div className="text-xs text-slate-500">{l}</div></div>
          ))}
        </div>
        <div className="flex justify-end"><button className="btn-primary" onClick={onDone}>Done</button></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        <span>Upload the standard Excel template (header row is detected automatically). Retention date is always recalculated as production date + 13 months.</span>
        <button className="btn-ghost text-sky-700" onClick={downloadTemplate}><Download className="h-4 w-4" />Template</button>
      </div>

      <div onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
        className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-slate-400 hover:bg-slate-100">
        {busy === 'reading' ? <Loader2 className="h-8 w-8 animate-spin text-slate-400" /> : <FileSpreadsheet className="h-8 w-8 text-slate-400" />}
        <div className="mt-2 text-sm font-medium text-slate-700">{file ? file.name : 'Click or drag an .xlsx file here'}</div>
        {sheet && <div className="mt-1 text-xs text-slate-400">Sheet “{sheet.sheetName}” · {sheet.rows.length.toLocaleString()} rows read</div>}
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      </div>

      {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {preview && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(STATE_META) as RowState[]).map((s) => (
              <button key={s} onClick={() => { setFilter(filter === s ? 'all' : s); setPage(1); }}
                className={`rounded-lg border p-3 text-left transition ${filter === s ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className="text-xl font-bold text-slate-900">{preview.counts[s].toLocaleString()}</div>
                <div className="text-xs text-slate-500">{STATE_META[s].label}</div>
              </button>
            ))}
          </div>

          {preview.expirationMismatches > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              The “Tanggal Kadaluarsa” column differs from production date + 13 months in {preview.expirationMismatches.toLocaleString()} rows. The file’s column is ignored and the retention date is recalculated.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="label">Records that already exist ({preview.counts.duplicate_existing.toLocaleString()})</legend>
              {([['skip', 'Skip them (keep existing data)'], ['update', 'Update them with the values from the file']] as const).map(([k, l]) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" checked={mode === k} onChange={() => setMode(k)} />{l}</label>
              ))}
            </fieldset>
            <div>
              <label className="label" htmlFor="imp-loc">Storage location for new samples</label>
              <select id="imp-loc" className="input" value={location} onChange={(e) => setLocation(e.target.value as StorageLocation)}>
                {LOCATION_OPTIONS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-100 text-left text-slate-600">
                  <tr>{['Row', 'Status', 'PO Number', 'Customer', 'Machine', 'Shift', 'Production', 'Retention until'].map((h) => <th key={h} className="whitespace-nowrap px-2 py-2">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.row} className="border-t border-slate-100 align-top">
                      <td className="px-2 py-1.5 text-slate-400">{r.row}</td>
                      <td className="px-2 py-1.5"><span className={`badge ${STATE_META[r.state].cls}`}>{STATE_META[r.state].label}</span>{r.errors.length > 0 && <div className="mt-1 text-red-600">{r.errors.join('; ')}</div>}</td>
                      <td className="px-2 py-1.5 font-medium">{r.five_l_number ?? '—'}</td>
                      <td className="max-w-[180px] truncate px-2 py-1.5">{r.customer ?? '—'}</td>
                      <td className="px-2 py-1.5">{r.machine ?? '—'}</td>
                      <td className="px-2 py-1.5">{r.shift ?? '—'}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">{formatDate(r.production_date)}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">{formatDate(r.expiration_date)}</td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && <tr><td colSpan={8} className="px-2 py-6 text-center text-slate-400">No rows in this group.</td></tr>}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE} total={shown.length} onPage={setPage} />
          </div>
        </>
      )}

      <div className="flex justify-end gap-3 pt-1">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={commit} disabled={!preview || busy !== null || willSave === 0}>
          {busy === 'importing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {preview ? `Import ${willSave.toLocaleString()} record${willSave === 1 ? '' : 's'}` : 'Import'}
        </button>
      </div>
      {preview && preview.counts.invalid > 0 && <p className="flex items-center gap-1.5 text-xs text-slate-500"><Copy className="h-3.5 w-3.5" />Invalid rows are never imported. Fix them in Excel and upload again.</p>}
    </div>
  );
}
