import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import type { PoolConnection } from 'mysql2/promise';
import { actorOf, authenticate, requireRole, WRITERS } from '../auth.js';
import { audit, type Actor } from '../audit.js';
import { isDuplicateError, one, rows, tx } from '../db.js';
import { syncNotifications } from '../notifications.js';
import { daysLeftSql, dupKey, escapeLike, HttpError, isValidDate, LOCATIONS, statusSql, today, type Location } from '../util.js';
import { matchLocation, text } from '../importLogic.js';

export const samplesRouter = Router();
samplesRouter.use(authenticate);

const TEXT_COLS = ['specification', 'five_l_number', 'customer', 'paper_type', 'machine', 'shift', 'inspector', 'remark', 'rack_detail'] as const;
const STATUSES = ['active', 'near_expired', 'ready_for_disposal', 'disposed'];
const PUBLIC_COLS = `s.id, s.specification, s.five_l_number, s.customer, s.paper_type, s.machine, s.shift, s.inspector,
  s.production_date, s.expiration_date, s.remark, s.storage_location, s.rack_detail, s.disposed_at, s.disposed_by,
  s.import_batch_id, s.created_by, s.updated_by, s.created_at, s.updated_at`;
const selectSql = () => `SELECT ${PUBLIC_COLS}, ${statusSql()} AS status, ${daysLeftSql()} AS days_left FROM samples s`;

const str = (q: Request['query'], k: string) => (typeof q[k] === 'string' ? (q[k] as string).trim() : '');

/** Builds WHERE from query-string filters: global q, per-column text filters, status, location, date ranges. */
export function sampleFilters(q: Request['query']): { where: string; params: unknown[] } {
  const where: string[] = [];
  const params: unknown[] = [];
  const search = str(q, 'q');
  if (search) {
    where.push(`(${TEXT_COLS.map((c) => `s.${c} LIKE ?`).join(' OR ')})`);
    TEXT_COLS.forEach(() => params.push(`%${escapeLike(search)}%`));
  }
  for (const c of TEXT_COLS) {
    const v = str(q, c);
    if (v) { where.push(`s.${c} LIKE ?`); params.push(`%${escapeLike(v)}%`); }
  }
  const status = str(q, 'status').split(',').filter((x) => STATUSES.includes(x));
  if (status.length) { where.push(`${statusSql()} IN (?)`); params.push(status); }
  const loc = str(q, 'storage_location').split(',').filter((x) => (LOCATIONS as readonly string[]).includes(x));
  if (loc.length) { where.push('s.storage_location IN (?)'); params.push(loc); }
  const ranges: [string, string, string][] = [
    ['prod_from', 's.production_date >= ?', ''], ['prod_to', 's.production_date <= ?', ''],
    ['exp_from', 's.expiration_date >= ?', ''], ['exp_to', 's.expiration_date <= ?', ''],
  ];
  for (const [k, sql] of ranges) {
    const v = str(q, k);
    if (v && isValidDate(v)) { where.push(sql); params.push(v); }
  }
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

function orderBy(q: Request['query']): string {
  const map: Record<string, string> = {
    ...Object.fromEntries(TEXT_COLS.map((c) => [c, `s.${c}`])),
    production_date: 's.production_date', expiration_date: 's.expiration_date', days_left: 's.expiration_date',
    storage_location: 's.storage_location', status: statusSql(), created_at: 's.created_at', updated_at: 's.updated_at',
  };
  const col = map[str(q, 'sort')] ?? 's.created_at';
  const dir = str(q, 'dir').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `${col} ${dir}, s.id ASC`;
}

export function paging(q: Request['query'], max = 200) {
  const pageSize = Math.min(Math.max(parseInt(str(q, 'pageSize')) || 25, 1), max);
  const page = Math.max(parseInt(str(q, 'page')) || 1, 1);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

samplesRouter.get('/', async (req, res) => {
  const { where, params } = sampleFilters(req.query);
  const { page, pageSize, offset } = paging(req.query);
  const [count, data] = await Promise.all([
    one<{ n: number }>(`SELECT COUNT(*) AS n FROM samples s ${where}`, params),
    rows(`${selectSql()} ${where} ORDER BY ${orderBy(req.query)} LIMIT ? OFFSET ?`, [...params, pageSize, offset]),
  ]);
  res.json({ data, total: Number(count?.n ?? 0), page, pageSize });
});

// Full result set for Excel/PDF reports (same filters, capped for safety).
samplesRouter.get('/export', async (req, res) => {
  const { where, params } = sampleFilters(req.query);
  const data = await rows(`${selectSql()} ${where} ORDER BY ${orderBy(req.query)} LIMIT 100000`, params);
  res.json({ data, total: data.length });
});

// ---------- validation ----------
interface Input {
  specification: string | null; five_l_number: string; customer: string | null; paper_type: string | null;
  machine: string | null; shift: string | null; inspector: string | null; production_date: string;
  remark: string | null; storage_location: Location; rack_detail: string | null;
}

function validateSample(b: Record<string, unknown>): Input {
  const t = (k: string, max: number) => {
    const v = text(b[k]);
    if (v && v.length > max) throw new HttpError(400, `${k.replace(/_/g, ' ')} is too long (max ${max}).`);
    return v;
  };
  const five = t('five_l_number', 120);
  if (!five) throw new HttpError(400, 'PO Number is required.');
  const prod = typeof b.production_date === 'string' ? b.production_date.slice(0, 10) : '';
  if (!isValidDate(prod)) throw new HttpError(400, 'A valid Production Date is required.');
  const loc = b.storage_location ? matchLocation(b.storage_location) : 'Rack';
  if (!loc) throw new HttpError(400, 'Invalid storage location.');
  return {
    specification: t('specification', 120), five_l_number: five, customer: t('customer', 190), paper_type: t('paper_type', 120),
    machine: t('machine', 60), shift: t('shift', 20), inspector: t('inspector', 120), production_date: prod,
    remark: t('remark', 2000), storage_location: loc, rack_detail: loc === 'Rack' ? t('rack_detail', 120) : null,
  };
}

const DUP_MSG = 'A sample with the same PO Number (and Machine/Shift) already exists.';

async function addMovements(c: PoolConnection, actor: Actor, items: {
  id: string; five: string | null; kind: 'create' | 'move' | 'dispose';
  from: string | null; to: string; fromRack: string | null; toRack: string | null; note: string | null;
}[]): Promise<void> {
  for (let i = 0; i < items.length; i += 500) {
    const chunk = items.slice(i, i + 500);
    await c.query(
      'INSERT INTO sample_movements (sample_id, five_l_number, kind, old_location, new_location, old_rack_detail, new_rack_detail, moved_by, moved_by_name, note) VALUES ?',
      [chunk.map((m) => [m.id, m.five, m.kind, m.from, m.to, m.fromRack, m.toRack, actor.id, actor.name ?? actor.email, m.note])],
    );
  }
}

// ---------- create / read / update / delete ----------
samplesRouter.post('/', requireRole(...WRITERS), async (req, res) => {
  const f = validateSample(req.body ?? {});
  const id = randomUUID();
  const actor = actorOf(req);
  try {
    await tx(async (c) => {
      await c.query(
        `INSERT INTO samples (id, specification, five_l_number, customer, paper_type, machine, shift, inspector, production_date,
           remark, storage_location, rack_detail, dup_key, created_by, updated_by) VALUES (?)`,
        [[id, f.specification, f.five_l_number, f.customer, f.paper_type, f.machine, f.shift, f.inspector, f.production_date,
          f.remark, f.storage_location, f.rack_detail, dupKey(f), actor.id, actor.id]]);
      await addMovements(c, actor, [{ id, five: f.five_l_number, kind: 'create', from: null, to: f.storage_location, fromRack: null, toRack: f.rack_detail, note: 'Initial placement' }]);
      await audit(c, actor, 'samples', id, 'insert', null, f);
    });
  } catch (e) {
    if (isDuplicateError(e)) throw new HttpError(409, DUP_MSG);
    throw e;
  }
  syncNotifications().catch(() => undefined);
  res.status(201).json({ data: await one(`${selectSql()} WHERE s.id = ?`, [id]) });
});

samplesRouter.get('/:id', async (req, res) => {
  const s = await one(`${selectSql()} WHERE s.id = ?`, [req.params.id]);
  if (!s) throw new HttpError(404, 'Sample not found.');
  res.json({ data: s });
});

samplesRouter.get('/:id/movements', async (req, res) => {
  res.json({ data: await rows('SELECT * FROM sample_movements WHERE sample_id = ? ORDER BY moved_at DESC, id DESC', [req.params.id]) });
});

samplesRouter.put('/:id', requireRole(...WRITERS), async (req, res) => {
  const f = validateSample(req.body ?? {});
  const actor = actorOf(req);
  try {
    await tx(async (c) => {
      const [found] = await c.query('SELECT * FROM samples WHERE id = ? FOR UPDATE', [req.params.id]);
      const old = (found as Record<string, unknown>[])[0];
      if (!old) throw new HttpError(404, 'Sample not found.');
      if (old.disposed_at) throw new HttpError(409, 'Disposed samples are read-only.');
      await c.query(
        `UPDATE samples SET specification=?, five_l_number=?, customer=?, paper_type=?, machine=?, shift=?, inspector=?,
           production_date=?, remark=?, storage_location=?, rack_detail=?, dup_key=?, updated_by=? WHERE id=?`,
        [f.specification, f.five_l_number, f.customer, f.paper_type, f.machine, f.shift, f.inspector, f.production_date,
          f.remark, f.storage_location, f.rack_detail, dupKey(f), actor.id, req.params.id]);
      const before: Record<string, unknown> = {}; const after: Record<string, unknown> = {};
      for (const k of Object.keys(f) as (keyof Input)[]) {
        const o = old[k] instanceof Date ? (old[k] as Date).toISOString().slice(0, 10) : old[k] ?? null;
        if (o !== f[k]) { before[k] = o; after[k] = f[k]; }
      }
      if (old.storage_location !== f.storage_location || (old.rack_detail ?? null) !== f.rack_detail) {
        await addMovements(c, actor, [{ id: String(req.params.id), five: f.five_l_number, kind: 'move', from: String(old.storage_location),
          to: f.storage_location, fromRack: (old.rack_detail as string) ?? null, toRack: f.rack_detail, note: 'Changed via edit form' }]);
      }
      await audit(c, actor, 'samples', String(req.params.id), 'update', before, after);
    });
  } catch (e) {
    if (isDuplicateError(e)) throw new HttpError(409, DUP_MSG);
    throw e;
  }
  syncNotifications().catch(() => undefined);
  res.json({ data: await one(`${selectSql()} WHERE s.id = ?`, [req.params.id]) });
});

samplesRouter.delete('/:id', requireRole('admin'), async (req, res) => {
  await tx(async (c) => {
    const [found] = await c.query('SELECT * FROM samples WHERE id = ? FOR UPDATE', [req.params.id]);
    const old = (found as Record<string, unknown>[])[0];
    if (!old) throw new HttpError(404, 'Sample not found.');
    delete old.dup_key;
    await c.query('DELETE FROM samples WHERE id = ?', [req.params.id]);
    await audit(c, actorOf(req), 'samples', String(req.params.id), 'delete', old, null);
  });
  res.json({ ok: true });
});

// ---------- movement (single or bulk) ----------
samplesRouter.post('/move', requireRole(...WRITERS), async (req, res) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? [...new Set<string>(req.body.ids.map(String))] : [];
  if (!ids.length) throw new HttpError(400, 'Select at least one sample.');
  if (ids.length > 2000) throw new HttpError(400, 'You can move at most 2000 samples at once.');
  const loc = matchLocation(req.body?.location);
  if (!loc) throw new HttpError(400, 'Choose a valid destination (Rack, Transit Area or Dump Trash).');
  const rack = loc === 'Rack' ? text(req.body?.rack_detail) : null;
  const note = text(req.body?.note)?.slice(0, 500) ?? null;
  const actor = actorOf(req);

  const result = await tx(async (c) => {
    const [found] = await c.query('SELECT id, five_l_number, storage_location, rack_detail FROM samples WHERE id IN (?) AND disposed_at IS NULL FOR UPDATE', [ids]);
    const list = found as { id: string; five_l_number: string; storage_location: string; rack_detail: string | null }[];
    const todo = list.filter((s) => s.storage_location !== loc || (s.rack_detail ?? null) !== rack);
    if (todo.length) {
      await c.query('UPDATE samples SET storage_location=?, rack_detail=?, updated_by=? WHERE id IN (?)', [loc, rack, actor.id, todo.map((s) => s.id)]);
      await addMovements(c, actor, todo.map((s) => ({ id: s.id, five: s.five_l_number, kind: 'move' as const, from: s.storage_location, to: loc, fromRack: s.rack_detail, toRack: rack, note })));
      for (let i = 0; i < todo.length; i += 500) {
        await c.query('INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, user_email) VALUES ?',
          [todo.slice(i, i + 500).map((s) => ['samples', s.id, 'move', JSON.stringify({ storage_location: s.storage_location, rack_detail: s.rack_detail }),
            JSON.stringify({ storage_location: loc, rack_detail: rack }), actor.id, actor.email])]);
      }
    }
    return { moved: todo.length, skipped: ids.length - todo.length };
  });
  res.json(result);
});

// ---------- disposal (single or bulk) ----------
samplesRouter.post('/dispose', requireRole(...WRITERS), async (req, res) => {
  const actor = actorOf(req);
  const note = text(req.body?.note)?.slice(0, 500) ?? null;
  const t = today();
  const result = await tx(async (c) => {
    let ids: string[] = Array.isArray(req.body?.ids) ? [...new Set<string>(req.body.ids.map(String))] : [];
    if (req.body?.all_ready === true) {
      const [r] = await c.query('SELECT id FROM samples WHERE disposed_at IS NULL AND expiration_date <= ? FOR UPDATE', [t]);
      ids = (r as { id: string }[]).map((x) => x.id);
    }
    if (!ids.length) throw new HttpError(400, 'No samples selected.');
    const [found] = await c.query(
      'SELECT id, five_l_number, specification, customer, machine, production_date, expiration_date, storage_location, rack_detail FROM samples WHERE id IN (?) AND disposed_at IS NULL AND expiration_date <= ? FOR UPDATE',
      [ids, t]);
    const list = found as Record<string, string | null>[];
    if (!list.length) throw new HttpError(409, 'None of the selected samples has reached its retention date, or they were already disposed.');
    const name = actor.name ?? actor.email;
    for (let i = 0; i < list.length; i += 500) {
      const chunk = list.slice(i, i + 500);
      await c.query('UPDATE samples SET disposed_at = UTC_TIMESTAMP(), disposed_by = ?, updated_by = ?, storage_location = ?, rack_detail = NULL WHERE id IN (?)',
        [actor.id, actor.id, 'Dump Trash', chunk.map((s) => s.id)]);
      await c.query('INSERT INTO disposals (sample_id, five_l_number, specification, customer, machine, production_date, expiration_date, previous_location, disposed_by, disposed_by_name, note) VALUES ?',
        [chunk.map((s) => [s.id, s.five_l_number, s.specification, s.customer, s.machine, s.production_date, s.expiration_date, s.storage_location, actor.id, name, note])]);
      await c.query('INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, user_email) VALUES ?',
        [chunk.map((s) => ['samples', s.id, 'dispose', JSON.stringify({ storage_location: s.storage_location }), JSON.stringify({ disposed: true, storage_location: 'Dump Trash' }), actor.id, actor.email])]);
    }
    await addMovements(c, actor, list.map((s) => ({ id: s.id!, five: s.five_l_number, kind: 'dispose' as const, from: s.storage_location, to: 'Dump Trash', fromRack: s.rack_detail, toRack: null, note: note ?? 'Disposed after retention period' })));
    return { disposed: list.length, skipped: ids.length - list.length };
  });
  res.json(result);
});
