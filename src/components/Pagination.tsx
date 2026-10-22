import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface Props {
  page: number; pageSize: number; total: number;
  onPage: (p: number) => void; onPageSize?: (n: number) => void;
}

export default function Pagination({ page, pageSize, total, onPage, onPageSize }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = 'btn-ghost px-2 py-1.5 disabled:opacity-40 disabled:pointer-events-none';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
      <div>{total === 0 ? 'No records' : <>Showing <b>{from.toLocaleString()}–{to.toLocaleString()}</b> of <b>{total.toLocaleString()}</b></>}</div>
      <div className="flex items-center gap-2">
        {onPageSize && (
          <select className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Rows per page">
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        )}
        <button className={btn} disabled={page <= 1} onClick={() => onPage(1)} aria-label="First page"><ChevronsLeft className="h-4 w-4" /></button>
        <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-[88px] text-center text-xs">Page {page} / {pages}</span>
        <button className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
        <button className={btn} disabled={page >= pages} onClick={() => onPage(pages)} aria-label="Last page"><ChevronsRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
