import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { POST as inventory } from '@/app/api/inventory-alerts/route';
import { POST as price } from '@/app/api/price-alerts/route';
import { runtimeImports } from '../helpers/modules.mjs';

// Route behavior with storage and delivery replaced: alert emails are not configured (demo mode).
const routes = vi.hoisted(() => ({ calls: [], configured: true, failStorage: false, vehicle: null, deferred: [] }));
vi.mock('next/server', async importOriginal => ({
  ...(await importOriginal()),
  after: task => {
    routes.deferred.push(task);
  },
}));
vi.mock('@/lib/database', () => ({ isDatabaseConfigured: () => routes.configured }));
vi.mock('@/lib/alerts/config', () => ({ alertEmailsConfigured: () => false }));
vi.mock('@/lib/alerts/price-delivery', () => ({}));
vi.mock('@/lib/alerts/signup-limit', () => ({ reserveAlertSignup: async () => true }));
vi.mock('@/lib/alerts/confirmation', () => ({
  sendSignupConfirmationSafely: async () => assert.fail('Demo mode sends no confirmation'),
}));
vi.mock('@/lib/integrations/mercado-libre/access-token', () => ({}));
vi.mock('@/lib/integrations/mercado-libre/api', () => ({}));
vi.mock('@/lib/alerts/subscriptions', () => ({
  saveInventorySubscription: async input => {
    if (routes.failStorage) throw new Error('Private DB error');
    routes.calls.push(input);
    return { id: crypto.randomUUID(), generation: crypto.randomUUID(), status: 'pending' };
  },
  savePriceSubscription: async input => {
    if (routes.failStorage) throw new Error('Private DB error');
    routes.calls.push(input);
  },
}));
vi.mock('@/lib/integrations/mercado-libre/catalog', () => ({ findCatalogVehicle: async () => routes.vehicle }));

const slug = 'toyota-sw4-mla123';
const request = { email: ' Test@Example.invalid ', vehicleSlug: slug };
const post = (body, headers = {}) =>
  new Request('https://example.test/api/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  Object.assign(routes, {
    calls: [],
    configured: true,
    failStorage: false,
    deferred: [],
    vehicle: { slug, price: 49900, currency: 'USD', status: 'active' },
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  assert.equal(routes.deferred.length, 0, 'Demo mode queues no confirmation email');
});

it('loads only the dependencies replaced here, the request guard and the environment', () => {
  const dependencies = [
    'server-only',
    'next/server',
    '@/lib/database',
    '@/lib/alerts/config',
    '@/lib/alerts/price-delivery',
    '@/lib/alerts/signup-limit',
    '@/lib/alerts/confirmation',
    '@/lib/integrations/mercado-libre/access-token',
    '@/lib/integrations/mercado-libre/api',
    '@/lib/alerts/subscriptions',
    '@/lib/integrations/mercado-libre/catalog',
    '@/lib/alerts/request-guard',
    '@/lib/env',
  ];
  for (const file of [
    'lib/alerts/request-guard.ts',
    'app/api/inventory-alerts/route.ts',
    'app/api/price-alerts/route.ts',
  ]) {
    for (const id of runtimeImports(file)) assert.ok(dependencies.includes(id), `Unexpected dependency: ${id}`);
  }
});

describe.each([
  { name: 'inventory', handler: inventory },
  { name: 'price', handler: price },
])('$name alert signup', ({ handler }) => {
  it('accepts same-origin JSON only', async () => {
    // A cross-site HTML form can only send simple content types, never application/json.
    const form = new Request('https://example.test/api/alerts', { method: 'POST', body: JSON.stringify(request) });
    assert.equal(form.headers.get('content-type'), 'text/plain;charset=UTF-8');
    assert.equal((await handler(form)).status, 415);
    assert.equal((await handler(post(request, { 'Content-Type': 'application/x-www-form-urlencoded' }))).status, 415);
    assert.equal((await handler(post(request, { Origin: 'https://attacker.test' }))).status, 403);
    assert.equal((await handler(post(request, { Origin: 'null' }))).status, 403);
    assert.equal((await handler(post(request, { Origin: 'https://attacker.test', Host: 'example.test' }))).status, 403);
    assert.equal((await handler(post(request, { 'Sec-Fetch-Site': 'cross-site' }))).status, 403);
    assert.equal(routes.calls.length, 0, 'Rejected cross-site requests must not touch storage');
    assert.equal((await handler(post(request, { 'Content-Type': 'Application/JSON; charset=utf-8' }))).status, 201);
    assert.equal(
      (await handler(post(request, { Origin: 'https://example.test', 'Sec-Fetch-Site': 'same-origin' }))).status,
      201,
    );
    // Behind Vercel and other proxies the public host arrives in Host / X-Forwarded-Host, not request.url.
    assert.equal(
      (
        await handler(
          post(request, { Origin: 'https://preview-abc.vercel.app', 'X-Forwarded-Host': 'preview-abc.vercel.app' }),
        )
      ).status,
      201,
    );
    assert.equal(
      (await handler(post(request, { Origin: 'http://localhost:3100', Host: 'localhost:3100' }))).status,
      201,
    );
    assert.equal(routes.calls.length, 4);
  });

  it('rejects invalid bodies and emails before storage', async () => {
    for (const body of [null, [], 'bad', { email: 'invalid' }]) assert.equal((await handler(post(body))).status, 400);
    const invalidEmail = await handler(post({ ...request, email: 'cliente@gmail' }));
    assert.equal(invalidEmail.status, 400);
    assert.equal((await invalidEmail.json()).field, 'email', 'The form highlights the email only when the API says so');
    const started = performance.now();
    assert.equal((await handler(post({ ...request, email: `a@${'.'.repeat(1_000_000)}@` }))).status, 400);
    assert.ok(performance.now() - started < 1000, 'Oversized emails must be rejected before the regex runs');
  });

  it('accepts a honeypot submission without storing it', async () => {
    assert.equal((await handler(post({ website: 'bot' }))).status, 201);
    assert.equal(routes.calls.length, 0, 'Honeypot must not touch storage');
  });

  it('is unavailable without a database', async () => {
    routes.configured = false;
    assert.equal((await handler(post(request))).status, 503);
  });

  it('hides storage failures', async () => {
    routes.failStorage = true;
    const response = await handler(post(request));
    assert.equal(response.status, 500);
    assert.equal(JSON.stringify(await response.json()).includes('Private DB error'), false);
  });
});

describe('inventory alert criteria', () => {
  it('validates the criteria without blaming the email', async () => {
    const invalidCriteria = await inventory(post({ ...request, minPrice: 20, maxPrice: 10 }));
    assert.equal(invalidCriteria.status, 400);
    assert.equal((await invalidCriteria.json()).field, undefined, 'Criteria errors are not about the email');
    assert.equal((await inventory(post({ ...request, maxMileage: -1 }))).status, 400);
    assert.equal((await inventory(post({ ...request, transmission: 'invalid' }))).status, 400);
  });

  it('stores the normalized email and the criteria', async () => {
    assert.equal((await inventory(post({ ...request, minPrice: 0, maxPrice: 100000, make: 'Toyota' }))).status, 201);
    assert.equal(routes.calls.at(-1).email, 'test@example.invalid');
    assert.equal(routes.calls.at(-1).maxPrice, 100000);
  });
});

describe('price alert vehicle', () => {
  it('takes the price from the live catalog, never from the client', async () => {
    assert.equal((await price(post({ ...request, price: 1, currency: 'ARS' }))).status, 201);
    assert.equal(routes.calls.at(-1).price, 49900, 'Client cannot override the catalog price');
    assert.equal(routes.calls.at(-1).currency, 'USD');
  });

  it('rejects a missing or unavailable vehicle without blaming the email', async () => {
    routes.vehicle = null;
    assert.equal((await price(post(request))).status, 400);
    routes.vehicle = { ...request, slug, status: 'paused' };
    const unavailable = await price(post(request));
    assert.equal(unavailable.status, 400);
    assert.equal((await unavailable.json()).field, undefined, 'An unavailable vehicle is not an email error');
  });
});
