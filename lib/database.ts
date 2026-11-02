import 'server-only';
import { neon } from '@neondatabase/serverless';

/**
 * The one Neon PostgreSQL database: the synced catalog, alert subscriptions, their queues and the
 * rate limits. Initialize on request, so builds do not need database credentials.
 */
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Database is not configured');
  return neon(url);
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
