import assert from 'node:assert/strict';
import { beforeEach, describe, it, vi } from 'vitest';
import { GET as removalPage, POST as remove } from '@/app/api/reviews/remove/route';
import { POST as submit } from '@/app/api/reviews/route';
import { cancellationToken } from '@/lib/alerts/cancellation';
import { buildReviewNotificationEmail } from '@/lib/alerts/email';
import { notifyNewReviewSafely } from '@/lib/reviews/notification';
import { parseReviewRemovalToken, reviewRemovalToken } from '@/lib/reviews/removal';

// Route behavior with storage, the rate limit and the cache replaced.
const routes = vi.hoisted(() => ({
  configured: true,
  allowed: true,
  failStorage: false,
  saved: [],
  deleted: [],
  expired: 0,
  deferred: [],
}));
vi.mock('next/server', async importOriginal => ({
  ...(await importOriginal()),
  after: task => {
    routes.deferred.push(task);
  },
}));
vi.mock('@/lib/database', () => ({ isDatabaseConfigured: () => routes.configured }));
vi.mock('@/lib/alerts/signup-limit', () => ({ reserveReviewSubmission: async () => routes.allowed }));
vi.mock('@/lib/reviews/cache', () => ({
  expireHomeReviews: () => {
    routes.expired += 1;
  },
}));
vi.mock('@/lib/reviews/store', () => ({
  HOME_MIN_RATING: 4,
  saveReview: async review => {
    if (routes.failStorage) throw new Error('Private DB error');
    routes.saved.push(review);
    return 'a7f7ea2c-6c0a-4f3e-9a3a-0c1b2d3e4f50';
  },
  deleteReview: async id => {
    if (routes.failStorage) throw new Error('Private DB error');
    routes.deleted.push(id);
  },
}));

const id = 'a7f7ea2c-6c0a-4f3e-9a3a-0c1b2d3e4f50';
const valid = {
  type: 'sold',
  rating: 5,
  comment: 'Me pasaron una propuesta clara.',
  name: 'Carolina Rodríguez',
  vehicle: 'Peugeot 208',
  consent: true,
};
const post = (body, headers = {}) =>
  submit(
    new Request('https://example.test/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  );
const removalRequest = (token, method = 'GET') =>
  new Request(`https://example.test/api/reviews/remove?token=${encodeURIComponent(token)}`, { method });
const emailSettings = {
  RESEND_API_KEY: 'test-key',
  ALERTS_EMAIL_FROM: 'Gonba <alertas@example.test>',
  ALERTS_PUBLIC_URL: 'https://example.test',
  DATABASE_URL: 'postgres://example.test/db',
};

beforeEach(() => {
  Object.assign(routes, {
    configured: true,
    allowed: true,
    failStorage: false,
    saved: [],
    deleted: [],
    expired: 0,
    deferred: [],
  });
  vi.stubEnv('ALERTS_SIGNING_SECRET', 'a-signing-secret-of-at-least-32-characters');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('submitting a review', () => {
  it('stores it with the short name and updates the home page', async () => {
    const response = await post(valid);
    assert.equal(response.status, 201);
    assert.equal(routes.saved[0].displayName, 'Carolina R.');
    assert.equal(JSON.stringify(routes.saved).includes('Rodríguez'), false, 'The full name is never stored');
    assert.equal(routes.expired, 1);
    assert.equal(routes.deferred.length, 1, 'The email goes out after the response');
  });

  it('stores a low rating without touching the home page', async () => {
    assert.equal((await post({ ...valid, rating: 2 })).status, 201);
    assert.equal(routes.saved.length, 1);
    assert.equal(routes.expired, 0);
  });

  it('answers a bot that fills the hidden field as if it had worked, and stores nothing', async () => {
    assert.equal((await post({ ...valid, website: 'https://example.test' })).status, 201);
    assert.equal(routes.saved.length, 0);
  });

  it('names the field it rejects', async () => {
    const response = await post({ ...valid, comment: 'Llamame al 11 5555-0000' });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.field, 'comment');
    assert.equal(routes.saved.length, 0);
  });

  it('refuses a review without consent', async () => {
    const response = await post({ ...valid, consent: false });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).field, 'consent');
  });

  it('accepts same-site JSON only', async () => {
    assert.equal((await post(valid, { Origin: 'https://other.test' })).status, 403);
    assert.equal((await post(valid, { 'Content-Type': 'text/plain' })).status, 415);
  });

  it('stops at the rate limit', async () => {
    routes.allowed = false;
    assert.equal((await post(valid)).status, 429);
    assert.equal(routes.saved.length, 0);
  });

  it('says so without details when the database fails or is missing', async () => {
    routes.failStorage = true;
    const failed = await post(valid);
    assert.equal(failed.status, 500);
    assert.doesNotMatch(await failed.text(), /Private DB error/);
    routes.configured = false;
    assert.equal((await post(valid)).status, 503);
  });
});

describe('the removal link', () => {
  it('accepts only its own signed token', () => {
    assert.deepEqual(parseReviewRemovalToken(reviewRemovalToken(id)), { id });
    assert.equal(parseReviewRemovalToken(`${reviewRemovalToken(id).slice(0, -1)}x`), null);
    assert.equal(parseReviewRemovalToken(`review.${id}.${'a'.repeat(43)}`), null);
    assert.equal(parseReviewRemovalToken('invalid'), null);
    assert.equal(parseReviewRemovalToken(cancellationToken(id, id)), null, 'An alert link never removes a review');
  });

  it('removes nothing on GET, because email scanners follow links', async () => {
    const response = await removalPage(removalRequest(reviewRemovalToken(id)));
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<form method="post">/);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
    assert.equal(routes.deleted.length, 0);
  });

  it('deletes the review on POST and updates the home page', async () => {
    const response = await remove(removalRequest(reviewRemovalToken(id), 'POST'));
    assert.equal(response.status, 200);
    assert.deepEqual(routes.deleted, [id]);
    assert.equal(routes.expired, 1);
  });

  it('rejects an invalid link', async () => {
    assert.equal((await removalPage(removalRequest('invalid'))).status, 400);
    assert.equal((await remove(removalRequest('invalid', 'POST'))).status, 400);
    assert.equal(routes.deleted.length, 0);
  });

  it('reports a failed removal', async () => {
    routes.failStorage = true;
    assert.equal((await remove(removalRequest(reviewRemovalToken(id), 'POST'))).status, 503);
  });
});

describe('the notification email', () => {
  const review = {
    transactionType: 'sold',
    rating: 5,
    comment: 'Excelente',
    displayName: 'Carolina R.',
    vehicle: null,
  };
  const sent = () => {
    const fetchMock = vi.fn(async () => Response.json({ id: 'email-id' }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('goes to the configured address, with the removal link', async () => {
    for (const [name, value] of Object.entries(emailSettings)) vi.stubEnv(name, value);
    vi.stubEnv('REVIEWS_NOTIFICATION_EMAIL', 'avisos@example.test');
    const fetchMock = sent();
    await notifyNewReviewSafely(id, review);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    assert.deepEqual(body.to, ['avisos@example.test']);
    assert.match(body.text, /https:\/\/example\.test\/api\/reviews\/remove\?token=review\./);
  });

  it('is skipped without an address, and the review stands', async () => {
    for (const [name, value] of Object.entries(emailSettings)) vi.stubEnv(name, value);
    vi.stubEnv('REVIEWS_NOTIFICATION_EMAIL', '');
    const fetchMock = sent();
    await notifyNewReviewSafely(id, review);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it('never fails the submission when the provider does', async () => {
    for (const [name, value] of Object.entries(emailSettings)) vi.stubEnv(name, value);
    vi.stubEnv('REVIEWS_NOTIFICATION_EMAIL', 'avisos@example.test');
    vi.stubGlobal('fetch', async () => new Response(null, { status: 500 }));
    await notifyNewReviewSafely(id, review);
  });

  it('escapes what the customer typed', () => {
    const { html } = buildReviewNotificationEmail({
      to: 'avisos@example.test',
      rating: 5,
      comment: '<script>alert(1)</script>',
      displayName: '<b>Ana</b>',
      deal: 'Compró · <i>Auto</i>',
      canAppearOnHome: true,
      removalUrl: 'https://example.test/remove',
    });
    assert.doesNotMatch(html, /<script>|<b>Ana|<i>Auto/);
  });

  it('says whether the review can reach the home page', () => {
    const email = canAppearOnHome =>
      buildReviewNotificationEmail({
        to: 'avisos@example.test',
        rating: canAppearOnHome ? 5 : 2,
        comment: 'Comentario',
        displayName: 'Ana P.',
        deal: 'Compró un auto',
        canAppearOnHome,
        removalUrl: 'https://example.test/remove',
      });
    assert.match(email(true).text, /puede aparecer en la home/);
    assert.match(email(false).text, /no se muestra en el sitio/);
    assert.match(email(false).subject, /2 de 5/);
  });
});
