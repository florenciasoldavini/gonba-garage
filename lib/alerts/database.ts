import 'server-only';
import { neon } from '@neondatabase/serverless';

/** Initialize on request, so builds do not need database credentials. */
export function getAlertsSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Alert database is not configured');
  return neon(url);
}

export function isAlertsDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
