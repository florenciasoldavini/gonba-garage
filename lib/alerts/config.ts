import 'server-only';
import { timingSafeEqual } from 'node:crypto';

export function alertOrigin() {
  const url = new URL(process.env.ALERTS_PUBLIC_URL || '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Invalid alerts public origin');
  }
  return url.origin;
}

export function requireAlertConfig() {
  alertOrigin();
  if (!process.env.DATABASE_URL || !process.env.RESEND_API_KEY || !process.env.ALERTS_EMAIL_FROM
    || (process.env.ALERTS_SIGNING_SECRET?.length ?? 0) < 32) throw new Error('Missing alert email configuration');
}

/**
 * Whether this deployment can send alert emails: the database plus the Resend key, sender, public
 * origin and signing secret. There is no separate on/off switch. Alerts (price and search) are
 * offered, confirmed and delivered exactly when this is true, so the site never promises an email
 * it cannot send. Production has the configuration; previews and local runs usually do not, so they
 * neither show alerts nor email real people. To stop all alert email, remove RESEND_API_KEY and
 * redeploy.
 */
export function alertEmailsConfigured() {
  try { requireAlertConfig(); return true; } catch { return false; }
}

export function cronAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization') || '';
  if (!expected || expected.length < 32) return false;
  const a = Buffer.from(`Bearer ${expected}`), b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Signup confirmation links stop working after this many hours. */
export const confirmationLifetimeHours = 72;

export const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };
