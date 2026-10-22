import { pool } from './db.js';
import { today } from './util.js';

/**
 * Creates one notification per sample for the band it is currently in:
 *   due today / overdue -> 0,  <= 7 days -> 7,  <= 14 days -> 14,  <= 30 days -> 30
 * The UNIQUE(sample_id, threshold) key makes this idempotent, and a sample that escalates
 * (e.g. 14 -> 7 days) gets a fresh notification for the new band.
 */
export async function syncNotifications(): Promise<number> {
  const t = pool.escape(today());
  const [res] = await pool.query(`
    INSERT IGNORE INTO notifications (id, sample_id, threshold, message)
    SELECT UUID(), x.id, x.th,
      CASE WHEN x.th = 0
        THEN CONCAT('Retention period reached: 5L ', x.five_l_number, ' (', IFNULL(x.customer, '-'), ') is ready for disposal (due ', x.expiration_date, ')')
        ELSE CONCAT('5L ', x.five_l_number, ' (', IFNULL(x.customer, '-'), ') reaches its retention date on ', x.expiration_date, ' - due within ', x.th, ' days')
      END
    FROM (
      SELECT s.id, s.five_l_number, s.customer, s.expiration_date,
        CASE WHEN s.expiration_date <= ${t} THEN 0
             WHEN s.expiration_date <= DATE_ADD(${t}, INTERVAL 7 DAY) THEN 7
             WHEN s.expiration_date <= DATE_ADD(${t}, INTERVAL 14 DAY) THEN 14
             ELSE 30 END AS th
      FROM samples s
      WHERE s.disposed_at IS NULL AND s.expiration_date IS NOT NULL
        AND s.expiration_date <= DATE_ADD(${t}, INTERVAL 30 DAY)
    ) x`);
  return (res as { affectedRows: number }).affectedRows;
}

let timer: NodeJS.Timeout | null = null;
export function startNotificationScheduler(): void {
  const run = () => syncNotifications().catch((e) => console.error('[notifications] sync failed:', e));
  run();
  timer = setInterval(run, 60 * 60 * 1000); // hourly; the date check makes it effectively daily
  timer.unref();
}
