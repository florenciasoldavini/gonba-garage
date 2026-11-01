import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

// Search-alert delivery against real PostgreSQL (PGlite), the real catalog sync, matcher, outbox
// and routes. Mercado Libre, the MEP quote and Resend are fakes. Fixtures live here, not in the
// demo catalog.
const require = createRequire(import.meta.url);
const SELLER = '123';
Object.assign(process.env, {
  ALERTS_SIGNING_SECRET: 'test-secret-never-used-outside-tests-123456',
  ALERTS_PUBLIC_URL: 'https://example.test', ALERTS_EMAIL_FROM: 'Gonba <test@example.test>', RESEND_API_KEY: 'test',
  DATABASE_URL: 'test', MERCADO_LIBRE_SELLER_ID: SELLER, MERCADO_LIBRE_CLIENT_ID: '456',
  CRON_SECRET: 'test-cron-secret-never-used-outside-tests', VEHICLE_DATA_SOURCE: 'mercado-libre',
});
delete process.env.ALERTS_TEST_RECIPIENT;
delete process.env.MERCADO_LIBRE_BACKEND_URL;

const migrations = readdirSync('database/migrations').filter(file => file.endsWith('.sql')).sort()
  .map(file => readFileSync(`database/migrations/${file}`, 'utf8'));
const db = new PGlite();
for (let i = 0; i < 2; i++) for (const migration of migrations) await db.exec(migration);
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
const query = async (text, values = []) => (await db.query(text, values)).rows;

// Fake Mercado Libre, mapped by the real mapper.
const fresh = () => new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
const items = new Map();
const item = (id, { make = 'Toyota', model = 'Corolla', version = 'XEi', year = 2021, km = 45000, transmission = 'Automática',
  fuel = 'Nafta', body = 'Sedán', ...changes } = {}) => ({
  id, seller_id: Number(SELLER), title: `${make} ${model} ${version}`, price: 20000, currency_id: 'USD', status: 'active',
  permalink: `https://auto.mercadolibre.com.ar/${id}`, pictures: [],
  attributes: [
    { id: 'BRAND', value_name: make }, { id: 'MODEL', value_name: model }, { id: 'TRIM', value_name: version },
    { id: 'VEHICLE_YEAR', value_name: String(year) }, { id: 'KILOMETERS', value_struct: { number: km, unit: 'km' } },
    { id: 'TRANSMISSION', value_name: transmission }, { id: 'FUEL_TYPE', value_name: fuel }, { id: 'VEHICLE_BODY_TYPE', value_name: body },
  ],
  start_time: fresh(), last_updated: new Date().toISOString(), ...changes,
});

let quote = { arsPerUsd: 1000, updatedAt: new Date().toISOString() };
let deferred = [];
const overrides = {
  'react': { cache: fn => fn },
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) }, after: fn => deferred.push(fn) },
  '@/lib/alerts/database': { getAlertsSql: () => sql, isAlertsDatabaseConfigured: () => true },
  './database': { getAlertsSql: () => sql, isAlertsDatabaseConfigured: () => true },
  '@/lib/integrations/mep-quote': { getMepQuote: async () => quote },
  // Price alerts run alongside (same configuration) and have their own suite.
  '@/lib/alerts/price-delivery': { enqueuePriceItem: async () => {}, runPriceAlertWorkSafely: async () => {},
    enqueueDailyPriceReview: async () => {}, runPriceAlertWork: async () => {} },
  './access-token': { catalogAccessToken: async () => 'access-token' },
};
const modules = new Map();
function load(file) {
  const path = resolve(file);
  if (modules.has(path)) return modules.get(path);
  const result = {};
  modules.set(path, result);
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
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
const failures = load('lib/integrations/mercado-libre/failures.ts');
const { mapMercadoLibreItemToVehicle } = load('features/vehicles/data/mercado-libre-vehicle-mapper.ts');
overrides['./oauth'] = {
  async readMercadoLibrePublication(id) {
    if (!items.has(id)) throw failures.failure('catalog_query', 'http_error', { httpStatus: 404 });
    return mapMercadoLibreItemToVehicle(items.get(id));
  },
  async readMercadoLibrePublications() {
    const active = [...items.values()].filter(({ status }) => status === 'active');
    return { seller: { id: Number(SELLER) }, publications: { items: active.map(entry => mapMercadoLibreItemToVehicle(entry)) } };
  },
};

// Fake Resend. A repeated key must carry identical bytes and returns the first response.
const providerCalls = [], accepted = new Map();
let provider = 'ok';
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://api.resend.com/emails');
  const key = options.headers['Idempotency-Key'];
  providerCalls.push({ key, body: options.body });
  if (provider === 'timeout') throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  if (provider === 'refused') throw new TypeError('fetch failed', { cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }) });
  if (provider.startsWith('http-')) return Response.json({ message: 'error' }, { status: Number(provider.slice(5)) });
  if (!accepted.has(key)) accepted.set(key, { id: `mail-${accepted.size + 1}`, body: options.body });
  else assert.equal(options.body, accepted.get(key).body, 'Retries must use identical bytes');
  return Response.json({ id: accepted.get(key).id });
};

const search = load('features/vehicles/domain/inventory-search.ts');
const subscriptions = load('lib/alerts/subscriptions.ts');
const delivery = load('lib/alerts/inventory-delivery.ts');
const cancellation = load('lib/alerts/cancellation.ts');
const confirmation = load('lib/alerts/confirmation.ts');
const email = load('lib/alerts/email.ts');
const webhook = load('app/api/mercado-libre/webhook/route.ts');
const syncRoute = load('app/api/mercado-libre/sync/route.ts');
const dailyRoute = load('app/api/alerts/daily/route.ts');
const cancelRoute = load('app/api/inventory-alerts/cancel/route.ts');
const priceCancelRoute = load('app/api/price-alerts/cancel/route.ts');
const signupRoute = load('app/api/inventory-alerts/route.ts');

const notify = async (id, changes) => {
  if (changes === null) items.delete(id); else if (changes) items.set(id, item(id, changes));
  const response = await webhook.POST(new Request('https://example.test/api/mercado-libre/webhook', {
    method: 'POST', body: JSON.stringify({ topic: 'items', resource: `/items/${id}`, user_id: 123, application_id: 456 }),
  }));
  assert.equal(response.status, 200);
  for (const task of deferred.splice(0)) await task();
};
const blank = { query: '', make: '', transmission: '', bodyType: '', fuel: '', minPrice: 0, maxPrice: 0, minMileage: 0, maxMileage: 0 };
async function subscribe(address, criteria = {}, { confirm = true } = {}) {
  const alert = await subscriptions.saveInventorySubscription({ ...blank, email: address, ...criteria });
  if (confirm) assert.equal(await subscriptions.confirmInventorySubscription(alert.id, alert.generation), true);
  return alert;
}
const sent = () => providerCalls.filter(({ key }) => accepted.has(key)).map(({ body }) => JSON.parse(body));
const inbox = address => [...accepted.values()].map(({ body }) => JSON.parse(body)).filter(body => body.to.includes(address));
const deliveriesOf = async alert => query('SELECT * FROM inventory_alert_deliveries WHERE alert_id = $1 ORDER BY created_at', [alert.id]);
// Moves an alert's recent emails out of the cooldown window.
const afterCooldown = async () => query(`UPDATE inventory_alert_deliveries SET created_at = created_at - interval '13 hours',
  accepted_at = accepted_at - interval '13 hours'`);
const work = () => delivery.runInventoryAlertWork({ budgetMs: 20_000 });
const previousError = console.error;
console.error = () => {};

try {
  // The predicate the catalog and the alerts share.
  const corolla = { make: 'Toyota', model: 'Corolla', version: 'XEi', year: 2021, transmission: 'Automática, 6 marchas',
    body: 'Sedán · 4 puertas', fuel: 'Nafta', mileageKm: 45000 };
  const criteria = { query: '', make: '', transmission: '', bodyType: '', fuel: '', minPrice: null, maxPrice: null, minMileage: null, maxMileage: null };
  const matches = (changes, usd = 20000) => search.matchesInventorySearch(corolla, { ...criteria, ...changes }, usd);
  assert.ok(matches({}), 'Empty criteria match every car');
  assert.ok(matches({ query: ' COROLLA ' }) && matches({ query: 'xei 2021' }) && matches({ query: 'toyota corolla' }));
  assert.ok(!matches({ query: 'hilux' }));
  assert.ok(matches({ make: 'Toyota' }) && !matches({ make: 'toyota' }), 'Make matches exactly, as the catalog select does');
  assert.ok(matches({ transmission: 'automatic' }) && !matches({ transmission: 'manual' }));
  assert.ok(matches({ bodyType: 'Sedán' }) && !matches({ bodyType: 'SUV' }));
  assert.ok(matches({ fuel: 'Nafta' }) && !matches({ fuel: 'Diésel' }));
  assert.ok(matches({ minMileage: 45000, maxMileage: 45000 }) && !matches({ maxMileage: 44999 }) && !matches({ minMileage: 45001 }));
  assert.ok(matches({ minPrice: 20000, maxPrice: 20000 }) && !matches({ maxPrice: 19999 }) && !matches({ minPrice: 20001 }));
  assert.ok(!matches({ maxPrice: 30000 }, null), 'An unknown comparison price never matches a price range');
  assert.ok(matches({}, null), 'Without price bounds the comparison price is irrelevant');

  // Alerts confirmed before the cars arrive. Each address has one alert.
  const everything = await subscribe('all@example.invalid');
  await subscribe('toyota@example.invalid', { make: 'Toyota', transmission: 'automatic', maxPrice: 25000 });
  // What the reserved Toyota Corolla's page saves (app/vehiculos/[slug]/page.tsx).
  const reserved = await subscribe('reserved@example.invalid', { query: 'Corolla', make: 'Toyota' });
  await subscribe('ford@example.invalid', { make: 'Ford' });
  await subscribe('pending@example.invalid', {}, { confirm: false });

  // A reserved car is synced while reserved: nothing is announced.
  await notify('MLA10', { status: 'paused', start_time: '2026-01-01T00:00:00.000Z' });
  assert.equal(sent().length, 0);

  // The reservation falls through: every matching alert gets one email, the pending one nothing.
  await notify('MLA10', { start_time: '2026-01-01T00:00:00.000Z' });
  for (const address of ['all@example.invalid', 'toyota@example.invalid', 'reserved@example.invalid']) {
    const [message] = inbox(address);
    assert.ok(message, `${address} is told the reserved car is back`);
    assert.equal(inbox(address).length, 1);
    assert.equal(message.subject, 'Volvió a estar disponible: Toyota Corolla XEi 2021');
    assert.ok(message.text.includes('https://example.test/vehiculos/toyota-corolla-xei-mla10'));
    assert.ok(message.text.includes('45.000 km · Automática · Nafta') && message.text.includes('USD 20.000'));
  }
  assert.equal(inbox('ford@example.invalid').length, 0, 'Other makes are not matched');
  assert.equal(inbox('pending@example.invalid').length, 0, 'Unconfirmed alerts never receive matches');
  assert.equal((await query("SELECT state FROM inventory_alert_events WHERE publication_id = 'MLA10'"))[0].state, 'matched');

  // Unsubscribe headers and a signed, scoped link with no email in it.
  const [toReserved] = inbox('reserved@example.invalid');
  const cancelUrl = toReserved.headers['List-Unsubscribe'].slice(1, -1);
  assert.equal(toReserved.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.ok(cancelUrl.startsWith('https://example.test/api/inventory-alerts/cancel?token=search.'));
  assert.ok(toReserved.text.includes(`Cancelar alerta: ${cancelUrl}`) && toReserved.html.includes('Cancelar alerta'));
  assert.ok(!cancelUrl.includes('reserved') && !cancelUrl.includes('%40'));

  // The same model is listed again, and a Ford arrives. The Ford alert sends right away; the
  // alerts emailed minutes ago wait for their cooldown.
  await notify('MLA11', { version: 'SEG' });
  await notify('MLA12', { make: 'Ford', model: 'Ka', version: 'SEL', transmission: 'Manual', body: 'Hatchback', price: 9000 });
  assert.equal(inbox('ford@example.invalid').length, 1);
  assert.equal(inbox('ford@example.invalid')[0].subject, 'Nuevo ingreso: Ford Ka SEL 2021');
  assert.equal(inbox('all@example.invalid').length, 1, 'At most one email per alert within the cooldown');
  assert.equal(inbox('reserved@example.invalid').length, 1);
  await afterCooldown();
  await work();
  const [, batch] = inbox('all@example.invalid');
  assert.equal(batch.subject, '2 autos para tu búsqueda', 'Matches found during the cooldown go out together');
  assert.ok(batch.text.includes('Toyota Corolla SEG 2021') && batch.text.includes('Ford Ka SEL 2021'));
  assert.equal(inbox('reserved@example.invalid')[1].subject, 'Nuevo ingreso: Toyota Corolla SEG 2021', 'The reserved-car alert also covers the same model');
  assert.equal(inbox('toyota@example.invalid')[1].subject, 'Nuevo ingreso: Toyota Corolla SEG 2021');

  // Each car is announced once per alert: reserving and releasing it again sends nothing new,
  // even with concurrent workers.
  await afterCooldown();
  const before = accepted.size;
  await notify('MLA10', { status: 'paused', start_time: '2026-01-01T00:00:00.000Z' });
  await notify('MLA10', { start_time: '2026-01-01T00:00:00.000Z' });
  await Promise.all([work(), work(), delivery.processNextEvent(), delivery.processNextDelivery()]);
  assert.equal(accepted.size, before, 'No duplicate emails');
  assert.equal(Number((await query("SELECT count(*) FROM inventory_alert_matches WHERE publication_id = 'MLA10'"))[0].count), 3);

  // Concurrent matching of one event and concurrent batching create one match and one email per alert.
  await afterCooldown();
  items.set('MLA13', item('MLA13', { model: 'Etios', version: 'XLS' }));
  await load('lib/catalog/store.ts').enqueueCatalogJobs(['MLA13']);
  await load('lib/integrations/mercado-libre/inventory-sync.ts').runCatalogSyncWork();
  await Promise.all([delivery.processNextEvent(), delivery.processNextEvent()]);
  await Promise.all([delivery.batchMatches(), delivery.batchMatches()]);
  await Promise.all([work(), work()]);
  assert.equal(inbox('all@example.invalid').filter(({ subject }) => subject.includes('Etios')).length, 1);
  assert.equal(inbox('toyota@example.invalid').filter(({ subject }) => subject.includes('Etios')).length, 1);

  // A car reserved before its email goes out is dropped and forgotten, so its return is news.
  const quiet = await subscribe('quiet@example.invalid', { make: 'Peugeot' });
  await notify('MLA14', { make: 'Peugeot', model: '208', version: 'Allure' });
  assert.equal(inbox('quiet@example.invalid').length, 1);
  await notify('MLA15', { make: 'Peugeot', model: '2008', version: 'GT' });
  await notify('MLA15', { make: 'Peugeot', model: '2008', version: 'GT', status: 'paused' });
  await afterCooldown();
  await work();
  assert.equal(inbox('quiet@example.invalid').length, 1, 'Nothing to say about a car that is no longer available');
  assert.equal((await deliveriesOf(quiet)).at(-1).failure_code, 'no_longer_available');
  await notify('MLA15', { make: 'Peugeot', model: '2008', version: 'GT' });
  assert.equal(inbox('quiet@example.invalid')[1].subject, 'Volvió a estar disponible: Peugeot 2008 GT 2021');

  // Volume: one email lists at most six cars and counts the rest.
  const crowd = await subscribe('crowd@example.invalid', { make: 'Fiat' });
  for (let i = 0; i < 8; i++) items.set(`MLA2${i}`, item(`MLA2${i}`, { make: 'Fiat', model: 'Cronos', version: `V${i}` }));
  await load('lib/catalog/store.ts').enqueueCatalogJobs([...Array(8).keys()].map(i => `MLA2${i}`));
  await syncRoute.GET(new Request('https://example.test/api/mercado-libre/sync', { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }));
  const [crowded] = inbox('crowd@example.invalid');
  assert.equal(crowded.subject, '8 autos para tu búsqueda', 'The sync cron matches and sends what it finds');
  assert.equal((crowded.html.match(/Ver vehículo<\/a><\/td>/g) || []).length, 6);
  assert.ok(crowded.text.includes('Y 2 más en el inventario.'));
  assert.equal((await deliveriesOf(crowd))[0].vehicle_count, 8);

  // ARS listings are compared in USD with the MEP quote. Without a quote the event waits.
  await subscribe('budget@example.invalid', { make: 'Renault', maxPrice: 15000 });
  quote = null;
  await notify('MLA30', { make: 'Renault', model: 'Sandero', version: 'Life', currency_id: 'ARS', price: 14_000_000 });
  const waiting = (await query("SELECT * FROM inventory_alert_events WHERE publication_id = 'MLA30'"))[0];
  assert.equal(waiting.state, 'pending');
  assert.equal(waiting.last_error, 'mep_quote_unavailable');
  assert.equal(inbox('budget@example.invalid').length, 0);
  quote = { arsPerUsd: 1000, updatedAt: new Date().toISOString() };
  await query("UPDATE inventory_alert_events SET next_attempt_at = now() WHERE publication_id = 'MLA30'");
  await work();
  assert.equal(inbox('budget@example.invalid')[0].subject, 'Nuevo ingreso: Renault Sandero Life 2021');
  assert.ok(inbox('budget@example.invalid')[0].text.includes('ARS 14.000.000'), 'The email shows the original price');
  await notify('MLA31', { make: 'Renault', model: 'Duster', version: 'Zen', currency_id: 'ARS', price: 16_000_000 });
  await afterCooldown(); await work();
  assert.equal(inbox('budget@example.invalid').length, 1, 'USD 16,000 at the MEP rate is above the limit');

  // An alert confirmed after the car became available is not told about it.
  await query("UPDATE inventory_alert_events SET created_at = now() - interval '1 hour' WHERE publication_id = 'MLA31'");
  const late = await subscribe('late@example.invalid', { make: 'Renault' }, { confirm: false });
  await query("UPDATE inventory_alert_events SET state = 'pending', next_attempt_at = now() WHERE publication_id = 'MLA31'");
  await subscriptions.confirmInventorySubscription(late.id, late.generation);
  await work();
  assert.equal(inbox('late@example.invalid').length, 0);

  // Retries. A timeout may hide an accepted send: the retry reuses the key and the bytes.
  const retry = await subscribe('retry@example.invalid', { make: 'Honda' });
  provider = 'timeout';
  await notify('MLA40', { make: 'Honda', model: 'Fit', version: 'EX' });
  let [row] = await deliveriesOf(retry);
  assert.equal(row.state, 'pending');
  assert.equal(row.uncertain, true);
  assert.equal(row.failure_code, 'provider_network');
  provider = 'ok';
  await query("UPDATE inventory_alert_deliveries SET next_attempt_at = now()");
  await work();
  const keys = providerCalls.filter(({ body }) => JSON.parse(body).to.includes('retry@example.invalid')).map(({ key }) => key);
  assert.deepEqual(keys, [`gonba-search-${row.id}-0`, `gonba-search-${row.id}-0`]);
  assert.equal(inbox('retry@example.invalid').length, 1);
  assert.equal((await deliveriesOf(retry))[0].state, 'accepted');

  // Accepted by the provider, then the database fails: the lease is kept and the same key confirms it.
  await afterCooldown();
  failCommit = true;
  await notify('MLA41', { make: 'Honda', model: 'City', version: 'LX' });
  failCommit = false;
  row = (await deliveriesOf(retry)).at(-1);
  assert.equal(row.state, 'sending');
  assert.equal(row.uncertain, true);
  await query("UPDATE inventory_alert_deliveries SET lease_until = now() - interval '1 second' WHERE state = 'sending'");
  const acceptedBefore = accepted.size;
  await work();
  assert.equal(accepted.size, acceptedBefore, 'The provider deduplicated the retry');
  assert.equal((await deliveriesOf(retry)).at(-1).state, 'accepted');
  assert.equal(inbox('retry@example.invalid').length, 2);

  // An outage longer than the idempotency window: the ambiguous email is given up, never resent,
  // and the alert keeps working for later cars.
  const outage = await subscribe('outage@example.invalid', { make: 'Volkswagen' });
  provider = 'http-503';
  await notify('MLA50', { make: 'Volkswagen', model: 'Gol', version: 'Trend' });
  assert.equal((await deliveriesOf(outage))[0].uncertain, true, 'A 5xx may hide an accepted send');
  await query(`UPDATE inventory_alert_deliveries SET series_started_at = now() - interval '24 hours', next_attempt_at = now()
    WHERE alert_id = '${outage.id}'`);
  const callsBefore = providerCalls.length;
  await work();
  assert.equal(providerCalls.length, callsBefore, 'No blind resend after the window');
  [row] = await deliveriesOf(outage);
  assert.equal(row.state, 'expired');
  assert.equal(row.failure_code, 'ambiguous_send_window_expired');
  provider = 'ok';
  await query(`UPDATE inventory_alert_deliveries SET created_at = created_at - interval '13 hours' WHERE alert_id = '${outage.id}'`);
  await notify('MLA51', { make: 'Volkswagen', model: 'Polo', version: 'Highline' });
  assert.deepEqual(inbox('outage@example.invalid').map(({ subject }) => subject), ['Nuevo ingreso: Volkswagen Polo Highline 2021'],
    'An expired email never silences the alert');

  // Definite rejections only (rate limit, refused connection): nothing can have been sent, so after
  // the window a new key series starts, with fresh content.
  const limited = await subscribe('limited@example.invalid', { make: 'Chevrolet' });
  provider = 'http-429';
  await notify('MLA60', { make: 'Chevrolet', model: 'Onix', version: 'LT' });
  provider = 'refused';
  await query("UPDATE inventory_alert_deliveries SET next_attempt_at = now()");
  await work();
  [row] = await deliveriesOf(limited);
  assert.equal(row.uncertain, false, 'A rate limit or a refused connection is a definite rejection');
  assert.equal(row.state, 'pending');
  await query(`UPDATE inventory_alert_deliveries SET series_started_at = now() - interval '24 hours', next_attempt_at = now() WHERE id = '${row.id}'`);
  provider = 'ok';
  await work();
  [row] = await deliveriesOf(limited);
  assert.equal(row.state, 'accepted');
  assert.equal(row.key_series, 1);
  assert.ok(accepted.has(`gonba-search-${row.id}-1`));
  assert.equal(inbox('limited@example.invalid').length, 1);

  // A permanent rejection fails that email only.
  const bounced = await subscribe('bounced@example.invalid', { make: 'Nissan' });
  provider = 'http-422';
  await notify('MLA70', { make: 'Nissan', model: 'March', version: 'Sense' });
  provider = 'ok';
  assert.equal((await deliveriesOf(bounced))[0].state, 'failed');
  await notify('MLA71', { make: 'Nissan', model: 'Versa', version: 'Advance' });
  assert.equal(inbox('bounced@example.invalid').length, 1, 'A failed email does not block the next one');

  // Old events are not news: enabling delivery after a while does not mail a backlog.
  await subscribe('backlog@example.invalid', { make: 'Jeep' });
  const resendKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  await notify('MLA80', { make: 'Jeep', model: 'Renegade', version: 'Sport' });
  assert.equal((await query("SELECT state FROM inventory_alert_events WHERE publication_id = 'MLA80'"))[0].state, 'pending',
    'Without the email configuration the webhook only syncs');
  await work();
  assert.equal(inbox('backlog@example.invalid').length, 0, 'The worker does nothing without it');
  process.env.RESEND_API_KEY = resendKey;
  await query("UPDATE inventory_alert_events SET created_at = now() - interval '73 hours' WHERE publication_id = 'MLA80'");
  await work();
  assert.equal((await query("SELECT state FROM inventory_alert_events WHERE publication_id = 'MLA80'"))[0].state, 'expired');
  assert.equal(inbox('backlog@example.invalid').length, 0);

  // Cancellation. Tokens are scoped: price, search and confirmation tokens never verify as one another.
  const searchToken = new URL(cancelUrl).searchParams.get('token');
  assert.deepEqual(cancellation.parseSearchCancellationToken(searchToken), { id: reserved.id, generation: reserved.generation });
  assert.equal(cancellation.parseCancellationToken(searchToken), null, 'A search token cannot cancel a price alert');
  const priceToken = cancellation.cancellationToken(reserved.id, reserved.generation);
  assert.equal(cancellation.parseSearchCancellationToken(priceToken), null, 'A price token cannot cancel a search alert');
  assert.equal(cancellation.parseSearchCancellationToken(`search.${priceToken}`), null);
  assert.equal(cancellation.parseSearchCancellationToken(confirmation.confirmationToken('inventory', reserved.id, reserved.generation)), null);
  assert.equal(cancellation.parseSearchCancellationToken(searchToken.slice(0, -1) + (searchToken.endsWith('A') ? 'B' : 'A')), null);
  const status = async alert => (await query('SELECT status FROM vehicle_inventory_alerts WHERE id = $1', [alert.id]))[0].status;
  const cancelAt = (token, init) => new Request(`https://example.test/api/inventory-alerts/cancel?token=${token}`, init);
  const page = await cancelRoute.GET(cancelAt(searchToken));
  assert.equal(page.status, 200);
  assert.match(page.headers.get('cache-control'), /no-store/);
  assert.match(page.headers.get('x-robots-tag'), /noindex/);
  assert.match(page.headers.get('content-security-policy'), /^default-src 'none'/);
  assert.match(await page.text(), /<form method="post">/);
  assert.equal(await status(reserved), 'active', 'GET scanners cannot unsubscribe');
  assert.equal((await cancelRoute.GET(cancelAt('bad'))).status, 400);
  assert.equal((await cancelRoute.POST(cancelAt(priceToken, { method: 'POST' }))).status, 400);
  assert.equal((await priceCancelRoute.POST(new Request(`https://example.test/api/price-alerts/cancel?token=${searchToken}`, { method: 'POST' }))).status, 400);
  assert.equal(await status(reserved), 'active');
  // A mail app's RFC 8058 one-click request, while a match waits for the cooldown.
  await query(`UPDATE inventory_alert_deliveries SET created_at = now(), accepted_at = now()
    WHERE id = (SELECT id FROM inventory_alert_deliveries WHERE alert_id = '${reserved.id}' ORDER BY created_at DESC LIMIT 1)`);
  await notify('MLA16', { version: 'XLI' });
  assert.equal(inbox('reserved@example.invalid').length, 2, 'Held back by the cooldown');
  const oneClick = await cancelRoute.POST(cancelAt(searchToken, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' }));
  assert.equal(oneClick.status, 200);
  assert.equal(await status(reserved), 'cancelled');
  await afterCooldown(); await work();
  assert.equal(inbox('reserved@example.invalid').length, 2, 'A cancelled alert gets nothing more');
  // Signing up again needs a new confirmation and a new generation: the old link cannot cancel it.
  const renewed = await subscribe('reserved@example.invalid', { query: 'Corolla', make: 'Toyota' });
  assert.notEqual(renewed.generation, reserved.generation);
  await cancelRoute.POST(cancelAt(searchToken, { method: 'POST' }));
  assert.equal(await status(renewed), 'active', 'An old link cannot cancel the new alert');
  // Cancelling drops an email that has not been sent yet.
  provider = 'http-503';
  await notify('MLA17', { version: 'GLI' });
  provider = 'ok';
  const renewedToken = cancellation.searchCancellationToken(renewed.id, renewed.generation);
  await cancelRoute.POST(cancelAt(renewedToken, { method: 'POST' }));
  assert.equal((await deliveriesOf(renewed)).at(-1).state, 'cancelled');
  await query("UPDATE inventory_alert_deliveries SET next_attempt_at = now()");
  await work();
  assert.equal(inbox('reserved@example.invalid').length, 2);

  // Emails never echo submitted search text and escape listing data.
  const malicious = email.buildSearchMatchEmail({ id: everything.id, generation: everything.generation, email: 'x@example.invalid', more: 0,
    vehicles: [{ slug: 'a"b', title: '<script>bad</script>', mileageKm: 1, transmission: 'Manual', fuel: 'Nafta', price: 1, currency: 'USD', released: false }] });
  assert.equal(malicious.html.includes('<script>'), false);
  assert.ok(malicious.html.includes('a%22b'));
  // The email has no parameter for the saved criteria: free text typed into the form is never echoed.
  assert.deepEqual(Object.keys(batch).sort(), ['attachments', 'from', 'headers', 'html', 'subject', 'text', 'to']);
  assert.ok(batch.html.includes(`src="cid:${batch.attachments[0].content_id}"`), 'The logo is embedded inline');
  assert.equal(/src="https?:/.test(batch.html), false, 'Emails load no external images');

  // Gating: the signup sends a confirmation only where alert emails are configured.
  const signup = body => signupRoute.POST(new Request('https://example.test/api/inventory-alerts', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  deferred = [];
  assert.equal((await signup({ email: 'new@example.invalid', make: 'Toyota' })).status, 201);
  assert.equal(deferred.length, 1, 'Configured: a confirmation email is queued');
  deferred = [];
  delete process.env.RESEND_API_KEY;
  assert.equal((await signup({ email: 'off@example.invalid', make: 'Toyota' })).status, 201);
  assert.equal(deferred.length, 0, 'Not configured: no confirmation email promising alerts that never come');
  const cron = () => dailyRoute.GET(new Request('https://example.test/api/alerts/daily', { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }));
  assert.deepEqual(await (await cron()).json(), { ok: true, enabled: false });
  process.env.RESEND_API_KEY = resendKey;
  assert.equal((await dailyRoute.GET(new Request('https://example.test/api/alerts/daily'))).status, 401);
  const daily = await cron();
  assert.equal(daily.status, 200);
  assert.deepEqual(await daily.json(), { ok: true });

  // Every accepted email has a distinct key, and nothing was sent to an unconfirmed address.
  assert.equal(new Set(sent().map(({ to }) => to[0])).has('pending@example.invalid'), false);
  assert.equal(inbox('new@example.invalid').length + inbox('off@example.invalid').length, 0);
} finally {
  console.error = previousError;
  globalThis.fetch = realFetch;
  await db.close();
}
console.log('Search-alert delivery: shared catalog matching, reserved-car release and same model, cooldown batching, six-car cap, MEP comparison, once-per-car deduplication under concurrency, frozen idempotent retries, ambiguous outage expiry without silencing, key rotation after definite rejections, scoped cancellation with one-click, backlog expiry and signup gating passed.');
