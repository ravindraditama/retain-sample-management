import mysql, { type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';
import { config } from './config.js';

export const pool: Pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: 'Z',               // DATETIME columns are stored/read as UTC
  dateStrings: ['DATE'],       // DATE columns come back as 'YYYY-MM-DD' (no timezone shifts)
});

pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

export type Row = RowDataPacket;

export async function rows<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [r] = await pool.query<RowDataPacket[]>(sql, params);
  return r as unknown as T[];
}

export async function one<T = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
  return (await rows<T>(sql, params))[0] ?? null;
}

export async function exec(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [r] = await pool.query<ResultSetHeader>(sql, params);
  return r;
}

/** Run fn inside a transaction; rolls back on any thrown error. */
export async function tx<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export function isDuplicateError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { errno?: number }).errno === 1062;
}
