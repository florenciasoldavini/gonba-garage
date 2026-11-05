import assert from 'node:assert/strict';
import { afterAll, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import { createDatabase } from '../helpers/postgres.mjs';

// The store against real PostgreSQL (PGlite), migrated like production.
const state = vi.hoisted(() => ({ db: null }));
vi.mock('@/lib/database', async () => {
  const { createSql: sql } = await import('../helpers/postgres.mjs');
  return { getSql: () => sql(() => state.db) };
});

const { deleteReview, listHomeReviews, saveReview } = await import('@/lib/reviews/store');

const review = (rating, comment = 'Muy buena atención.') => ({
  transactionType: 'bought',
  rating,
  comment,
  displayName: 'Martín G.',
  vehicle: null,
});
const stored = async () =>
  (await state.db.query('SELECT count(*)::int AS total FROM public.customer_reviews')).rows[0].total;

beforeAll(async () => {
  state.db = await createDatabase();
});
afterAll(() => state.db.close());
beforeEach(() => state.db.exec('DELETE FROM public.customer_reviews'));

describe('the home page reviews', () => {
  it('stay hidden until there are three with 4 stars or more', async () => {
    await saveReview(review(5));
    await saveReview(review(4));
    await saveReview(review(3));
    await saveReview(review(1));
    assert.deepEqual(await listHomeReviews(), []);
    assert.equal(await stored(), 4, 'Low ratings are kept, not discarded');

    await saveReview(review(5));
    assert.equal((await listHomeReviews()).length, 3);
  });

  it('are newest first and never a low rating', async () => {
    for (const [rating, comment, day] of [
      [5, 'old', '2026-01-01'],
      [4, 'second', '2026-03-01'],
      [5, 'third', '2026-02-01'],
      [2, 'low', '2026-05-01'],
      [5, 'first', '2026-04-01'],
    ]) {
      const id = await saveReview(review(rating, comment));
      await state.db.query('UPDATE public.customer_reviews SET created_at = $1 WHERE id = $2', [day, id]);
    }
    const reviews = await listHomeReviews();
    assert.deepEqual(
      reviews.map(({ comment }) => comment),
      ['first', 'second', 'third', 'old'],
    );
    assert.equal(typeof reviews[0].createdAt, 'string', 'Cached as JSON, so it is not a Date');
  });
});

it('the home page shows six reviews at most', async () => {
  for (let index = 0; index < 8; index += 1) await saveReview(review(5));
  assert.equal((await listHomeReviews()).length, 6);
});

it('removing a review deletes it and is safe to repeat', async () => {
  const id = await saveReview(review(5));
  await deleteReview(id);
  await deleteReview(id);
  assert.equal(await stored(), 0);
});

it('the database refuses a rating or comment the form would refuse', async () => {
  await assert.rejects(saveReview(review(6)));
  await assert.rejects(saveReview(review(5, 'a'.repeat(281))));
  await assert.rejects(saveReview({ ...review(5), transactionType: 'rented' }));
});
