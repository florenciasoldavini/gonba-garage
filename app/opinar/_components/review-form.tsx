'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowUpRight, CircleAlert, LoaderCircle, Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PrivacyPolicyLink } from '@/components/ui/privacy-policy-link';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { postJson, type RequestFailure } from '@/lib/json-request';
import {
  COMMENT_MAX_LENGTH,
  NAME_MAX_LENGTH,
  VEHICLE_MAX_LENGTH,
  validateReview,
  type ReviewErrors,
  type ReviewField,
  type TransactionType,
} from '@/lib/reviews/submission';
import { ReviewSuccess } from './review-success';
import './review-form.css';

const transactionOptions: { value: TransactionType; label: string }[] = [
  { value: 'bought', label: 'Compré un auto' },
  { value: 'sold', label: 'Vendí mi auto' },
];
const ratingLabels = ['', 'Muy mala', 'Mala', 'Regular', 'Buena', 'Excelente'];

const errorId = (field: ReviewField) => `review-${field}-error`;

function FieldError({ field, message }: { field: ReviewField; message: string | undefined }) {
  if (!message) return null;

  // Read through the control's aria-describedby. aria-hidden keeps it out of the wrapping label's accessible name.
  return (
    <small className="review-field-error" id={errorId(field)} aria-hidden="true">
      <CircleAlert size={14} strokeWidth={2} />
      {message}
    </small>
  );
}

export function ReviewForm() {
  const [rating, setRating] = useState(0);
  const [commentLength, setCommentLength] = useState(0);
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const invalidProps = (field: ReviewField) =>
    errors[field] ? { 'aria-invalid': true, 'aria-describedby': errorId(field) } : {};

  function handleChange(event: ChangeEvent<HTMLFormElement>) {
    const field = event.target.name as ReviewField;
    setErrors(current => ({ ...current, [field]: undefined }));
    setFailure(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const focusField = (field: string) => form.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
    const payload = {
      type: data.get('type'),
      rating: Number(data.get('rating')),
      comment: data.get('comment'),
      name: data.get('name'),
      vehicle: data.get('vehicle'),
      consent: data.get('consent') === 'on',
      website: data.get('website'),
    };

    const validation = validateReview(payload);
    if (!validation.ok) {
      setErrors(validation.errors);
      focusField(Object.keys(validation.errors)[0]);
      return;
    }

    setSubmitting(true);
    setFailure(null);
    const result = await postJson('/api/reviews', payload);
    setSubmitting(false);
    if (result.ok) {
      const { transactionType, rating: score } = validation.review;
      captureAnalyticsEvent('review_submitted', { rating: score, transaction_type: transactionType });
      setSent(true);
      return;
    }
    captureAnalyticsEvent('review_failed', {});
    const { field } = result.failure;
    if (field) {
      setErrors({ [field]: result.failure.title });
      focusField(field);
    } else {
      setFailure(result.failure);
    }
  }

  if (sent) return <ReviewSuccess />;

  return (
    <form
      className="review-form ph-no-capture"
      aria-label="Tu opinión"
      noValidate
      onChange={handleChange}
      onSubmit={handleSubmit}
    >
      <fieldset {...invalidProps('type')}>
        <legend>¿Qué hiciste con nosotros?</legend>
        <div className="review-options">
          {transactionOptions.map(({ value, label }) => (
            <label key={value}>
              <input className="sr-only" name="type" type="radio" value={value} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <FieldError field="type" message={errors.type} />
      </fieldset>

      <fieldset {...invalidProps('rating')}>
        <legend>Tu puntuación</legend>
        <div className="review-rating">
          <div className="review-rating-stars">
            {[1, 2, 3, 4, 5].map(star => (
              <label key={star}>
                <input
                  aria-label={`${star} de 5 estrellas`}
                  className="sr-only"
                  name="rating"
                  onChange={() => setRating(star)}
                  type="radio"
                  value={star}
                />
                <Star
                  aria-hidden="true"
                  className={star <= rating ? 'review-star-filled' : undefined}
                  size={26}
                  strokeWidth={1.6}
                />
              </label>
            ))}
          </div>
          <span aria-live="polite">{ratingLabels[rating]}</span>
        </div>
        <FieldError field="rating" message={errors.rating} />
      </fieldset>

      <label className="review-field">
        <span>Tu comentario</span>
        <textarea
          maxLength={COMMENT_MAX_LENGTH}
          name="comment"
          onChange={event => setCommentLength(event.target.value.length)}
          placeholder="Contanos cómo te fue"
          rows={4}
          {...invalidProps('comment')}
        />
        <span className="review-counter">
          {commentLength}/{COMMENT_MAX_LENGTH}
        </span>
        <FieldError field="comment" message={errors.comment} />
      </label>

      <div className="review-field-row">
        <label className="review-field">
          <span>Nombre y apellido</span>
          <input
            autoComplete="name"
            maxLength={NAME_MAX_LENGTH}
            name="name"
            placeholder="Martín García"
            type="text"
            {...invalidProps('name')}
          />
          <small>Solo mostramos tu nombre y la inicial del apellido.</small>
          <FieldError field="name" message={errors.name} />
        </label>
        <label className="review-field">
          <span>Tu auto (opcional)</span>
          <input
            maxLength={VEHICLE_MAX_LENGTH}
            name="vehicle"
            placeholder="Toyota SW4"
            type="text"
            {...invalidProps('vehicle')}
          />
          <FieldError field="vehicle" message={errors.vehicle} />
        </label>
      </div>

      <label className="review-honeypot" aria-hidden="true">
        Sitio web
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>

      <div className="review-consent">
        <label>
          <input name="consent" type="checkbox" {...invalidProps('consent')} />
          <span>
            Acepto que esta opinión pueda mostrarse en el sitio con mi nombre, la inicial de mi apellido y el auto. Más
            información en la <PrivacyPolicyLink />.
          </span>
        </label>
        <FieldError field="consent" message={errors.consent} />
      </div>

      {failure ? (
        <p className="review-failure" role="alert">
          <strong>{failure.title}</strong>
          {failure.detail ? ` ${failure.detail}` : ''}
        </p>
      ) : null}

      <Button disabled={submitting} type="submit">
        {submitting ? 'Enviando…' : 'Enviar opinión'}
        {submitting ? (
          <LoaderCircle className="icon-spinner" aria-hidden="true" size={16} strokeWidth={1.8} />
        ) : (
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
        )}
      </Button>
    </form>
  );
}
