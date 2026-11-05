import { Star } from 'lucide-react';

import { Eyebrow } from '@/components/ui/eyebrow';
import { reviewDateLabel, reviewDealLabel } from '@/lib/reviews/labels';
import type { Review } from '@/lib/reviews/rows';
import { HomeReviewsRail } from './home-reviews-rail';
import './home-reviews.css';

function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="review-card-stars" role="img" aria-label={`${rating} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          aria-hidden="true"
          className={star <= rating ? 'review-star-filled' : undefined}
          key={star}
          size={18}
          strokeWidth={1.8}
        />
      ))}
    </div>
  );
}

export function HomeReviews({ reviews }: { reviews: Review[] }) {
  return (
    <section className="section-shell reviews-section" id="opiniones" aria-labelledby="reviews-title">
      <div className="section-heading">
        <div>
          <Eyebrow>Opiniones</Eyebrow>
          <h2 id="reviews-title">Lo cuentan nuestros clientes.</h2>
        </div>
        <div className="section-heading-copy">
          <p>Una selección de opiniones de personas que compraron o vendieron su auto con nosotros.</p>
        </div>
      </div>
      <HomeReviewsRail>
        {reviews.map(review => (
          <article className="review-card glass-panel" key={review.id}>
            <ReviewStars rating={review.rating} />
            <p>{review.comment}</p>
            <div className="review-card-meta">
              <div>
                <strong>{review.displayName}</strong>
                <span>{reviewDealLabel(review)}</span>
              </div>
              <time dateTime={review.createdAt}>{reviewDateLabel(review.createdAt)}</time>
            </div>
          </article>
        ))}
      </HomeReviewsRail>
    </section>
  );
}
