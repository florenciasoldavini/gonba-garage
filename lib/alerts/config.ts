import 'server-only';
import { timingSafeEqual } from 'node:crypto';

export function alertDeliveryEnabled() {
  return process.env.PRICE_ALERT_DELIVERY_ENABLED === 'true';
}

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
    || (process.env.ALERTS_SIGNING_SECRET?.length ?? 0) < 32) throw new Error('Missing price alert configuration');
}

export function cronAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization') || '';
  if (!expected || expected.length < 32) return false;
  const a = Buffer.from(`Bearer ${expected}`), b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };
