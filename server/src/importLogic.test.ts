import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addMonths, classify, parseImport, toDateStr } from './importLogic.js';

const headers = ['Spesifikasi', '5 L = ', 'Customer', 'Jenis Kertas', 'Mesin', 'Shift', 'Inspector', 'Tanggal Pembuatan', 'Tanggal Kadaluarsa', 'Remark'];

test('maps the template headers and coerces numeric cells', () => {
  const r = parseImport({ headers, firstDataRow: 3, rows: [['1LPR', 1033439, 'ACME', 'HT335', 'AZ7-2', 2, 'REFLI', 46024, 46391, 'P = 8']] });
  assert.deepEqual(r.fileErrors, []);
  assert.equal(r.rows[0].data?.five_l_number, '1033439');
  assert.equal(r.rows[0].data?.shift, '2');
  assert.equal(r.rows[0].data?.production_date, '2026-01-02'); // Excel serial 46024
  assert.equal(r.rows[0].row, 3);
});

test('retention is production date + 13 months with month-end clamping (matches MySQL DATE_ADD)', () => {
  assert.equal(addMonths('2026-01-02', 13), '2027-02-02');
  assert.equal(addMonths('2026-01-31', 13), '2027-02-28');
  assert.equal(addMonths('2026-12-15', 13), '2028-01-15');
});

test('date parsing: day-first strings accepted, impossible/typo dates rejected', () => {
  assert.equal(toDateStr('05/09/2026'), '2026-09-05');
  assert.equal(toDateStr('5 Jan 2026'), '2026-01-05');
  assert.equal(toDateStr('05/09/206'), null);
  const r = parseImport({ headers, rows: [['x', 'A1', 'c', 'p', 'm', 1, 'i', '2026-08-32', null, null]] });
  assert.equal(r.rows[0].data, null);
  assert.match(r.rows[0].errors[0], /out of range/);
});

test('missing required columns are reported at file level', () => {
  const r = parseImport({ headers: ['Customer'], rows: [['x']] });
  assert.equal(r.fileErrors.length, 2);
});

test('duplicates: first occurrence wins, existing keys flagged', () => {
  const row = (five: unknown, m: string) => ['s', five, 'c', 'p', m, 1, 'i', 46024, null, null];
  const { rows } = parseImport({ headers, rows: [row('A1', 'M1'), row('A1', 'M1'), row('A1', 'M2'), row('B2', 'M1')] });
  const states = classify(rows, new Set(['B2|M1|1'])).map((c) => c.state);
  assert.deepEqual(states, ['new', 'duplicate_in_file', 'new', 'duplicate_existing']);
});
