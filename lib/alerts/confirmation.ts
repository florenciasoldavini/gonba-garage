import 'server-only';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { alertOrigin, confirmationLifetimeHours } from './config';
import { sign, uuid } from './cancellation';
import { buildConfirmationEmail, sendAlertEmail } from './email';
import { reserveConfirmationEmail, type AlertScope } from './signup-limit';

const scopes: readonly AlertScope[] = ['price', 'inventory'];

/**
 * `scope.id.generation.expires.signature`. The signed value carries a `confirm.` prefix and five
 * parts, so cancellation tokens (`id.generation`, three parts) never verify here and vice versa.
 */
export function confirmationToken(scope: AlertScope, id: string, generation: string, now = Date.now()) {
  const value = `${scope}.${id}.${generation}.${Math.floor(now / 1000) + confirmationLifetimeHours * 3600}`;
  return `${value}.${sign(`confirm.${value}`)}`;
}

export function parseConfirmationToken(token: string, now = Date.now()) {
  const parts = token.split('.');
  const [scope, id, generation, expires, signature] = parts;
  if (parts.length !== 5 || !scopes.includes(scope as AlertScope) || !uuid.test(id || '') || !uuid.test(generation || '')
    || !/^\d{10}$/.test(expires || '') || !signature || signature.length !== 43) return null;
  const expected = Buffer.from(sign(`confirm.${scope}.${id}.${generation}.${expires}`)), actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return { scope: scope as AlertScope, id, generation, expired: Number(expires) * 1000 <= now };
}

export function confirmationUrl(scope: AlertScope, id: string, generation: string) {
  return `${alertOrigin()}/api/alerts/confirm?token=${confirmationToken(scope, id, generation)}`;
}

export type PendingSubscription = { scope: AlertScope; id: string; generation: string; email: string; title?: string };

/** Sends at most the capped number of confirmations. Returns false when the cap suppressed it. */
export async function sendSignupConfirmation(input: PendingSubscription) {
  if (!await reserveConfirmationEmail(input.scope, input.id, input.email)) return false;
  const payload = buildConfirmationEmail({ ...input, url: confirmationUrl(input.scope, input.id, input.generation) });
  // Each send has a fresh link expiry, so it is a distinct request rather than a retry.
  await sendAlertEmail(payload, `gonba-confirm-${randomUUID()}`);
  return true;
}

/** Runs after the response: the reply is identical whether or not an email is sent. */
export async function sendSignupConfirmationSafely(input: PendingSubscription) {
  try { await sendSignupConfirmation(input); }
  catch { console.error('alert_confirmation_failure', { scope: input.scope }); }
}
