import 'server-only';
import { createHmac } from 'node:crypto';
import { getAlertsSql } from './database';
import { requireAlertConfig } from './config';

/** Shared across instances. Hash addresses, bound per-address and total activation requests. */
export async function reservePriceSignup(email: string) {
  requireAlertConfig();
  const sql = getAlertsSql();
  const emailKey = createHmac('sha256', process.env.ALERTS_SIGNING_SECRET!).update(email).digest('hex');
  for (const [key, limit] of [[emailKey, 5], ['global', 100]] as const) {
    const result = await sql`INSERT INTO public.price_alert_signup_windows (key) VALUES (${key})
      ON CONFLICT (key) DO UPDATE SET
        started_at = CASE WHEN price_alert_signup_windows.started_at < now() - interval '1 hour' THEN now() ELSE price_alert_signup_windows.started_at END,
        attempts = CASE WHEN price_alert_signup_windows.started_at < now() - interval '1 hour' THEN 1 ELSE price_alert_signup_windows.attempts + 1 END
      WHERE price_alert_signup_windows.started_at < now() - interval '1 hour' OR price_alert_signup_windows.attempts < ${limit}
      RETURNING key`;
    if (!result.length) return false;
  }
  return true;
}
