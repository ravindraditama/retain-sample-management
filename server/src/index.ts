import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { pool } from './db.js';
import { migrate } from './migrate.js';
import { startNotificationScheduler } from './notifications.js';
import { ensureDefaultAdmin } from './seed.js';
import { HttpError } from './util.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { historyRouter } from './routes/history.js';
import { importRouter } from './routes/import.js';
import { notificationsRouter } from './routes/notifications.js';
import { samplesRouter } from './routes/samples.js';
import { usersRouter } from './routes/users.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: false }));
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/samples', samplesRouter);
app.use('/api/import', importRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api', historyRouter); // /api/movements, /api/disposals, /api/audit
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));

// Serve the built React app (npm run build in the project root) from the same process.
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../../dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.get('/{*splat}', (_req, res) => { res.sendFile(path.join(dist, 'index.html')); });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) { res.status(err.status).json({ error: err.message }); return; }
  if ((err as { type?: string }).type === 'entity.too.large') { res.status(413).json({ error: 'File is too large.' }); return; }
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

async function main() {
  if (config.autoMigrate) await migrate();
  await ensureDefaultAdmin();
  startNotificationScheduler();
  app.listen(config.port, () => console.log(`Retain Sample API listening on :${config.port} (${config.isProd ? 'production' : 'development'})`));
}

main().catch((e) => { console.error('Failed to start:', e); process.exit(1); });
