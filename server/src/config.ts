import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET ?? '';
if (isProd && (jwtSecret.length < 24 || jwtSecret === 'change-me-in-production')) {
  throw new Error('JWT_SECRET must be set to a long random value in production');
}

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: jwtSecret || 'dev-only-secret-do-not-use-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  timezone: process.env.APP_TIMEZONE ?? 'Asia/Jakarta',
  autoMigrate: (process.env.AUTO_MIGRATE ?? 'true') !== 'false',
  dupMode: (process.env.DUPLICATE_MODE === 'five_l' ? 'five_l' : 'five_l_machine_shift') as 'five_l' | 'five_l_machine_shift',
  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'retain_samples',
  },
  admin: {
    email: (process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@retainsample.local').toLowerCase(),
    password: process.env.DEFAULT_ADMIN_PASSWORD ?? 'Admin123!',
  },
};
