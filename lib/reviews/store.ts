import 'server-only';
import { getSql } from '@/lib/database';
import { parseRows, text, type Row } from '@/lib/database-rows';
import { parseReview } from './rows';
import type { NewReview } from './submission';

/** Lower ratings are stored and reach the notification email, but appear nowhere on the site. */
export const HOME_MIN_RATING = 4;
/** The section stays hidden until there are enough to fill a row. */
export const HOME_MIN_REVIEWS = 3;
export const HOME_MAX_REVIEWS = 6;

export async function saveReview(review: NewReview) {
  const rows = (await getSql()`INSERT INTO public.customer_reviews
      (transaction_type, rating, comment, display_name, vehicle)
    VALUES (${review.transactionType}, ${review.rating}, ${review.comment}, ${review.displayName}, ${review.vehicle})
    RETURNING id`) as Row[];
  return text(rows[0]?.id, 'id');
}

export async function listHomeReviews() {
  const rows = (await getSql()`SELECT id, transaction_type, rating, comment, display_name, vehicle, created_at
    FROM public.customer_reviews
    WHERE rating >= ${HOME_MIN_RATING}
    ORDER BY created_at DESC
    LIMIT ${HOME_MAX_REVIEWS}`) as Row[];
  const reviews = parseRows('customer_reviews', rows, parseReview);
  return reviews.length >= HOME_MIN_REVIEWS ? reviews : [];
}

export async function deleteReview(id: string) {
  await getSql()`DELETE FROM public.customer_reviews WHERE id = ${id}`;
}
