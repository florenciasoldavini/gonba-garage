import 'server-only';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { getSql } from '@/lib/database';
import { alertEmailEnv } from '@/lib/env';
import { requireAlertConfig } from './config';

export type AlertScope = 'price' | 'inventory';
type Bucket = { key: string; limit: number; windowSeconds: number };

const hour = 3600;
/**
 * Fixed windows shared across instances. Each endpoint has its own keys, so one cannot exhaust
 * the other. Buckets are checked from the narrowest identity to the widest, and a rejected request
 * does not count against the wider buckets:
 * - per client IP (IPv6 by /64), 20/hour: generous for carrier-grade NAT, bounds a single script;
 * - per address, 5/hour: repeated signups for one inbox;
 * - global, 100/hour per endpoint: caps total writes and confirmation emails under IP rotation.
 */
const signupLimits = { ip: 20, email: 5, global: 100 } as const;
/**
 * Reviews publish without anyone reading them first, and a sale is a rare event, so these are much
 * tighter: 5/hour per client IP and 30/hour in total. They ask for no email, so there is no per-address bucket.
 */
const reviewLimits = { ip: 5, global: 30 } as const;
/**
 * Confirmation emails: one per subscription every 10 minutes, so resubmitting a pending signup
 * cannot loop sends, and 5 per recipient per day across both endpoints, so the confirmation email
 * itself cannot be used to flood an inbox.
 */
const confirmationLimits = {
  subscription: { limit: 1, windowSeconds: 600 },
  recipient: { limit: 5, windowSeconds: 24 * hour },
} as const;

/** Keyed hashes only: raw addresses and IPs are never stored. */
function hashed(secret: string, kind: string, value: string) {
  return createHmac('sha256', secret).update(`rate-limit:${kind}:${value}`).digest('hex');
}

/** First hop set by the platform proxy. IPv6 clients usually control a whole /64. */
export function clientIp(request: Request) {
  const raw = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '';
  const ip = raw.trim().toLowerCase().replace(/%.*$/, '');
  const version = isIP(ip);
  if (version === 4) return ip;
  if (version !== 6) return 'unknown';
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  const [head, tail] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups =
    tail === undefined ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  return `${groups
    .slice(0, 4)
    .map(group => parseInt(group, 16).toString(16))
    .join(':')}::/64`;
}

/**
 * Every bucket lives in price_alert_signup_windows: both signup endpoints, the confirmation emails
 * and the review form. The table keeps its first name on purpose. Migrations and deploys are not atomic on
 * Vercel, so a rename would leave either the running or the new code querying a missing table
 * unless a compatibility view bridged two releases, and the frozen BASELINE in
 * scripts/migration-runner.mjs checks for this name. Not worth it for a name.
 */
async function reserve(buckets: Bucket[]) {
  const sql = getSql();
  // Opportunistic pruning: no window is longer than a day, so older rows are already expired.
  if (Math.random() < 0.02)
    await sql`DELETE FROM public.price_alert_signup_windows WHERE started_at < now() - interval '2 days'`;
  for (const { key, limit, windowSeconds } of buckets) {
    const result = await sql`INSERT INTO public.price_alert_signup_windows (key) VALUES (${key})
      ON CONFLICT (key) DO UPDATE SET
        started_at = CASE WHEN price_alert_signup_windows.started_at < now() - ${windowSeconds} * interval '1 second' THEN now() ELSE price_alert_signup_windows.started_at END,
        attempts = CASE WHEN price_alert_signup_windows.started_at < now() - ${windowSeconds} * interval '1 second' THEN 1 ELSE price_alert_signup_windows.attempts + 1 END
      WHERE price_alert_signup_windows.started_at < now() - ${windowSeconds} * interval '1 second' OR price_alert_signup_windows.attempts < ${limit}
      RETURNING key`;
    if (!result.length) return false;
  }
  return true;
}

/**
 * Applies whenever the alerts database is configured, including demo mode, because demo signups
 * still write rows. Without a signing secret (possible only where alert emails are not configured) the
 * per-IP and per-address buckets cannot be keyed safely, so only the global bucket applies.
 */
export async function reserveAlertSignup(scope: AlertScope, email: string, request: Request) {
  const secret = alertEmailEnv.signingSecret();
  const buckets: Bucket[] = secret
    ? [
        { key: `${scope}:ip:${hashed(secret, 'ip', clientIp(request))}`, limit: signupLimits.ip, windowSeconds: hour },
        { key: `${scope}:email:${hashed(secret, 'email', email)}`, limit: signupLimits.email, windowSeconds: hour },
      ]
    : [];
  buckets.push({ key: `${scope}:global`, limit: signupLimits.global, windowSeconds: hour });
  return reserve(buckets);
}

/** Same rules as reserveAlertSignup for a missing signing secret. */
export async function reserveReviewSubmission(request: Request) {
  const secret = alertEmailEnv.signingSecret();
  const buckets: Bucket[] = secret
    ? [{ key: `review:ip:${hashed(secret, 'ip', clientIp(request))}`, limit: reviewLimits.ip, windowSeconds: hour }]
    : [];
  buckets.push({ key: 'review:global', limit: reviewLimits.global, windowSeconds: hour });
  return reserve(buckets);
}

export async function reserveConfirmationEmail(scope: AlertScope, subscriptionId: string, email: string) {
  requireAlertConfig();
  return reserve([
    { key: `confirm:${scope}:${subscriptionId}`, ...confirmationLimits.subscription },
    { key: `confirm:email:${hashed(alertEmailEnv.signingSecret()!, 'email', email)}`, ...confirmationLimits.recipient },
  ]);
}
