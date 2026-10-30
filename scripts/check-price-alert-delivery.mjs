import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const require = createRequire(import.meta.url);
process.env.PRICE_ALERT_DELIVERY_ENABLED = 'true';
process.env.ALERTS_SIGNING_SECRET = 'test-secret-never-used-outside-tests-123456';
process.env.ALERTS_PUBLIC_URL = 'https://example.test';
process.env.ALERTS_EMAIL_FROM = 'Gonba <test@example.test>';
process.env.RESEND_API_KEY = 'test';
process.env.DATABASE_URL = 'test';
process.env.MERCADO_LIBRE_SELLER_ID = '123';
process.env.MERCADO_LIBRE_CLIENT_ID = '456';
process.env.CRON_SECRET = 'test-cron-secret-never-used-outside-tests';
const db = new PGlite();
for (let i = 0; i < 2; i++) for (const file of ['20261028_alert_subscriptions.sql','20261029_price_alert_delivery.sql']) {
  await db.exec(readFileSync(`database/migrations/${file}`, 'utf8'));
}
let failCommit = false;
function sql(strings, ...values) {
  const text = strings.reduce((result, part, i) => result + part + (i < values.length ? `$${i + 1}` : ''), '');
  return { text, values, then(onFulfilled, onRejected) { return db.query(text, values).then(r => r.rows).then(onFulfilled, onRejected); } };
}
sql.transaction = async queries => {
  if (failCommit) throw Error('Simulated DB failure after provider acceptance');
  return db.transaction(async tx => {
    const results = [];
    for (const query of queries) results.push((await tx.query(query.text, query.values)).rows);
    return results;
  });
};
let vehicle = { mercadoLibreId: 'MLA123', slug: 'toyota-corolla-mla123', make: 'Toyota', model: 'Corolla', year: 2021,
  version: 'XEi', price: 20000, currency: 'USD', status: 'active' };
const providerCalls = [], accepted = new Map();
let providerFail = false, queued = [], deferred = [], enqueueFail = false;
const overrides = {
  '@/lib/alerts/database': { getAlertsSql: () => sql, isAlertsDatabaseConfigured: () => true },
  './database': { getAlertsSql: () => sql },
  '@/lib/integrations/mercado-libre/access-token': { catalogAccessToken: async () => 'fake' },
  '@/lib/integrations/mercado-libre/oauth': { readMercadoLibrePublication: async () => ({ vehicle, source: { id: 'MLA123', seller_id: 123 } }) },
  'next/server': { NextResponse: { json: (value, options) => Response.json(value, options) }, after: fn => deferred.push(fn) },
};
const cache = new Map();
function load(file) {
  const path = resolve(file);
  if (cache.has(path)) return cache.get(path);
  const result = {};
  cache.set(path, result);
  const source = readFileSync(path, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('exports', 'require', compiled)(result, id => {
    if (id === 'server-only') return {};
    if (id in overrides) return overrides[id];
    if (id.startsWith('node:')) return require(id);
    if (id.startsWith('@/')) return load(id.slice(2) + '.ts');
    if (id.startsWith('.')) return load(resolve(dirname(path), id) + '.ts');
    throw Error('Unexpected import ' + id);
  });
  return result;
}
const email = load('lib/alerts/email.ts');
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://api.resend.com/emails');
  const key = options.headers['Idempotency-Key'];
  providerCalls.push({ key, body: options.body });
  if (providerFail) throw Error('Network ambiguity');
  if (!accepted.has(key)) accepted.set(key, { id: `mail-${accepted.size + 1}`, body: options.body });
  else assert.equal(options.body, accepted.get(key).body, 'Retries must use identical bytes');
  return Response.json({ id: accepted.get(key).id });
};
const engine = load('lib/alerts/price-delivery.ts');
const cancel = load('lib/alerts/cancellation.ts');
try {
  await engine.activatePriceAlert('person@example.invalid', vehicle);
  await engine.activatePriceAlert('person@example.invalid', { ...vehicle, slug: 'new-title-mla123', price: 19900 });
  let alerts = (await db.query('SELECT * FROM vehicle_price_alerts')).rows;
  assert.equal(alerts.length, 1);
  assert.equal(Number(alerts[0].current_price), 20000);
  assert.equal(alerts[0].vehicle_slug, 'new-title-mla123');
  assert.equal((await db.query('SELECT * FROM price_alert_deliveries')).rows.length, 1);
  await Promise.all([engine.processPriceDelivery(), engine.processPriceDelivery()]);
  assert.equal(accepted.size, 1, 'One welcome, including concurrent workers');
  const id = alerts[0].id, generation = alerts[0].generation;
  const token = cancel.cancellationToken(id, generation);
  assert.deepEqual(cancel.parseCancellationToken(token), { id, generation });
  assert.equal(cancel.parseCancellationToken(token.slice(0,-1) + '!'), null);
  vehicle = { ...vehicle, price: 19000 };
  await Promise.all([engine.recordPriceObservation('MLA123', vehicle), engine.recordPriceObservation('MLA123', vehicle)]);
  assert.equal((await db.query("SELECT * FROM price_alert_deliveries WHERE kind='drop'")).rows.length, 1);
  await engine.processPriceDelivery();
  assert.equal(accepted.size, 2);
  assert.equal(Number((await db.query('SELECT last_notified_price FROM vehicle_price_alerts')).rows[0].last_notified_price), 19000);
  vehicle = { ...vehicle, price: 18500 };
  await engine.recordPriceObservation('MLA123', vehicle);
  providerFail = true;
  await engine.processPriceDelivery();
  assert.equal(Number((await db.query('SELECT last_notified_price FROM vehicle_price_alerts')).rows[0].last_notified_price), 19000, 'Failed send does not advance baseline');
  providerFail = false;
  await db.exec("UPDATE price_alert_deliveries SET next_attempt_at=now() WHERE state='pending'");
  await engine.processPriceDelivery();
  assert.equal(accepted.size, 3);
  vehicle = { ...vehicle, price: 19500 };
  await engine.recordPriceObservation('MLA123', vehicle);
  vehicle = { ...vehicle, price: 19000 };
  await engine.recordPriceObservation('MLA123', vehicle);
  assert.equal(await engine.processPriceDelivery(), false, 'No repeat on price rebound');
  await engine.recordPriceObservation('MLA123', { ...vehicle, currency: 'ARS', price: 18000 });
  assert.equal(await engine.processPriceDelivery(), false, 'Currency change is not a nominal price drop');
  vehicle = { ...vehicle, price: 18000 };
  await engine.recordPriceObservation('MLA123', vehicle);
  failCommit = true;
  await engine.processPriceDelivery();
  failCommit = false;
  const attempts = providerCalls.length;
  await db.exec("UPDATE price_alert_deliveries SET lease_until=now()-interval '1 second' WHERE state='sending'");
  await engine.processPriceDelivery();
  assert.equal(providerCalls.length, attempts + 1);
  assert.equal(accepted.size, 4, 'Provider idempotency after acceptance then DB failure');
  assert.equal(Number((await db.query('SELECT last_notified_price FROM vehicle_price_alerts')).rows[0].last_notified_price), 18000);
  vehicle = { ...vehicle, price: 17000 };
  await engine.recordPriceObservation('MLA123', vehicle);
  providerFail = true;
  await engine.processPriceDelivery();
  providerFail = false;
  await db.exec("UPDATE price_alert_deliveries SET first_attempt_at=now()-interval '24 hours',next_attempt_at=now() WHERE state='pending'");
  const sendsBefore = providerCalls.length;
  assert.equal(await engine.processPriceDelivery(), false);
  assert.equal(providerCalls.length, sendsBefore, 'No ambiguous send after provider window expires');
  assert.equal((await db.query("SELECT state FROM price_alert_deliveries WHERE price=17000")).rows[0].state, 'blocked');

  const cancelRoute = load('app/api/price-alerts/cancel/route.ts');
  const cancelUrl = 'https://example.test/api/price-alerts/cancel?token=' + token;
  assert.equal((await cancelRoute.GET(new Request(cancelUrl))).status, 200);
  assert.equal((await db.query('SELECT status FROM vehicle_price_alerts')).rows[0].status, 'active', 'GET scanners cannot unsubscribe');
  assert.equal((await cancelRoute.POST(new Request(cancelUrl, { method: 'POST' }))).status, 200);
  assert.equal((await db.query('SELECT status FROM vehicle_price_alerts')).rows[0].status, 'cancelled');
  await engine.activatePriceAlert('person@example.invalid', vehicle);
  assert.notEqual((await db.query('SELECT generation FROM vehicle_price_alerts')).rows[0].generation, generation);
  await cancelRoute.POST(new Request(cancelUrl, { method: 'POST' }));
  assert.equal((await db.query('SELECT status FROM vehicle_price_alerts')).rows[0].status, 'active', 'Old link cannot cancel new subscription');

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
  const limiter = load('lib/alerts/signup-limit.ts');
  for (let i = 0; i < 5; i++) assert.equal(await limiter.reservePriceSignup('limited@example.invalid'), true);
  assert.equal(await limiter.reservePriceSignup('limited@example.invalid'), false);
  assert.equal(cancel.parseCancellationToken(token + '.'), null);
  overrides['@/lib/integrations/mercado-libre/catalog'] = { findCatalogVehicle: async () => { throw Error('Must not use demo catalog'); } };
  const priceRoute = load('app/api/price-alerts/route.ts');
  const priceResponse = await priceRoute.POST(new Request('https://example.test/api/price-alerts', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'route@example.invalid', vehicleSlug: vehicle.slug, price: 1, currency: 'ARS' }) }));
  assert.equal(priceResponse.status, 201);
  const subscribed = (await db.query("SELECT * FROM vehicle_price_alerts WHERE email='route@example.invalid'")).rows[0];
  assert.equal(Number(subscribed.current_price), vehicle.price);
  assert.equal(subscribed.publication_id, 'MLA123');
  deferred = [];
  overrides['@/lib/alerts/price-delivery'] = { enqueuePriceItem: async id => { if (enqueueFail) throw Error(); queued.push(id); }, runPriceAlertWorkSafely: async () => {} };
  const webhook = load('app/api/mercado-libre/webhook/route.ts');
  const post = body => new Request('https://example.test/api/mercado-libre/webhook', { method: 'POST', body: JSON.stringify(body) });
  const notification = { topic: 'items', resource: '/items/MLA123', user_id: 123, application_id: 456 };
  assert.equal((await webhook.POST(post(null))).status, 400);
  assert.equal((await webhook.POST(post({ ...notification, user_id: 999 }))).status, 200);
  assert.equal(queued.length, 0);
  assert.equal((await webhook.POST(post(notification))).status, 200);
  assert.deepEqual(queued, ['MLA123']);
  assert.equal(deferred.length, 1);
  enqueueFail = true;
  assert.equal((await webhook.POST(post(notification))).status, 503, 'Failed persistence must request provider retry');
  const cron = load('app/api/alerts/daily/route.ts');
  assert.equal((await cron.GET(new Request('https://example.test/api/alerts/daily'))).status, 401);
  assert.equal((await cancelRoute.POST(new Request('https://example.test/api/price-alerts/cancel?token=bad', { method: 'POST' }))).status, 400);
  const malicious = email.buildAlertEmail({ id, generation, email: 'person@example.invalid', kind: 'drop', title: '<script>bad</script>', vehicle_slug: 'a', price: 100, previous_price: 200, currency: 'USD' });
  assert.equal(malicious.html.includes('<script>'), false);
  assert.ok(malicious.text.includes('Cancelar alerta'));
  console.log('Price alert delivery: real PostgreSQL migration, stable publication IDs, recurring drops, concurrent deduplication, frozen idempotent retries, ambiguous send recovery, cancellation generations, webhook persistence and cron auth passed.');
} finally { globalThis.fetch = realFetch; await db.close(); }
