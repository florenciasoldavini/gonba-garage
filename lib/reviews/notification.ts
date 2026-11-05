import 'server-only';
import { alertEmailsConfigured } from '@/lib/alerts/config';
import { buildReviewNotificationEmail, sendAlertEmail } from '@/lib/alerts/email';
import { reviewEnv } from '@/lib/env';
import { reviewRemovalUrl } from './removal';
import { HOME_MIN_RATING } from './store';
import { reviewDealLabel } from './labels';
import type { NewReview } from './submission';

/**
 * Tells REVIEWS_NOTIFICATION_EMAIL about a new review, with a link to remove it. Runs after the
 * response: a review is saved and published whether or not this email can be sent.
 */
export async function notifyNewReviewSafely(id: string, review: NewReview) {
  const to = reviewEnv.notificationEmail();
  if (!to || !alertEmailsConfigured()) return;
  try {
    const payload = buildReviewNotificationEmail({
      to,
      rating: review.rating,
      comment: review.comment,
      displayName: review.displayName,
      deal: reviewDealLabel(review),
      canAppearOnHome: review.rating >= HOME_MIN_RATING,
      removalUrl: reviewRemovalUrl(id),
    });
    await sendAlertEmail(payload, `gonba-review-${id}`);
  } catch {
    console.error('review_notification_failure');
  }
}
