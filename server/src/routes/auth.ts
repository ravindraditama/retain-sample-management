import { Router } from 'express';
import { authenticate, actorOf, hashPassword, signToken, validatePassword, verifyPassword } from '../auth.js';
import { audit } from '../audit.js';
import { exec, one } from '../db.js';
import { HttpError } from '../util.js';

export const authRouter = Router();

// Tiny in-memory brute-force guard: 8 failures / 15 min per ip+email.
const fails = new Map<string, { n: number; until: number }>();
const WINDOW = 15 * 60 * 1000;

authRouter.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!email || !password) throw new HttpError(400, 'Email and password are required.');

  const key = `${req.ip}|${email}`;
  const f = fails.get(key);
  if (f && f.until > Date.now() && f.n >= 8) throw new HttpError(429, 'Too many failed attempts. Try again in a few minutes.');

  const u = await one<{ id: string; email: string; display_name: string | null; role: string; password_hash: string; is_active: number; must_change_password: number }>(
    'SELECT id, email, display_name, role, password_hash, is_active, must_change_password FROM users WHERE email = ?', [email]);
  const ok = u && u.is_active && (await verifyPassword(password, u.password_hash));
  if (!ok || !u) {
    fails.set(key, { n: (f && f.until > Date.now() ? f.n : 0) + 1, until: Date.now() + WINDOW });
    throw new HttpError(401, 'Invalid email or password.');
  }
  fails.delete(key);
  await exec('UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', [u.id]);
  await audit(null, { id: u.id, email: u.email }, 'users', u.id, 'login', null, null);
  res.json({
    token: signToken(u.id),
    user: { id: u.id, email: u.email, display_name: u.display_name, role: u.role, must_change_password: !!u.must_change_password },
  });
});

authRouter.get('/me', authenticate, (req, res) => { res.json({ user: req.user }); });

authRouter.post('/change-password', authenticate, async (req, res) => {
  const current = String(req.body?.current_password ?? '');
  const next = validatePassword(req.body?.new_password);
  const u = await one<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
  if (!u || !(await verifyPassword(current, u.password_hash))) throw new HttpError(400, 'Current password is incorrect.');
  if (current === next) throw new HttpError(400, 'New password must be different from the current one.');
  await exec('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [await hashPassword(next), req.user!.id]);
  await audit(null, actorOf(req), 'users', req.user!.id, 'password_change', null, null);
  res.json({ ok: true });
});
