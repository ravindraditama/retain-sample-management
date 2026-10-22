import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { actorOf, authenticate, requireRole, WRITERS } from '../auth.js';
import { audit } from '../audit.js';
import { pool, tx } from '../db.js';
import { classify, addMonths, parseImport, type ParsedRow, type RawImport, type RowState } from '../importLogic.js';
import { syncNotifications } from '../notifications.js';
import { dupKey, HttpError, LOCATIONS } from '../util.js';

export const importRouter = Router();
importRouter.use(authenticate, requireRole(...WRITERS));

const MAX_ROWS = 50000;

function readBody(body: unknown): RawImport {
  const b = body as RawImport | undefined;
  if (!b || !Array.isArray(b.headers) || !Array.isArray(b.rows)) throw new HttpError(400, 'Invalid import payload.');
  if (b.rows.length > MAX_ROWS) throw new HttpError(400, `Too many rows (max ${MAX_ROWS}).`);
  return b;
}

async function existingKeys(keys: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let i = 0; i < keys.length; i += 2000) {
    const [r] = await pool.query('SELECT id, dup_key FROM samples WHERE dup_key IN (?)', [keys.slice(i, i + 2000)]);
    (r as { id: string; dup_key: string }[]).forEach((x) => map.set(x.dup_key, x.id));
  }
  return map;
}

async function analyse(raw: RawImport) {
  const parsed = parseImport(raw);
  const keys = parsed.rows.map((r) => r.key).filter((k): k is string => !!k);
  const existing = await existingKeys([...new Set(keys)]);
  const classified = classify(parsed.rows, new Set(existing.keys()));
  return { parsed, classified, existing };
}

/** Step 1: validate + classify every row, nothing is saved. */
importRouter.post('/preview', async (req, res) => {
  const { parsed, classified } = await analyse(readBody(req.body));
  if (parsed.fileErrors.length) { res.status(422).json({ error: parsed.fileErrors.join(' '), fileErrors: parsed.fileErrors }); return; }
  const counts: Record<RowState, number> = { new: 0, duplicate_existing: 0, duplicate_in_file: 0, invalid: 0 };
  classified.forEach((c) => counts[c.state]++);
  const mismatch = classified.filter((c) => c.row.data && c.row.fileExpiration && c.row.fileExpiration !== addMonths(c.row.data.production_date, 13)).length;
  res.json({
    total: classified.length, blank: parsed.blank, counts, expirationMismatches: mismatch,
    rows: classified.map(({ row, state }) => ({
      row: row.row, state, errors: row.errors,
      five_l_number: row.data?.five_l_number ?? null, customer: row.data?.customer ?? null,
      specification: row.data?.specification ?? null, machine: row.data?.machine ?? null, shift: row.data?.shift ?? null,
      production_date: row.data?.production_date ?? null,
      expiration_date: row.data ? addMonths(row.data.production_date, 13) : null,
    })),
  });
});

/** Step 2: save. mode=skip leaves existing records untouched; mode=update overwrites them. */
importRouter.post('/commit', async (req, res) => {
  const raw = readBody(req.body);
  const mode: 'skip' | 'update' = req.body?.mode === 'update' ? 'update' : 'skip';
  const location = (LOCATIONS as readonly string[]).includes(req.body?.default_location) ? req.body.default_location : 'Rack';
  const filename = typeof req.body?.filename === 'string' ? req.body.filename.slice(0, 255) : null;
  const actor = actorOf(req);

  const { parsed, classified, existing } = await analyse(raw);
  if (parsed.fileErrors.length) throw new HttpError(422, parsed.fileErrors.join(' '));

  const batchId = randomUUID();
  const summary = await tx(async (c) => {
    const fresh = classified.filter((x) => x.state === 'new').map((x) => x.row);
    const toUpdate = mode === 'update' ? classified.filter((x) => x.state === 'duplicate_existing').map((x) => x.row) : [];
    const invalid = classified.filter((x) => x.state === 'invalid').length;
    const skipped = classified.filter((x) => x.state === 'duplicate_in_file' || (x.state === 'duplicate_existing' && mode === 'skip')).length;

    await c.query('INSERT INTO import_batches (id, filename, mode, total_rows, inserted, updated, skipped, invalid, created_by, created_by_email) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [batchId, filename, mode, classified.length, fresh.length, toUpdate.length, skipped, invalid, actor.id, actor.email]);

    const val = (r: ParsedRow) => {
      const d = r.data!;
      return [randomUUID(), d.specification, d.five_l_number, d.customer, d.paper_type, d.machine, d.shift, d.inspector, d.production_date,
        d.remark, d.storage_location ?? location, d.rack_detail, r.key, batchId, actor.id, actor.id];
    };
    for (let i = 0; i < fresh.length; i += 500) {
      await c.query(
        `INSERT INTO samples (id, specification, five_l_number, customer, paper_type, machine, shift, inspector, production_date,
           remark, storage_location, rack_detail, dup_key, import_batch_id, created_by, updated_by) VALUES ?`,
        [fresh.slice(i, i + 500).map(val)]);
    }
    let disposedSkipped = 0;
    for (const r of toUpdate) {
      const d = r.data!;
      const id = existing.get(dupKey(d))!;
      // Updating never moves a sample (location is managed via the movement log) and never touches disposed records.
      const [u] = await c.query(
        `UPDATE samples SET specification=?, customer=?, paper_type=?, machine=?, shift=?, inspector=?, production_date=?, remark=?, updated_by=?, import_batch_id=?
         WHERE id=? AND disposed_at IS NULL`,
        [d.specification, d.customer, d.paper_type, d.machine, d.shift, d.inspector, d.production_date, d.remark, actor.id, batchId, id]);
      if ((u as { affectedRows: number }).affectedRows === 0) disposedSkipped++;
    }
    await c.query('UPDATE import_batches SET updated = ?, skipped = ? WHERE id = ?', [toUpdate.length - disposedSkipped, skipped + disposedSkipped, batchId]);
    await audit(c, actor, 'import_batches', batchId, 'import', null, { filename, mode, inserted: fresh.length, updated: toUpdate.length - disposedSkipped, skipped, invalid });
    return { batchId, inserted: fresh.length, updated: toUpdate.length - disposedSkipped, skipped: skipped + disposedSkipped, invalid };
  });
  syncNotifications().catch(() => undefined);
  res.json(summary);
});

