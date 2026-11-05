import { after, NextResponse } from 'next/server';

import { rejectCrossSiteJson } from '@/lib/alerts/request-guard';
import { reserveReviewSubmission } from '@/lib/alerts/signup-limit';
import { isDatabaseConfigured } from '@/lib/database';
import { expireHomeReviews } from '@/lib/reviews/cache';
import { notifyNewReviewSafely } from '@/lib/reviews/notification';
import { HOME_MIN_RATING, saveReview } from '@/lib/reviews/store';
import { validateReview } from '@/lib/reviews/submission';

export async function POST(request: Request) {
  const rejected = rejectCrossSiteJson(request);
  if (rejected) return rejected;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
  } catch {
    return NextResponse.json({ message: 'La solicitud no es válida.' }, { status: 400 });
  }

  if (typeof body.website === 'string' && body.website.length > 0) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const validation = validateReview(body);
  if (!validation.ok) {
    const [field, message] = Object.entries(validation.errors)[0];
    return NextResponse.json({ message, field }, { status: 400 });
  }
  const { review } = validation;

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ message: 'Las opiniones no están disponibles por el momento.' }, { status: 503 });
  }

  try {
    if (!(await reserveReviewSubmission(request))) {
      return NextResponse.json({ message: 'Recibimos demasiadas opiniones. Probá más tarde.' }, { status: 429 });
    }
    const id = await saveReview(review);
    if (review.rating >= HOME_MIN_RATING) expireHomeReviews();
    after(() => notifyNewReviewSafely(id, review));
  } catch {
    console.error('Unable to save review');
    return NextResponse.json({ message: 'No pudimos guardar tu opinión. Probá otra vez.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
