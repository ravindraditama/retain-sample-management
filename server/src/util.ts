import { config } from './config.js';
import { pool } from './db.js';

export { LOCATIONS, dupKey, isValidDate, type Location } from './rules.js';

/** Today's business date (YYYY-MM-DD) in the configured timezone. */
export function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Effective status computed in SQL from today's date, so it can never go stale
 * (no cron job needed to flip flags).
 */
export function statusSql(alias = 's'): string {
  const t = pool.escape(today());
  return `(CASE
    WHEN ${alias}.disposed_at IS NOT NULL THEN 'disposed'
    WHEN ${alias}.expiration_date IS NULL THEN 'active'
    WHEN ${alias}.expiration_date <= ${t} THEN 'ready_for_disposal'
    WHEN ${alias}.expiration_date <= DATE_ADD(${t}, INTERVAL 30 DAY) THEN 'near_expired'
    ELSE 'active' END)`;
}

export function daysLeftSql(alias = 's'): string {
  return `DATEDIFF(${alias}.expiration_date, ${pool.escape(today())})`;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
