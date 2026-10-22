import type { PoolConnection } from 'mysql2/promise';
import { pool } from './db.js';

export interface Actor { id: string | null; email: string | null; name?: string | null }

/** Writes an audit row. Pass the transaction connection so the log commits/rolls back with the change. */
export async function audit(
  conn: PoolConnection | null,
  actor: Actor,
  table: string,
  recordId: string | null,
  action: string,
  oldValues: unknown,
  newValues: unknown,
): Promise<void> {
  const sql = 'INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, user_email) VALUES (?,?,?,?,?,?,?)';
  const params = [
    table, recordId, action,
    oldValues == null ? null : JSON.stringify(oldValues),
    newValues == null ? null : JSON.stringify(newValues),
    actor.id, actor.email,
  ];
  await (conn ?? pool).query(sql, params);
}
