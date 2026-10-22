import { Router } from 'express';
import { authenticate } from '../auth.js';
import { one, rows } from '../db.js';
import { pool } from '../db.js';
import { statusSql, today } from '../util.js';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get('/', async (_req, res) => {
  const t = pool.escape(today());
  const [status, location, bands, upcoming, recentMoves, recentDisposals, unread] = await Promise.all([
    rows<{ status: string; n: number }>(`SELECT ${statusSql()} AS status, COUNT(*) AS n FROM samples s GROUP BY status`),
    rows<{ storage_location: string; n: number }>('SELECT storage_location, COUNT(*) AS n FROM samples WHERE disposed_at IS NULL GROUP BY storage_location'),
    one<Record<string, number>>(`SELECT
        SUM(expiration_date <= ${t}) AS due_now,
        SUM(expiration_date > ${t} AND expiration_date <= DATE_ADD(${t}, INTERVAL 7 DAY)) AS within_7,
        SUM(expiration_date > DATE_ADD(${t}, INTERVAL 7 DAY) AND expiration_date <= DATE_ADD(${t}, INTERVAL 14 DAY)) AS within_14,
        SUM(expiration_date > DATE_ADD(${t}, INTERVAL 14 DAY) AND expiration_date <= DATE_ADD(${t}, INTERVAL 30 DAY)) AS within_30
      FROM samples WHERE disposed_at IS NULL`),
    rows(`SELECT id, five_l_number, customer, expiration_date, DATEDIFF(expiration_date, ${t}) AS days_left, storage_location
          FROM samples WHERE disposed_at IS NULL AND expiration_date > ${t} ORDER BY expiration_date ASC LIMIT 8`),
    rows('SELECT id, five_l_number, kind, old_location, new_location, moved_by_name, moved_at FROM sample_movements ORDER BY moved_at DESC, id DESC LIMIT 8'),
    rows('SELECT id, five_l_number, customer, disposed_by_name, disposed_at FROM disposals ORDER BY disposed_at DESC, id DESC LIMIT 5'),
    one<{ n: number }>('SELECT COUNT(*) AS n FROM notifications n JOIN samples s ON s.id = n.sample_id WHERE n.is_read = 0 AND s.disposed_at IS NULL'),
  ]);
  const by = Object.fromEntries(status.map((r) => [r.status, Number(r.n)]));
  const n = (v: unknown) => Number(v ?? 0);
  res.json({
    totals: {
      all: Object.values(by).reduce((a, b) => a + b, 0), active: by.active ?? 0, near_expired: by.near_expired ?? 0,
      ready_for_disposal: by.ready_for_disposal ?? 0, disposed: by.disposed ?? 0,
    },
    locations: Object.fromEntries(location.map((r) => [r.storage_location, Number(r.n)])),
    bands: { due_now: n(bands?.due_now), within_7: n(bands?.within_7), within_14: n(bands?.within_14), within_30: n(bands?.within_30) },
    upcoming, recentMovements: recentMoves, recentDisposals, unreadNotifications: n(unread?.n),
  });
});
