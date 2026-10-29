// Pure import helpers (no DB access) so they can be unit-tested against the real Excel data.
import { dupKey, isValidDate, LOCATIONS, type Location } from './rules.js';

export interface SampleFields {
  specification: string | null;
  five_l_number: string;
  customer: string | null;
  paper_type: string | null;
  machine: string | null;
  shift: string | null;
  inspector: string | null;
  production_date: string;
  remark: string | null;
  storage_location: Location | null;
  rack_detail: string | null;
}

export interface RawImport {
  headers: unknown[];
  rows: unknown[][];
  /** Spreadsheet row number of rows[0] (for friendly error messages). */
  firstDataRow?: number;
}

export interface ParsedRow {
  row: number;
  data: SampleFields | null;
  key: string | null;
  errors: string[];
  fileExpiration: string | null;
}

type Field = keyof SampleFields | 'expiration_date';

const norm = (h: unknown) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Keys are normalised headers: lower-case, punctuation/spaces removed. "5 L = " -> "5l".
const ALIASES: Record<string, Field> = {
  spesifikasi: 'specification', specification: 'specification', spec: 'specification',
  ponumber: 'five_l_number', pono: 'five_l_number', po: 'five_l_number', nomorpo: 'five_l_number',
  '5l': 'five_l_number', '5lnumber': 'five_l_number', '5lno': 'five_l_number', fivelnumber: 'five_l_number', nomor5l: 'five_l_number',
  customer: 'customer', pelanggan: 'customer',
  jeniskertas: 'paper_type', papertype: 'paper_type', kertas: 'paper_type',
  mesin: 'machine', machine: 'machine',
  shift: 'shift',
  inspector: 'inspector',
  tanggalpembuatan: 'production_date', productiondate: 'production_date', tglpembuatan: 'production_date',
  tanggalkadaluarsa: 'expiration_date', expirationdate: 'expiration_date', tglkadaluarsa: 'expiration_date',
  remark: 'remark', keterangan: 'remark',
  storagelocation: 'storage_location', lokasi: 'storage_location', location: 'storage_location',
  rackdetail: 'rack_detail', rack: 'rack_detail',
};

export function text(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null;
  const s = String(v).trim().replace(/\s+/g, ' ');
  return s === '' ? null : s;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, agu: 8, agt: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12 };
const pad = (n: number) => String(n).padStart(2, '0');

/** Accepts Excel serial numbers, ISO strings, and day-first strings (dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, "2 Jan 2026"). */
export function toDateStr(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    if (v < 1 || v > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  m = s.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,})[a-z]*[\s\-,]+(\d{4})$/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].slice(0, 3).toLowerCase()])}-${pad(+m[1])}`;
  return null;
}

/** Same rule as MySQL DATE_ADD(date, INTERVAL n MONTH): day is clamped to the end of the target month. */
export function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const total = m - 1 + months;
  const ty = y + Math.floor(total / 12);
  const tm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return `${ty}-${pad(tm + 1)}-${pad(Math.min(d, last))}`;
}

export function matchLocation(v: unknown): Location | null {
  const s = norm(v);
  return LOCATIONS.find((l) => norm(l) === s) ?? null;
}

export function parseImport(raw: RawImport): { rows: ParsedRow[]; fileErrors: string[]; blank: number } {
  const fileErrors: string[] = [];
  const colMap = new Map<number, Field>();
  (raw.headers ?? []).forEach((h, i) => {
    const f = ALIASES[norm(h)];
    if (f && ![...colMap.values()].includes(f)) colMap.set(i, f);
  });
  const found = new Set(colMap.values());
  if (!found.has('five_l_number')) fileErrors.push('Column "PO Number" (header "PO Number" or "5 L =") was not found.');
  if (!found.has('production_date')) fileErrors.push('Column "Production Date" (Tanggal Pembuatan) was not found.');
  if (fileErrors.length) return { rows: [], fileErrors, blank: 0 };

  const start = raw.firstDataRow ?? 2;
  const out: ParsedRow[] = [];
  let blank = 0;

  (raw.rows ?? []).forEach((cells, idx) => {
    const rec: Partial<Record<Field, unknown>> = {};
    colMap.forEach((f, i) => { rec[f] = cells?.[i]; });
    const empty = [...colMap.keys()].every((i) => text(cells?.[i]) === null);
    if (empty) { blank++; return; }

    const errors: string[] = [];
    const five = text(rec.five_l_number);
    const prod = toDateStr(rec.production_date);
    if (!five) errors.push('Missing PO Number');
    if (!prod) errors.push(`Production date is missing or unreadable (${text(rec.production_date) ?? 'empty'})`);
    else if (!isValidDate(prod)) errors.push(`Production date out of range (${prod})`);

    const loc = rec.storage_location != null && text(rec.storage_location) ? matchLocation(rec.storage_location) : null;
    if (rec.storage_location != null && text(rec.storage_location) && !loc) errors.push(`Unknown storage location "${text(rec.storage_location)}"`);

    const data: SampleFields | null = errors.length ? null : {
      specification: text(rec.specification), five_l_number: five!, customer: text(rec.customer),
      paper_type: text(rec.paper_type), machine: text(rec.machine), shift: text(rec.shift),
      inspector: text(rec.inspector), production_date: prod!, remark: text(rec.remark),
      storage_location: loc, rack_detail: text(rec.rack_detail),
    };
    out.push({
      row: start + idx, data, errors, key: data ? dupKey(data) : null,
      fileExpiration: toDateStr(rec.expiration_date),
    });
  });
  return { rows: out, fileErrors, blank };
}

export type RowState = 'new' | 'duplicate_existing' | 'duplicate_in_file' | 'invalid';

/** Classify parsed rows against keys already in the DB. First occurrence in the file wins. */
export function classify(rows: ParsedRow[], existing: Set<string>): { row: ParsedRow; state: RowState }[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    if (!row.data || !row.key) return { row, state: 'invalid' as const };
    if (seen.has(row.key)) return { row, state: 'duplicate_in_file' as const };
    seen.add(row.key);
    return { row, state: existing.has(row.key) ? ('duplicate_existing' as const) : ('new' as const) };
  });
}
