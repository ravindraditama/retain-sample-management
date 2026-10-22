import type { SampleStatus } from './types';

export const STATUS_COLORS: Record<SampleStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  near_expired: 'bg-amber-100 text-amber-700 border-amber-200',
  ready_for_disposal: 'bg-orange-100 text-orange-700 border-orange-200',
  disposed: 'bg-slate-200 text-slate-600 border-slate-300',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Production date + 13 months, clamped to month end (same rule as the database). */
export function computeExpiration(productionDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(productionDate)) return null;
  const [y, m, d] = productionDate.split('-').map(Number);
  const total = m - 1 + 13;
  const ty = y + Math.floor(total / 12);
  const tm = total % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return `${ty}-${pad(tm + 1)}-${pad(Math.min(d, last))}`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function daysLabel(days: number | null): string {
  if (days === null || days === undefined) return '—';
  if (days === 0) return 'Due today';
  return days < 0 ? `${-days}d overdue` : `${days}d left`;
}
