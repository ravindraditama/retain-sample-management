import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { api, errMsg } from '@/lib/api';
import { LOCATION_OPTIONS, SHIFT_OPTIONS, type Sample, type SampleInput, type StorageLocation } from '@/lib/types';
import { computeExpiration, formatDate } from '@/lib/sampleStatus';

interface Props { sample: Sample | null; onSaved: () => void; onCancel: () => void }

const EMPTY: SampleInput = {
  specification: '', five_l_number: '', customer: '', paper_type: '', machine: '', shift: '', inspector: '',
  production_date: '', remark: '', storage_location: 'Rack', rack_detail: '',
};

export default function SampleForm({ sample, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<SampleInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(sample ? {
      specification: sample.specification ?? '', five_l_number: sample.five_l_number ?? '', customer: sample.customer ?? '',
      paper_type: sample.paper_type ?? '', machine: sample.machine ?? '', shift: sample.shift ?? '', inspector: sample.inspector ?? '',
      production_date: sample.production_date ?? '', remark: sample.remark ?? '', storage_location: sample.storage_location, rack_detail: sample.rack_detail ?? '',
    } : EMPTY);
  }, [sample]);

  const expiration = computeExpiration(form.production_date);
  const set = <K extends keyof SampleInput>(k: K, v: SampleInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      if (sample) await api.put(`/samples/${sample.id}`, form); else await api.post('/samples', form);
      onSaved();
    } catch (err) { setError(errMsg(err)); } finally { setSaving(false); }
  }

  const text = (k: keyof SampleInput, label: string, required = false, extra = '') => (
    <div className={extra}>
      <label className="label" htmlFor={`f-${k}`}>{label}{required && ' *'}</label>
      <input id={`f-${k}`} className="input" required={required} value={form[k]} onChange={(e) => set(k, e.target.value as never)} />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {text('specification', 'Specification')}
        {text('five_l_number', 'PO Number', true)}
        {text('customer', 'Customer')}
        {text('paper_type', 'Paper Type')}
        {text('machine', 'Machine')}
        <div>
          <label className="label" htmlFor="f-shift">Shift</label>
          <select id="f-shift" className="input" value={form.shift} onChange={(e) => set('shift', e.target.value)}>
            <option value="">—</option>{SHIFT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {text('inspector', 'Inspector')}
        <div>
          <label className="label" htmlFor="f-prod">Production Date *</label>
          <input id="f-prod" type="date" required min="2000-01-01" max="2100-12-31" className="input" value={form.production_date} onChange={(e) => set('production_date', e.target.value)} />
        </div>
        <div>
          <label className="label">Expiration Date (auto: +13 months)</label>
          <input className="input bg-slate-50" disabled value={expiration ? formatDate(expiration) : ''} />
        </div>
        <div>
          <label className="label" htmlFor="f-loc">Storage Location</label>
          <select id="f-loc" className="input" value={form.storage_location} onChange={(e) => set('storage_location', e.target.value as StorageLocation)}>
            {LOCATION_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        {form.storage_location === 'Rack' && text('rack_detail', 'Rack / Shelf Detail')}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="f-remark">Remark</label>
          <textarea id="f-remark" className="input min-h-[80px]" value={form.remark} onChange={(e) => set('remark', e.target.value)} />
        </div>
      </div>
      {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{sample ? 'Save Changes' : 'Add Sample'}</button>
      </div>
    </form>
  );
}
