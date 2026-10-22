import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { actorOf, authenticate, hashPassword, requireRole, validatePassword } from '../auth.js';
import { audit } from '../audit.js';
import { exec, isDuplicateError, one, rows, tx } from '../db.js';
import { HttpError } from '../util.js';

export const usersRouter = Router();
usersRouter.use(authenticate, requireRole('admin'));

const ROLES = ['admin', 'quality_engineer', 'viewer'];
const COLS = 'id, email, display_name, role, is_active, must_change_password, last_login_at, created_at';

async function activeAdminCount(excludeId?: string): Promise<number> {
  const r = await one<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND is_active=1 AND id <> ?", [excludeId ?? '']);
  return Number(r?.n ?? 0);
}

usersRouter.get('/', async (_req, res) => {
  res.json({ data: await rows(`SELECT ${COLS} FROM users ORDER BY created_at DESC`) });
});

usersRouter.post('/', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const role = String(req.body?.role ?? 'viewer');
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new HttpError(400, 'A valid email is required.');
  if (!ROLES.includes(role)) throw new HttpError(400, 'Invalid role.');
  const password = validatePassword(req.body?.password);
  const id = randomUUID();
  try {
    await tx(async (c) => {
      await c.query('INSERT INTO users (id, email, display_name, password_hash, role, must_change_password) VALUES (?,?,?,?,?,1)',
        [id, email, String(req.body?.display_name ?? '').trim() || null, await hashPassword(password), role]);
      await audit(c, actorOf(req), 'users', id, 'insert', null, { email, role });
    });
  } catch (e) {
    if (isDuplicateError(e)) throw new HttpError(409, 'A user with this email already exists.');
    throw e;
  }
  res.status(201).json({ data: await one(`SELECT ${COLS} FROM users WHERE id = ?`, [id]) });
});

usersRouter.patch('/:id', async (req, res) => {
  const old = await one<{ id: string; role: string; is_active: number; display_name: string | null }>(
    'SELECT id, role, is_active, display_name FROM users WHERE id = ?', [req.params.id]);
  if (!old) throw new HttpError(404, 'User not found.');
  const role = req.body?.role !== undefined ? String(req.body.role) : old.role;
  const active = req.body?.is_active !== undefined ? (req.body.is_active ? 1 : 0) : old.is_active;
  const name = req.body?.display_name !== undefined ? String(req.body.display_name).trim() || null : old.display_name;
  if (!ROLES.includes(role)) throw new HttpError(400, 'Invalid role.');
  const losesAdmin = old.role === 'admin' && old.is_active && (role !== 'admin' || !active);
  if (losesAdmin && (await activeAdminCount(old.id)) === 0) throw new HttpError(409, 'At least one active administrator is required.');
  if (old.id === req.user!.id && !active) throw new HttpError(409, 'You cannot deactivate your own account.');
  await tx(async (c) => {
    await c.query('UPDATE users SET role=?, is_active=?, display_name=? WHERE id=?', [role, active, name, old.id]);
    await audit(c, actorOf(req), 'users', old.id, 'update', old, { role, is_active: active, display_name: name });
  });
  res.json({ data: await one(`SELECT ${COLS} FROM users WHERE id = ?`, [old.id]) });
});

usersRouter.post('/:id/reset-password', async (req, res) => {
  const password = validatePassword(req.body?.password);
  const r = await exec('UPDATE users SET password_hash=?, must_change_password=1 WHERE id=?', [await hashPassword(password), req.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'User not found.');
  await audit(null, actorOf(req), 'users', String(req.params.id), 'password_reset', null, null);
  res.json({ ok: true });
});

usersRouter.delete('/:id', async (req, res) => {
  const u = await one<{ id: string; email: string; role: string; is_active: number }>('SELECT id, email, role, is_active FROM users WHERE id=?', [req.params.id]);
  if (!u) throw new HttpError(404, 'User not found.');
  if (u.id === req.user!.id) throw new HttpError(409, 'You cannot delete your own account.');
  if (u.role === 'admin' && u.is_active && (await activeAdminCount(u.id)) === 0) throw new HttpError(409, 'At least one active administrator is required.');
  await tx(async (c) => {
    await c.query('DELETE FROM users WHERE id=?', [u.id]);
    await audit(c, actorOf(req), 'users', u.id, 'delete', { email: u.email, role: u.role }, null);
  });
  res.json({ ok: true });
});
