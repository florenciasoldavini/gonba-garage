import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import * as email from '@/lib/alerts/email';
import * as engine from '@/lib/alerts/price-delivery';
import * as cancel from '@/lib/alerts/cancellation';
import * as confirmation from '@/lib/alerts/confirmation';
import * as limiter from '@/lib/alerts/signup-limit';
import * as cancelRoute from '@/app/api/price-alerts/cancel/route';
import * as priceRoute from '@/app/api/price-alerts/route';
import * as inventoryRoute from '@/app/api/inventory-alerts/route';
import * as confirmRoute from '@/app/api/alerts/confirm/route';
import * as cron from '@/app/api/alerts/daily/route';
import { applyMigrationsTwice, createDatabase, createSql, readMigration } from '../helpers/postgres.mjs';

// Price-alert delivery against real PostgreSQL (PGlite) and the real engine, routes and emails.
// Mercado Libre and Resend are fakes.
const state = vi.hoisted(() => ({ db: null, sql: null, deferred: [] }));
const listings = vi.hoisted(() => ({
  legacyVehicle: { mercadoLibreId: 'MLA777', slug: 'ford-ka-mla777', make: 'Ford', model: 'Ka', year: 2019, price: 10000, currency: 'USD', status: 'active' },
  vehicle: { mercadoLibreId: 'MLA123', slug: 'toyota-corolla-mla123', make: 'Toyota', model: 'Corolla', year: 2021,
    version: 'XEi', price: 20000, currency: 'USD', status: 'active' },
}));
vi.mock('next/server', async importOriginal => ({ ...await importOriginal(), after: task => { state.deferred.push(task); } }));
vi.mock('@/lib/alerts/database', () => ({ getAlertsSql: () => state.sql, isAlertsDatabaseConfigured: () => true }));
vi.mock('@/lib/integrations/mercado-libre/access-token', () => ({ catalogAccessToken: async () => 'fake' }));
vi.mock('@/lib/integrations/mercado-libre/oauth', () => ({
  readMercadoLibrePublication: async id => ({ vehicle: id === 'MLA777' ? listings.legacyVehicle : listings.vehicle, source: { id, seller_id: 123 } }),
}));
vi.mock('@/lib/integrations/mercado-libre/catalog', () => ({
  findCatalogVehicle: async () => { throw Error('Must resolve the publication through Mercado Libre, not the synced copy'); },
}));
// Search-alert work has its own suite (inventory-alert-delivery.test.mjs).
vi.mock('@/lib/alerts/inventory-delivery', () => ({ runInventoryAlertWork: async () => {}, runInventoryAlertWorkSafely: async () => {} }));

const ALERT_MIGRATIONS = ['20261028_alert_subscriptions.sql', '20261029_price_alert_delivery.sql', '20261030_alert_signup_confirmation.sql'];
const faults = { commit: false };
state.sql = createSql(() => state.db, faults);
const db = { query: (...args) => state.db.query(...args), exec: (...args) => state.db.exec(...args) };

// Fake Resend. A repeated key must carry identical bytes and returns the first response.
const providerCalls = [], accepted = new Map();
let providerFail = false;
async function resend(url, options) {
  assert.equal(url, 'https://api.resend.com/emails');
  const key = options.headers['Idempotency-Key'];
  providerCalls.push({ key, body: options.body });
  if (providerFail) throw Error('Network ambiguity');
  if (!accepted.has(key)) accepted.set(key, { id: `mail-${accepted.size + 1}`, body: options.body });
  else assert.equal(options.body, accepted.get(key).body, 'Retries must use identical bytes');
  return Response.json({ id: accepted.get(key).id });
}
const sentTo = (address, prefix) => providerCalls.map(call => JSON.parse(call.body))
  .filter(body => body.to.includes(address) && body.subject.startsWith(prefix));

// Signup followed by the owner's confirmation, which is what activation used to do in one step.
async function activate(address, listing) {
  const alert = await engine.requestPriceAlert(address, listing);
  assert.equal(await engine.confirmPriceAlert(alert.id, alert.generation), listing.slug);
}

beforeEach(() => {
  // Alert emails are on wherever this configuration is complete (lib/alerts/config.ts).
  vi.stubEnv('ALERTS_SIGNING_SECRET', 'test-secret-never-used-outside-tests-123456');
  vi.stubEnv('ALERTS_PUBLIC_URL', 'https://example.test');
  vi.stubEnv('ALERTS_EMAIL_FROM', 'Gonba <test@example.test>');
  vi.stubEnv('RESEND_API_KEY', 'test');
  vi.stubEnv('DATABASE_URL', 'test');
  vi.stubEnv('ALERTS_TEST_RECIPIENT', undefined);
  vi.stubEnv('MERCADO_LIBRE_SELLER_ID', '123');
  vi.stubEnv('MERCADO_LIBRE_CLIENT_ID', '456');
  vi.stubEnv('CRON_SECRET', 'test-cron-secret-never-used-outside-tests');
  vi.stubGlobal('fetch', resend);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Each step continues from the alerts, deliveries and emails the previous ones left.
describe('price alert delivery', () => {
  let id, generation, token, subscribed, confirmUrl, confirmToken;
  const deliveriesFor = async alertId => (await db.query('SELECT * FROM price_alert_deliveries WHERE alert_id = $1', [alertId])).rows;
  const signupAgain = () => priceRoute.POST(new Request('https://example.test/api/price-alerts', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'route@example.invalid', vehicleSlug: listings.vehicle.slug }) }));
  const confirmRequest = (url, method = 'GET') => confirmRoute[method](new Request(url, { method }));
  // Every outcome redirects to the site's result page, privately and without the token.
  const outcome = async (url, method = 'POST') => {
    const response = await confirmRequest(url, method);
    assert.equal(response.status, 303);
    assert.match(response.headers.get('cache-control'), /no-store/);
    const location = response.headers.get('location');
    assert.ok(location.startsWith('/alertas/confirmacion?') && !location.includes('token'), location);
    return Object.fromEntries(new URL(location, 'https://example.test').searchParams);
  };
  const statusOf = async () => (await db.query('SELECT status, confirmed_at FROM vehicle_price_alerts WHERE id = $1', [subscribed.id])).rows[0];
  const base = 'https://example.test/api/alerts/confirm?token=';

  beforeAll(async () => { state.db = await createDatabase(ALERT_MIGRATIONS); });
  afterAll(() => state.db.close());

  it('keeps one alert per address and publication, with stable publication IDs', async () => {
    await activate('person@example.invalid', listings.vehicle);
    await activate('person@example.invalid', { ...listings.vehicle, slug: 'new-title-mla123', price: 19900 });
    const alerts = (await db.query('SELECT * FROM vehicle_price_alerts')).rows;
    assert.equal(alerts.length, 1);
    assert.equal(Number(alerts[0].current_price), 20000);
    assert.equal(alerts[0].vehicle_slug, 'new-title-mla123');
    assert.equal((await db.query('SELECT * FROM price_alert_deliveries')).rows.length, 1);
    ({ id, generation } = alerts[0]);
  });

  it('sends one welcome, including with concurrent workers', async () => {
    await Promise.all([engine.processPriceDelivery(), engine.processPriceDelivery()]);
    assert.equal(accepted.size, 1, 'One welcome, including concurrent workers');
  });

  it('signs the cancellation link', () => {
    token = cancel.cancellationToken(id, generation);
    assert.deepEqual(cancel.parseCancellationToken(token), { id, generation });
    assert.equal(cancel.parseCancellationToken(token.slice(0, -1) + '!'), null);
    assert.equal(cancel.parseCancellationToken(token + '.'), null);
  });

  it('notifies a price drop once, even when observed concurrently', async () => {
    listings.vehicle = { ...listings.vehicle, price: 19000 };
    await Promise.all([engine.recordPriceObservation('MLA123', listings.vehicle), engine.recordPriceObservation('MLA123', listings.vehicle)]);
    assert.equal((await db.query("SELECT * FROM price_alert_deliveries WHERE kind='drop'")).rows.length, 1);
    await engine.processPriceDelivery();
    assert.equal(accepted.size, 2);
    assert.equal(Number((await db.query('SELECT last_notified_price FROM vehicle_price_alerts')).rows[0].last_notified_price), 19000);
  });

  it('keeps the baseline after a failed send and retries it', async () => {
    listings.vehicle = { ...listings.vehicle, price: 18500 };
    await engine.recordPriceObservation('MLA123', listings.vehicle);
    providerFail = true;
    await engine.processPriceDelivery();
    assert.equal(Number((await db.query('SELECT last_notified_price FROM vehicle_price_alerts')).rows[0].last_notified_price), 19000, 'Failed send does not advance baseline');
    providerFail = false;
    await db.exec("UPDATE price_alert_deliveries SET next_attempt_at=now() WHERE state='pending'");
    await engine.processPriceDelivery();
    assert.equal(accepted.size, 3);
  });

  it('does not repeat on a price rebound or a currency change', async () => {
    listings.vehicle = { ...listings.vehicle, price: 19500 };
    await engine.recordPriceObservation('MLA123', listings.vehicle);
    listings.vehicle = { ...listings.vehicle, price: 19000 };
    await engine.recordPriceObservation('MLA123', listings.vehicle);
    assert.equal(await engine.processPriceDelivery(), false, 'No repeat on price rebound');
    await engine.recordPriceObservation('MLA123', { ...listings.vehicle, currency: 'ARS', price: 18000 });
    assert.equal(await engine.processPriceDelivery(), false, 'Currency change is not a nominal price drop');
  });

  it('relies on provider idempotency after acceptance then a database failure', async () => {
    listings.vehicle = { ...listings.vehicle, price: 18000 };
    await engine.recordPriceObservation('MLA123', listings.vehicle);
    faults.commit = true;
    await engine.processPriceDelivery();
    faults.commit = false;
    const attempts = providerCalls.length;
    await db.exec("UPDATE price_alert_deliveries SET lease_until=now()-interval '1 second' WHERE state='sending'");
    await engine.processPriceDelivery();
    assert.equal(providerCalls.length, attempts + 1);
    assert.equal(accepted.size, 4, 'Provider idempotency after acceptance then DB failure');
    assert.equal(Number((await db.query('SELECT last_notified_price FROM vehicle_price_alerts')).rows[0].last_notified_price), 18000);
  });

  it('never resends an ambiguous email after the provider window expires', async () => {
    listings.vehicle = { ...listings.vehicle, price: 17000 };
    await engine.recordPriceObservation('MLA123', listings.vehicle);
    providerFail = true;
    await engine.processPriceDelivery();
    providerFail = false;
    await db.exec("UPDATE price_alert_deliveries SET first_attempt_at=now()-interval '24 hours',next_attempt_at=now() WHERE state='pending'");
    const sendsBefore = providerCalls.length;
    assert.equal(await engine.processPriceDelivery(), false);
    assert.equal(providerCalls.length, sendsBefore, 'No ambiguous send after provider window expires');
    assert.equal((await db.query('SELECT state FROM price_alert_deliveries WHERE price=17000')).rows[0].state, 'blocked');
  });

  it('cancels only by POST, and an old link cannot cancel a new subscription', async () => {
    const cancelUrl = 'https://example.test/api/price-alerts/cancel?token=' + token;
    assert.equal((await cancelRoute.GET(new Request(cancelUrl))).status, 200);
    assert.equal((await db.query('SELECT status FROM vehicle_price_alerts')).rows[0].status, 'active', 'GET scanners cannot unsubscribe');
    assert.equal((await cancelRoute.POST(new Request(cancelUrl, { method: 'POST' }))).status, 200);
    assert.equal((await db.query('SELECT status FROM vehicle_price_alerts')).rows[0].status, 'cancelled');
    await activate('person@example.invalid', listings.vehicle);
    assert.notEqual((await db.query('SELECT generation FROM vehicle_price_alerts')).rows[0].generation, generation);
    await cancelRoute.POST(new Request(cancelUrl, { method: 'POST' }));
    assert.equal((await db.query('SELECT status FROM vehicle_price_alerts')).rows[0].status, 'active', 'Old link cannot cancel new subscription');
    assert.equal((await cancelRoute.POST(new Request('https://example.test/api/price-alerts/cancel?token=bad', { method: 'POST' }))).status, 400);
  });

  it('watches subscribed publications only and drains the daily review without duplicates', async () => {
    await engine.enqueuePriceItem('MLA999');
    assert.equal((await db.query('SELECT * FROM price_alert_item_jobs')).rows.length, 0, 'Ignore unsubscribed IDs');
    await engine.enqueueDailyPriceReview();
    await engine.enqueueDailyPriceReview();
    const jobs = (await db.query('SELECT * FROM price_alert_item_jobs')).rows;
    assert.equal(jobs.length, 1);
    assert.equal(Number(jobs[0].revision), 2);
    await engine.runPriceAlertWork();
    const finished = (await db.query('SELECT * FROM price_alert_item_jobs')).rows[0];
    assert.equal(Number(finished.revision), Number(finished.processed_revision), 'Daily review drains durable item jobs');
    const acceptedAfterDaily = accepted.size;
    await engine.enqueueDailyPriceReview();
    await engine.runPriceAlertWork();
    assert.equal(accepted.size, acceptedAfterDaily, 'Repeated daily review sends no duplicates');
  });

  it('limits signups per email with delivery enabled, per endpoint', async () => {
    const from = ip => new Request('https://example.test/api/price-alerts', { method: 'POST', headers: { 'X-Forwarded-For': ip } });
    for (let i = 0; i < 5; i++) assert.equal(await limiter.reserveAlertSignup('price', 'limited@example.invalid', from(`192.0.2.${i}`)), true);
    assert.equal(await limiter.reserveAlertSignup('price', 'limited@example.invalid', from('192.0.2.99')), false, 'Per-email limit with delivery enabled');
    assert.equal(await limiter.reserveAlertSignup('inventory', 'limited@example.invalid', from('192.0.2.99')), true, 'Inventory has its own buckets');
    await db.exec('DELETE FROM price_alert_signup_windows');
  });

  it('subscribes at the price read from Mercado Libre, not the synced copy or the client', async () => {
    const priceResponse = await priceRoute.POST(new Request('https://example.test/api/price-alerts', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'route@example.invalid', vehicleSlug: listings.vehicle.slug, price: 1, currency: 'ARS' }) }));
    assert.equal(priceResponse.status, 201);
    subscribed = (await db.query("SELECT * FROM vehicle_price_alerts WHERE email='route@example.invalid'")).rows[0];
    assert.equal(Number(subscribed.current_price), listings.vehicle.price);
    assert.equal(subscribed.publication_id, 'MLA123');
  });

  // Double opt-in: a signup is pending, gets one capped confirmation email and nothing else.
  it('keeps a signup pending with one confirmation email per cooldown', async () => {
    assert.equal(subscribed.status, 'pending');
    assert.equal((await deliveriesFor(subscribed.id)).length, 0, 'No welcome email before confirmation');
    assert.equal(state.deferred.length, 1, 'The confirmation email is sent after the response');
    for (const task of state.deferred.splice(0)) await task();
    assert.equal(sentTo('route@example.invalid', 'Confirmá').length, 1);
    const [confirmationEmail] = sentTo('route@example.invalid', 'Confirmá');
    assert.ok(confirmationEmail.text.includes('Toyota Corolla XEi 2021'));
    confirmUrl = confirmationEmail.text.match(/https:\/\/example\.test\/api\/alerts\/confirm\?token=\S+/)[0];
    assert.equal((await signupAgain()).status, 201);
    for (const task of state.deferred.splice(0)) await task();
    assert.equal(sentTo('route@example.invalid', 'Confirmá').length, 1, 'Resubmitting within 10 minutes sends no second email');
    await db.exec("UPDATE price_alert_signup_windows SET started_at = now() - interval '11 minutes' WHERE key LIKE 'confirm:price:%'");
    assert.equal((await signupAgain()).status, 201);
    for (const task of state.deferred.splice(0)) await task();
    assert.equal(sentTo('route@example.invalid', 'Confirmá').length, 2, 'A pending signup can be resent after the cooldown');
    assert.equal((await db.query("SELECT generation FROM vehicle_price_alerts WHERE email='route@example.invalid'")).rows[0].generation, subscribed.generation,
      'Resending keeps earlier links valid');
  });

  it('sends at most five confirmation emails per recipient per day, across both endpoints', async () => {
    for (let i = 0; i < 6; i++) {
      const sent = await confirmation.sendSignupConfirmation({ scope: i % 2 ? 'inventory' : 'price', id: randomUUID(), generation: randomUUID(), email: 'capped@example.invalid' });
      assert.equal(sent, i < 5, 'At most 5 confirmation emails per recipient per day, across both endpoints');
    }
    assert.equal(sentTo('capped@example.invalid', 'Confirmá').length, 5);
  });

  it('never gives pending subscriptions price work or emails', async () => {
    await engine.requestPriceAlert('only-pending@example.invalid', { ...listings.vehicle, mercadoLibreId: 'MLA555', slug: 'only-pending-mla555' });
    await engine.enqueuePriceItem('MLA555');
    await engine.enqueueDailyPriceReview();
    assert.equal((await db.query("SELECT * FROM price_alert_item_jobs WHERE publication_id='MLA555'")).rows.length, 0, 'Pending-only publications are not watched');
    await engine.recordPriceObservation('MLA123', { ...listings.vehicle, price: listings.vehicle.price - 1000 });
    assert.equal((await deliveriesFor(subscribed.id)).length, 0, 'Pending alerts never receive price drops');
    while (await engine.processPriceDelivery());
    assert.equal(sentTo('route@example.invalid', 'Bajó').length, 0);
  });

  it('serves a confirmation page that GET scanners cannot confirm', async () => {
    confirmToken = new URL(confirmUrl).searchParams.get('token');
    assert.deepEqual(confirmation.parseConfirmationToken(confirmToken), { scope: 'price', id: subscribed.id, generation: subscribed.generation, expired: false });
    const page = await confirmRequest(confirmUrl);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('cache-control'), /no-store/);
    assert.match(page.headers.get('x-robots-tag'), /noindex/);
    assert.match(page.headers.get('content-security-policy'), /default-src 'none'/);
    assert.equal((await statusOf()).status, 'pending', 'GET scanners cannot confirm');
    // Browsers post the form on load; only that exact inline script is allowed by the CSP.
    const html = await page.text();
    assert.match(html, /<form method="post">/);
    const script = html.match(/<script>(.*?)<\/script>/)[1];
    assert.equal(script, 'document.forms[0].submit()');
    const scriptHash = createHash('sha256').update(script).digest('base64');
    assert.ok(page.headers.get('content-security-policy').includes(`script-src 'sha256-${scriptHash}'`));
    assert.doesNotMatch(page.headers.get('content-security-policy'), /unsafe-inline'[^;]*script|script-src[^;]*unsafe/);
  });

  it('rejects expired, forged and cross-scope tokens', async () => {
    const expiredToken = confirmation.confirmationToken('price', subscribed.id, subscribed.generation, Date.now() - 73 * 3600 * 1000);
    assert.equal(confirmation.parseConfirmationToken(expiredToken).expired, true);
    assert.deepEqual(await outcome(base + expiredToken), { estado: 'vencido' }, 'Expired links cannot confirm');
    assert.deepEqual(await outcome(base + expiredToken, 'GET'), { estado: 'vencido' });
    const signature = confirmToken.slice(confirmToken.lastIndexOf('.') + 1);
    for (const forged of [
      cancel.cancellationToken(subscribed.id, subscribed.generation), // cancel scope
      confirmToken.replace(/^price\./, 'inventory.'), // other alert type
      confirmToken.slice(0, -1) + (signature.endsWith('A') ? 'B' : 'A'), // tampered signature
      confirmToken.replace(subscribed.generation, randomUUID()), // other generation
      confirmToken.replace(/\.(\d{10})\./, (_, expires) => `.${Number(expires) + 3600}.`), // extended expiry
      '', 'bad',
    ]) {
      assert.equal(confirmation.parseConfirmationToken(forged), null);
      assert.deepEqual(await outcome(base + forged), { estado: 'no-valido' });
      assert.deepEqual(await outcome(base + forged, 'GET'), { estado: 'no-valido' });
    }
    assert.equal((await cancelRoute.POST(new Request(`https://example.test/api/price-alerts/cancel?token=${confirmToken}`, { method: 'POST' }))).status, 400,
      'A confirmation token cannot cancel');
    assert.equal((await statusOf()).status, 'pending');
  });

  it('confirms idempotently with exactly one welcome', async () => {
    state.deferred.length = 0;
    const [confirmed, again] = await Promise.all([outcome(confirmUrl), outcome(confirmUrl)]);
    const confirmedPrice = { estado: 'confirmada', tipo: 'precio', vehiculo: listings.vehicle.slug };
    assert.deepEqual(confirmed, confirmedPrice);
    assert.deepEqual(again, confirmedPrice, 'Confirmation is idempotent');
    assert.equal((await statusOf()).status, 'active');
    assert.ok((await statusOf()).confirmed_at);
    assert.deepEqual(await outcome(confirmUrl), confirmedPrice);
    assert.deepEqual((await deliveriesFor(subscribed.id)).map(row => row.kind), ['welcome'], 'Exactly one welcome after repeated confirmation');
    assert.ok(state.deferred.length >= 1, 'Confirmation starts delivery work');
    state.deferred.length = 0;
    while (await engine.processPriceDelivery());
    assert.equal(sentTo('route@example.invalid', 'Tu alerta de precio está activa').length, 1);
    assert.equal((await signupAgain()).status, 201);
    assert.equal(state.deferred.length, 0, 'An active alert sends no new confirmation');
  });

  // Inventory alerts use the same route, with their own scope.
  it('confirms inventory alerts through the same route, with their own scope', async () => {
    const inventoryResponse = await inventoryRoute.POST(new Request('https://example.test/api/inventory-alerts', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'search@example.invalid', query: 'Llamá al 0800 PREMIO <b>ya</b>', maxPrice: 30000 }) }));
    assert.equal(inventoryResponse.status, 201);
    const search = (await db.query("SELECT * FROM vehicle_inventory_alerts WHERE email='search@example.invalid'")).rows[0];
    assert.equal(search.status, 'pending');
    for (const task of state.deferred.splice(0)) await task();
    const [searchEmail] = sentTo('search@example.invalid', 'Confirmá tu alerta de búsqueda');
    assert.ok(searchEmail, 'Inventory signups get a confirmation email');
    assert.equal(`${searchEmail.text}${searchEmail.html}`.includes('PREMIO'), false, 'Submitted search text is never echoed to the recipient');
    const searchUrl = searchEmail.text.match(/https:\/\/example\.test\/api\/alerts\/confirm\?token=\S+/)[0];
    const crossScope = confirmation.confirmationToken('price', search.id, search.generation);
    assert.deepEqual(await outcome(base + crossScope), { estado: 'no-valido' }, 'A price-scoped token cannot confirm an inventory alert');
    assert.deepEqual(await outcome(searchUrl), { estado: 'confirmada', tipo: 'busqueda' });
    assert.equal((await db.query("SELECT status FROM vehicle_inventory_alerts WHERE email='search@example.invalid'")).rows[0].status, 'active');
    assert.deepEqual(await outcome(searchUrl), { estado: 'confirmada', tipo: 'busqueda' });
    await db.exec("UPDATE vehicle_inventory_alerts SET status='cancelled' WHERE email='search@example.invalid'");
    assert.deepEqual(await outcome(searchUrl), { estado: 'no-valido' }, 'A cancelled alert is not reactivated by an old link');
    state.deferred.length = 0;
  });

  it('requires the cron secret for the daily review', async () => {
    assert.equal((await cron.GET(new Request('https://example.test/api/alerts/daily'))).status, 401);
  });

  it('escapes listing data and loads no external images in emails', () => {
    const malicious = email.buildAlertEmail({ id, generation, email: 'person@example.invalid', kind: 'drop', title: '<script>bad</script>', vehicle_slug: 'a', price: 100, previous_price: 200, currency: 'USD' });
    assert.equal(malicious.html.includes('<script>'), false);
    assert.ok(malicious.text.includes('Cancelar alerta'));
    for (const message of [malicious, email.buildConfirmationEmail({ scope: 'inventory', email: 'person@example.invalid', url: 'https://example.test/x' })]) {
      const [logo] = message.attachments;
      assert.ok(message.html.includes(`src="cid:${logo.content_id}"`), 'The logo is embedded inline');
      assert.equal(/src="https?:/.test(message.html), false, 'Emails load no external images');
    }
  });
});

// Subscriptions created before double opt-in keep receiving alerts after the migration.
describe('price alerts created before double opt-in', () => {
  beforeAll(async () => {
    state.db = new PGlite();
    for (const file of ALERT_MIGRATIONS.slice(0, 2)) await state.db.exec(readMigration(file));
    await state.db.exec(`INSERT INTO vehicle_price_alerts (email, vehicle_slug, publication_id, vehicle_title, current_price, currency, source)
      VALUES ('legacy@example.invalid', 'ford-ka-mla777', 'MLA777', 'Ford Ka 2019', 10000, 'USD', 'mercado_libre')`);
    await applyMigrationsTwice(state.db, ALERT_MIGRATIONS);
  });
  afterAll(() => state.db.close());

  it('are grandfathered as confirmed and still deliver price drops', async () => {
    assert.equal((await db.query('SELECT status FROM vehicle_price_alerts')).rows[0].status, 'active', 'Existing alerts are grandfathered as confirmed');
    await engine.enqueueDailyPriceReview();
    assert.deepEqual((await db.query('SELECT publication_id FROM price_alert_item_jobs')).rows, [{ publication_id: 'MLA777' }]);
    listings.legacyVehicle = { ...listings.legacyVehicle, price: 9000 };
    await engine.recordPriceObservation('MLA777', listings.legacyVehicle);
    assert.equal(await engine.processPriceDelivery(), true);
    assert.equal(sentTo('legacy@example.invalid', 'Bajó de precio').length, 1, 'Grandfathered alerts still deliver price drops');
  });
});
