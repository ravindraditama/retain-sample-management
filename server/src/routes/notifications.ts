import { Router } from 'express';
import { actorOf, authenticate } from '../auth.js';
import { exec, one, rows } from '../db.js';
import { syncNotifications } from '../notifications.js';
import { statusSql } from '../util.js';
import { paging } from './samples.js';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

const LIVE = 's.disposed_at IS NULL'; // notifications for already-disposed samples are irrelevant

notificationsRouter.get('/', async (req, res) => {
  const where = [LIVE]; const params: unknown[] = [];
  if (req.query.unread === '1') where.push('n.is_read = 0');
  const th = Number(req.query.threshold);
  if ([0, 7, 14, 30].includes(th) && req.query.threshold !== undefined && req.query.threshold !== '') { where.push('n.threshold = ?'); params.push(th); }
  const clause = `WHERE ${where.join(' AND ')}`;
  const { page, pageSize, offset } = paging(req.query);
  const [c, data] = await Promise.all([
    one<{ n: number }>(`SELECT COUNT(*) AS n FROM notifications n JOIN samples s ON s.id = n.sample_id ${clause}`, params),
    rows(`SELECT n.id, n.sample_id, n.threshold, n.message, n.is_read, n.created_at, s.five_l_number, s.customer, s.expiration_date,
            s.storage_location, ${statusSql()} AS status
          FROM notifications n JOIN samples s ON s.id = n.sample_id ${clause}
          ORDER BY n.is_read ASC, n.threshold ASC, n.created_at DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]),
  ]);
  res.json({ data, total: Number(c?.n ?? 0), page, pageSize });
});

notificationsRouter.get('/unread-count', async (_req, res) => {
  const r = await one<{ n: number }>(`SELECT COUNT(*) AS n FROM notifications n JOIN samples s ON s.id = n.sample_id WHERE n.is_read = 0 AND ${LIVE}`);
  res.json({ count: Number(r?.n ?? 0) });
});

notificationsRouter.post('/refresh', async (_req, res) => { res.json({ created: await syncNotifications() }); });

notificationsRouter.post('/read-all', async (req, res) => {
  await exec('UPDATE notifications SET is_read = 1, read_by = ?, read_at = UTC_TIMESTAMP() WHERE is_read = 0', [actorOf(req).id]);
  res.json({ ok: true });
});

notificationsRouter.post('/:id/read', async (req, res) => {
  await exec('UPDATE notifications SET is_read = 1, read_by = ?, read_at = UTC_TIMESTAMP() WHERE id = ?', [actorOf(req).id, req.params.id]);
  res.json({ ok: true });
});
