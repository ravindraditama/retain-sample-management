import { useState } from 'react';
import { Loader2, MoveRight } from 'lucide-react';
import { api, errMsg } from '@/lib/api';
import { LOCATION_OPTIONS, type Sample, type StorageLocation } from '@/lib/types';

interface Props {
  /** One sample (single move) or several (bulk move). */
  samples: Sample[];
  onDone: () => void;
  onCancel: () => void;
}

export default function MoveLocationModal({ samples, onDone, onCancel }: Props) {
  const single = samples.length === 1 ? samples[0] : null;
  const [dest, setDest] = useState<StorageLocation>(single?.storage_location === 'Rack' ? 'Transit Area' : 'Rack');
  const [rack, setRack] = useState(single?.rack_detail ?? '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function move() {
    setSaving(true); setError(null);
    try {
      const r = await api.post<{ moved: number; skipped: number }>('/samples/move', {
        ids: samples.map((s) => s.id), location: dest, rack_detail: rack, note,
      });
      if (r.moved === 0) { setError('Nothing changed: the selected samples are already in that location.'); return; }
      onDone();
    } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-50 px-4 py-3">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{single ? 'Sample' : 'Samples'}</div>
        <div className="mt-0.5 text-sm font-semibold text-slate-900">
          {single ? `${single.five_l_number} · ${single.customer ?? '—'}` : `${samples.length} selected samples`}
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <span className="badge border-slate-200 bg-white text-slate-700">{single ? single.storage_location : 'Current locations'}</span>
          <MoveRight className="h-4 w-4 text-slate-400" />
          <span className="badge border-slate-900 bg-slate-900 text-white">{dest}</span>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="m-dest">Destination</label>
        <select id="m-dest" className="input" value={dest} onChange={(e) => setDest(e.target.value as StorageLocation)}>
          {LOCATION_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      {dest === 'Rack' && (
        <div>
          <label className="label" htmlFor="m-rack">Rack / Shelf detail</label>
          <input id="m-rack" className="input" value={rack} onChange={(e) => setRack(e.target.value)} placeholder="e.g. Rack B-2" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="m-note">Note (optional)</label>
        <textarea id="m-note" className="input min-h-[60px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for move…" />
      </div>
      {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="flex justify-end gap-3">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={move} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoveRight className="h-4 w-4" />}
          Move {single ? 'Sample' : `${samples.length} Samples`}
        </button>
      </div>
    </div>
  );
}
