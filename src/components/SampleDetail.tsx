import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Movement, Sample } from '@/lib/types';
import { daysLabel, formatDate, formatDateTime } from '@/lib/sampleStatus';
import StatusBadge from '@/components/StatusBadge';
import { MapPin, MoveRight, Clock, FileText } from 'lucide-react';

const FIELDS: { key: keyof Sample; label: string }[] = [
  { key: 'specification', label: 'Specification' },
  { key: 'five_l_number', label: 'PO Number' },
  { key: 'customer', label: 'Customer' },
  { key: 'paper_type', label: 'Paper Type' },
  { key: 'machine', label: 'Machine' },
  { key: 'shift', label: 'Shift' },
  { key: 'inspector', label: 'Inspector' },
  { key: 'production_date', label: 'Production Date' },
  { key: 'expiration_date', label: 'Retention Date (+13 months)' },
  { key: 'storage_location', label: 'Storage Location' },
  { key: 'rack_detail', label: 'Rack / Shelf Detail' },
  { key: 'remark', label: 'Remark' },
];

export default function SampleDetail({ sample }: { sample: Sample }) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.get<{ data: Movement[] }>(`/samples/${sample.id}/movements`)
      .then((r) => { if (alive) setMovements(r.data); })
      .catch(() => undefined)
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sample.id]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{sample.five_l_number || 'Sample'}</h3>
          <p className="text-sm text-slate-500">{sample.specification || '—'} · {sample.customer || '—'}</p>
        </div>
        <StatusBadge status={sample.status} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const v = sample[f.key];
          const display = (f.key === 'production_date' || f.key === 'expiration_date')
            ? formatDate(v as string)
            : (v === null || v === '' ? '—' : String(v));
          return (
            <div key={f.key} className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{f.label}</div>
              <div className="mt-0.5 text-sm text-slate-900">{display}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-100 p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Created</div>
        <div className="mt-0.5 text-sm text-slate-700">{formatDateTime(sample.created_at)}</div>
        {!sample.disposed_at && <><div className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Retention</div><div className="mt-0.5 text-sm text-slate-700">{daysLabel(sample.days_left)}</div></>}
        {sample.disposed_at && (
          <>
            <div className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Disposed At</div>
            <div className="mt-0.5 text-sm text-slate-700">{formatDateTime(sample.disposed_at)}</div>
          </>
        )}
      </div>

      {/* Movement history */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-600" />
          <h4 className="text-sm font-semibold text-slate-900">Movement History</h4>
        </div>
        {loading ? (
          <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
        ) : movements.length === 0 ? (
          <div className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
            No location changes recorded.
          </div>
        ) : (
          <div className="space-y-2">
            {movements.map((m) => (
              <div key={m.id} className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <MoveRight className="h-3.5 w-3.5 text-slate-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-900">
                    <span className="font-medium">{m.old_location || '—'}</span>
                    <span className="mx-1.5 text-slate-400">→</span>
                    <span className="font-medium">{m.new_location}</span>
                  </div>
                  <div className="text-xs text-slate-500">{m.kind === 'dispose' ? 'Disposal' : m.kind === 'create' ? 'Initial placement' : 'Move'} · {m.moved_by_name ?? '—'}</div>
                  {m.note && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <FileText className="h-3 w-3" /> {m.note}
                    </div>
                  )}
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="h-3 w-3" /> {formatDateTime(m.moved_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
