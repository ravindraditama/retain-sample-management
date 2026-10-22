import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { exec, one } from './db.js';
import { hashPassword } from './auth.js';

export async function ensureDefaultAdmin(): Promise<void> {
  const existing = await one('SELECT id FROM users WHERE email = ?', [config.admin.email]);
  if (existing) return;
  await exec(
    'INSERT INTO users (id, email, display_name, password_hash, role, is_active, must_change_password) VALUES (?,?,?,?,?,1,1)',
    [randomUUID(), config.admin.email, 'Administrator', await hashPassword(config.admin.password), 'admin'],
  );
  console.log(`[seed] Default admin created: ${config.admin.email} (change the password after first login)`);
}
