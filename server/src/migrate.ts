import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from './config.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function migrate(): Promise<void> {
  const { database, ...conn } = config.db;
  const admin = await mysql.createConnection({ ...conn, multipleStatements: true });
  try {
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await admin.query(`USE \`${database}\``);
    const sql = fs.readFileSync(path.resolve(here, '../sql/schema.sql'), 'utf8');
    await admin.query(sql);
  } finally {
    await admin.end();
  }
}

// `npm run db:migrate`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrate().then(() => { console.log('Schema is up to date.'); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
