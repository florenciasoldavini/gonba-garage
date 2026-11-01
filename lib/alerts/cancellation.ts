import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { alertOrigin } from './config';

export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Callers must give each token type a distinct signed format, so one can never verify as another. */
export function sign(value: string) {
  const secret = process.env.ALERTS_SIGNING_SECRET;
  if (!secret || secret.length < 32) throw new Error('Missing alert signing secret');
  return createHmac('sha256', secret).update(value).digest('base64url');
}
export function cancellationToken(id: string, generation: string) {
  const value = `${id}.${generation}`;
  return `${value}.${sign(value)}`;
}
export function parseCancellationToken(token: string) {
  const parts = token.split('.');
  const [id, generation, signature] = parts;
  if (parts.length !== 3 || !uuid.test(id || '') || !uuid.test(generation || '') || !signature || signature.length !== 43) return null;
  const expected = Buffer.from(sign(`${id}.${generation}`)), actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? { id, generation } : null;
}
export function cancellationUrl(id: string, generation: string) {
  return `${alertOrigin()}/api/price-alerts/cancel?token=${cancellationToken(id, generation)}`;
}

/**
 * Search alerts: `search.id.generation.signature`, signed as `cancel.search.id.generation`. Four
 * parts and its own prefix, so it never verifies as a price cancellation (three parts, unprefixed)
 * or a confirmation (five parts, `confirm.` prefix), and they never verify here.
 */
export function searchCancellationToken(id: string, generation: string) {
  return `search.${id}.${generation}.${sign(`cancel.search.${id}.${generation}`)}`;
}
export function parseSearchCancellationToken(token: string) {
  const parts = token.split('.');
  const [scope, id, generation, signature] = parts;
  if (parts.length !== 4 || scope !== 'search' || !uuid.test(id || '') || !uuid.test(generation || '') || !signature || signature.length !== 43) return null;
  const expected = Buffer.from(sign(`cancel.search.${id}.${generation}`)), actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? { id, generation } : null;
}
export function searchCancellationUrl(id: string, generation: string) {
  return `${alertOrigin()}/api/inventory-alerts/cancel?token=${searchCancellationToken(id, generation)}`;
}
