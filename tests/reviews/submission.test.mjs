import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { reviewDateLabel, reviewDealLabel } from '@/lib/reviews/labels';
import { reviewDisplayName, validateReview } from '@/lib/reviews/submission';

const valid = {
  type: 'bought',
  rating: 5,
  comment: 'Muy buena atención de principio a fin.',
  name: 'Martín García',
  vehicle: 'Toyota SW4',
  consent: true,
};
const errorsFor = input => validateReview({ ...valid, ...input }).errors;

describe('the name shown', () => {
  it('keeps the first name and the last initial, and nothing else', () => {
    assert.equal(reviewDisplayName('Martín García'), 'Martín G.');
    assert.equal(reviewDisplayName('María del Carmen López'), 'María L.');
    assert.equal(reviewDisplayName('  Ana   Ñáñez '), 'Ana Ñ.');
    assert.equal(reviewDisplayName('Carolina'), 'Carolina');
  });

  it('fixes names typed all in one case and keeps chosen capitals', () => {
    assert.equal(reviewDisplayName('martín garcía'), 'Martín G.');
    assert.equal(reviewDisplayName('MARTÍN GARCÍA'), 'Martín G.');
    assert.equal(reviewDisplayName('McKenzie Paz'), 'McKenzie P.');
  });
});

describe('a valid review', () => {
  it('stores only the short name and clean text', () => {
    const { ok, review } = validateReview({
      ...valid,
      comment: ' Muy   buena\n\natención.\u0000 ',
      vehicle: '  VW  Amarok ',
    });
    assert.equal(ok, true);
    assert.deepEqual(review, {
      transactionType: 'bought',
      rating: 5,
      comment: 'Muy buena atención.',
      displayName: 'Martín G.',
      vehicle: 'VW Amarok',
    });
  });

  it('does not need a car, and accepts the year and price of one', () => {
    assert.equal(validateReview({ ...valid, vehicle: '' }).review.vehicle, null);
    assert.equal(validateReview({ ...valid, comment: 'Mi Corolla 2019 con 80.000 km salió USD 20.000.' }).ok, true);
  });
});

describe('a rejected review', () => {
  it('needs every required field, with an error for each', () => {
    const { ok, errors } = validateReview({});
    assert.equal(ok, false);
    assert.deepEqual(Object.keys(errors), ['type', 'rating', 'comment', 'name', 'consent']);
  });

  it('needs a whole rating from 1 to 5 and explicit consent', () => {
    for (const rating of [0, 6, 4.5, '5', null]) assert.ok(errorsFor({ rating }).rating, String(rating));
    for (const consent of [false, 'on', undefined]) assert.ok(errorsFor({ consent }).consent, String(consent));
    assert.ok(errorsFor({ type: 'rented' }).type);
  });

  it('keeps links, phone numbers and email addresses off the page', () => {
    for (const comment of [
      'Mirá https://example.test',
      'Entrá a www.ejemplo.test',
      'Comprá en ejemplo.com.ar',
      'Escribime a alguien@example.test',
      'Llamame al 11 5555-0000',
      'Whatsapp +54 9 11 5555 0000',
    ]) {
      assert.ok(errorsFor({ comment }).comment, comment);
    }
    assert.ok(errorsFor({ vehicle: 'www.ejemplo.test' }).vehicle);
    assert.ok(errorsFor({ name: 'www.ejemplo.test' }).name);
    assert.ok(errorsFor({ name: 'Llamá 1155550000' }).name);
  });

  it('enforces the lengths the database checks', () => {
    assert.ok(errorsFor({ comment: 'a'.repeat(281) }).comment);
    assert.ok(errorsFor({ name: 'a'.repeat(81) }).name);
    assert.ok(errorsFor({ vehicle: 'a'.repeat(61) }).vehicle);
  });
});

describe('the labels on a card', () => {
  it('names the car when there is one', () => {
    assert.equal(reviewDealLabel({ transactionType: 'bought', vehicle: 'Toyota SW4' }), 'Compró · Toyota SW4');
    assert.equal(reviewDealLabel({ transactionType: 'sold', vehicle: 'Peugeot 208' }), 'Vendió · Peugeot 208');
    assert.equal(reviewDealLabel({ transactionType: 'bought', vehicle: null }), 'Compró un auto');
    assert.equal(reviewDealLabel({ transactionType: 'sold', vehicle: null }), 'Vendió su auto');
  });

  it('dates a review in Argentine time', () => {
    assert.match(reviewDateLabel('2026-11-01T01:00:00.000Z'), /^oct 2026$/i);
  });
});
