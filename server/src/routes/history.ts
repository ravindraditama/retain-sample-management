import { Router, type Request } from 'express';
import { authenticate, requireRole } from '../auth.js';
import { one, rows } from '../db.js';
import { escapeLike, isValidDate } from '../util.js';
import { paging } from './samples.js';

export const historyRouter = Router();
historyRouter.use(authenticate);

const s = (q: Request['query'], k: string) => (typeof q[k] === 'string' ? (q[k] as string).trim() : '');

function dateRange(q: Request['query'], col: string, where: string[], params: unknown[]) {
  const from = s(q, 'from'); const to = s(q, 'to');
  if (from && isValidDate(from)) { where.push(`${col} >= ?`); params.push(from); }
  if (to && isValidDate(to)) { where.push(`${col} < DATE_ADD(?, INTERVAL 1 DAY)`); params.push(to); }
}

async function page(table: string, where: string[], params: unknown[], order: string, q: Request['query']) {
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const all = s(q, 'all') === '1';
  const { page: p, pageSize, offset } = paging(q, all ? 50000 : 200);
  const [c, data] = await Promise.all([
    one<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} ${clause}`, params),
    rows(`SELECT * FROM ${table} ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`, [...params, all ? 50000 : pageSize, all ? 0 : offset]),
  ]);
  return { data, total: Number(c?.n ?? 0), page: p, pageSize };
}

/** Movement history (all samples). */
historyRouter.get('/movements', async (req, res) => {
  const where: string[] = []; const params: unknown[] = [];
  const q = s(req.query, 'q');
  if (q) { where.push('(five_l_number LIKE ? OR moved_by_name LIKE ? OR note LIKE ?)'); params.push(...Array(3).fill(`%${escapeLike(q)}%`)); }
  const kind = s(req.query, 'kind'); if (['create', 'move', 'dispose'].includes(kind)) { where.push('kind = ?'); params.push(kind); }
  const loc = s(req.query, 'location'); if (loc) { where.push('(new_location = ? OR old_location = ?)'); params.push(loc, loc); }
  dateRange(req.query, 'moved_at', where, params);
  res.json(await page('sample_movements', where, params, 'moved_at DESC, id DESC', req.query));
});

/** Disposal history. */
historyRouter.get('/disposals', async (req, res) => {
  const where: string[] = []; const params: unknown[] = [];
  const q = s(req.query, 'q');
  if (q) { where.push('(five_l_number LIKE ? OR customer LIKE ? OR disposed_by_name LIKE ? OR specification LIKE ?)'); params.push(...Array(4).fill(`%${escapeLike(q)}%`)); }
  dateRange(req.query, 'disposed_at', where, params);
  res.json(await page('disposals', where, params, 'disposed_at DESC, id DESC', req.query));
});

/** Audit trail — admins and quality engineers only. */
historyRouter.get('/audit', requireRole('admin', 'quality_engineer'), async (req, res) => {
  const where: string[] = []; const params: unknown[] = [];
  const q = s(req.query, 'q');
  if (q) { where.push('(user_email LIKE ? OR record_id LIKE ? OR table_name LIKE ?)'); params.push(...Array(3).fill(`%${escapeLike(q)}%`)); }
  const action = s(req.query, 'action'); if (action) { where.push('action = ?'); params.push(action); }
  const tbl = s(req.query, 'table'); if (tbl) { where.push('table_name = ?'); params.push(tbl); }
  dateRange(req.query, 'changed_at', where, params);
  res.json(await page('audit_log', where, params, 'changed_at DESC, id DESC', req.query));
});
