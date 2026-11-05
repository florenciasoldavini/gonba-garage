import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { alertOrigin } from '@/lib/alerts/config';
import { sign, uuid } from '@/lib/alerts/cancellation';

/** `review.id.signature`, signed as `remove-review.id`, so no alert link verifies here or the reverse. */
export function reviewRemovalToken(id: string) {
  return `review.${id}.${sign(`remove-review.${id}`)}`;
}

export function parseReviewRemovalToken(token: string) {
  const parts = token.split('.');
  const [scope, id, signature] = parts;
  if (parts.length !== 3 || scope !== 'review' || !uuid.test(id || '') || signature?.length !== 43) return null;
  const expected = Buffer.from(sign(`remove-review.${id}`));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? { id } : null;
}

export function reviewRemovalUrl(id: string) {
  return `${alertOrigin()}/api/reviews/remove?token=${reviewRemovalToken(id)}`;
}
