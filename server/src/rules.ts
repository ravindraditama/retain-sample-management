// Pure business rules (no DB / config imports) so they can be unit-tested anywhere.
export const LOCATIONS = ['Rack', 'Transit Area', 'Dump Trash'] as const;
export type Location = (typeof LOCATIONS)[number];

const clean = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

/**
 * Normalised duplicate key. DUPLICATE_MODE (read at call time):
 *   five_l               -> 5L Number only
 *   five_l_machine_shift -> 5L Number + Machine + Shift (default; the real Excel repeats a 5L across machines/shifts)
 */
export function dupKey(s: { five_l_number?: unknown; machine?: unknown; shift?: unknown }): string {
  return process.env.DUPLICATE_MODE === 'five_l'
    ? clean(s.five_l_number)
    : [clean(s.five_l_number), clean(s.machine), clean(s.shift)].join('|');
}

export function isValidDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 2000 && y <= 2100;
}
