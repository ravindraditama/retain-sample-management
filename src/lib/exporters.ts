import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Sample } from './types';
import { STATUS_LABEL } from './types';
import { daysLabel, formatDate, formatDateTime } from './sampleStatus';

export type ExportFormat = 'excel' | 'pdf';
const stamp = () => new Date().toISOString().slice(0, 10);

/** Generic table export used by every report (samples, disposal list, histories, audit). */
export function exportTable(format: ExportFormat, title: string, filename: string, header: string[], body: (string | number)[][]) {
  if (format === 'excel') {
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    ws['!cols'] = header.map((h, i) => ({ wch: Math.min(40, Math.max(h.length + 2, ...body.slice(0, 200).map((r) => String(r[i] ?? '').length + 2))) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
    XLSX.writeFile(wb, `${filename}-${stamp()}.xlsx`);
    return;
  }
  const doc = new jsPDF({ orientation: header.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text(title, 40, 36);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated ${new Date().toLocaleString('en-GB')}  ·  ${body.length} records`, 40, 52);
  autoTable(doc, {
    startY: 64, head: [header], body,
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 30, right: 30 }, theme: 'grid',
    didDrawPage: () => {
      const p = doc.getNumberOfPages();
      doc.setFontSize(8); doc.setTextColor(120);
      doc.text(`Page ${p}`, doc.internal.pageSize.getWidth() - 60, doc.internal.pageSize.getHeight() - 16);
    },
  });
  doc.save(`${filename}-${stamp()}.pdf`);
}

const v = (x: unknown) => (x === null || x === undefined ? '' : String(x));

export function exportSamples(format: ExportFormat, samples: Sample[], title = 'Retain Sample Report', filename = 'retain-samples') {
  const header = ['Specification', 'PO Number', 'Customer', 'Paper Type', 'Machine', 'Shift', 'Inspector', 'Production Date', 'Expiration Date', 'Days Left', 'Location', 'Rack Detail', 'Status', 'Remark'];
  exportTable(format, title, filename, header, samples.map((s) => [
    v(s.specification), v(s.five_l_number), v(s.customer), v(s.paper_type), v(s.machine), v(s.shift), v(s.inspector),
    formatDate(s.production_date), formatDate(s.expiration_date), s.status === 'disposed' ? '' : daysLabel(s.days_left),
    s.storage_location, v(s.rack_detail), STATUS_LABEL[s.status], v(s.remark),
  ]));
}

export { formatDateTime };

// ---------- Excel import helpers ----------
const norm = (h: unknown) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const HEADER_HINTS = ['spesifikasi', 'specification', 'ponumber', '5l', '5lnumber', 'tanggalpembuatan', 'productiondate'];

export interface RawSheet { headers: unknown[]; rows: unknown[][]; firstDataRow: number; sheetName: string }

/**
 * Reads the workbook in the browser. Dates are left as Excel serial numbers (no timezone shifts);
 * the server converts and validates everything. The header row is auto-detected, so the standard
 * template ("RETAIN 5 METER" title in row 1, headers in row 2) works as-is.
 */
export async function readExcelFile(file: File): Promise<RawSheet> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  for (const name of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: null });
    const hi = aoa.slice(0, 20).findIndex((r) => (r ?? []).filter((c) => HEADER_HINTS.includes(norm(c))).length >= 2);
    if (hi < 0) continue;
    const headers = aoa[hi];
    let width = headers.length;
    while (width > 0 && (headers[width - 1] === null || headers[width - 1] === '')) width--;
    return {
      headers: headers.slice(0, width),
      rows: aoa.slice(hi + 1).map((r) => (r ?? []).slice(0, width)),
      firstDataRow: hi + 2,
      sheetName: name,
    };
  }
  throw new Error('Could not find the header row. Expected columns such as "Spesifikasi", "PO Number" and "Tanggal Pembuatan".');
}

/** Standard template, identical to the structure of the supplied Excel file. */
export function downloadTemplate() {
  const header = ['Spesifikasi', 'PO Number', 'Customer', 'Jenis Kertas', 'Mesin', 'Shift', 'Inspector', 'Tanggal Pembuatan', 'Tanggal Kadaluarsa', 'Remark'];
  const ws = XLSX.utils.aoa_to_sheet([
    ['RETAIN 5 METER'], header,
    ['1LPR', 1033439, 'ASIA COCONUT PROCESSING JOINT STOCK COMPANY', 'HT335*1568', 'AZ7-2', 2, 'REFLI', new Date(Date.UTC(2026, 0, 2)), '(auto-calculated: +13 months)', 'P = 8 L = 2'],
  ], { cellDates: true });
  ws['!cols'] = header.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '5M');
  XLSX.writeFile(wb, 'retain-sample-import-template.xlsx');
}
