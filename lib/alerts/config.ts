import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { alertEmailEnv, cronEnv, databaseEnv } from '@/lib/env';

export function alertOrigin() {
  const origin = alertEmailEnv.publicOrigin();
  if (!origin) throw new Error('Invalid alerts public origin');
  return origin;
}

export function requireAlertConfig() {
  alertOrigin();
  if (!databaseEnv.url() || !alertEmailEnv.resendApiKey() || !alertEmailEnv.from() || !alertEmailEnv.signingSecret()) {
    throw new Error('Missing alert email configuration');
  }
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
  try {
    requireAlertConfig();
    return true;
  } catch {
    return false;
  }
}

export function cronAuthorized(request: Request) {
  const expected = cronEnv.secret();
  const supplied = request.headers.get('authorization') || '';
  if (!expected) return false;
  const a = Buffer.from(`Bearer ${expected}`);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Signup confirmation links stop working after this many hours. */
export const confirmationLifetimeHours = 72;

export const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};
