import 'server-only';
import { revalidateTag, unstable_cache } from 'next/cache';
import { listHomeReviews } from './store';

const HOME_REVIEWS_TAG = 'reviews:home';
/** Entries outlive a deploy, and a new deploy may read rows differently (lib/catalog/cache.ts). */
const deployment = process.env.VERCEL_DEPLOYMENT_ID ?? '';
/** Writes expire the entry. This only bounds a write whose expiry never went through. */
const BACKSTOP_SECONDS = 24 * 60 * 60;

/** A failed read throws and is never stored. */
export const readHomeReviews = unstable_cache(() => listHomeReviews(), ['home-reviews', deployment], {
  tags: [HOME_REVIEWS_TAG],
  revalidate: BACKSTOP_SECONDS,
});

/** Call after a write that may change the home page. */
export function expireHomeReviews() {
  revalidateTag(HOME_REVIEWS_TAG, { expire: 0 });
}
