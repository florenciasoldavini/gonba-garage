import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const require = createRequire(import.meta.url);
const SELLER = '123';
const apiKey = 'catalog-api-key-for-tests';
process.env.MERCADO_LIBRE_SELLER_ID = SELLER;
process.env.MERCADO_LIBRE_CLIENT_ID = '456';
process.env.CRON_SECRET = 'test-cron-secret-never-used-outside-tests';
process.env.VEHICLE_DATA_SOURCE = 'mercado-libre';
delete process.env.MERCADO_LIBRE_BACKEND_URL;
// Without the alert email configuration no alert work runs (lib/alerts/config.ts).
delete process.env.RESEND_API_KEY;

// Every migration, applied twice: the runner expects rerunnable DDL.
const db = new PGlite();
const migrations = readdirSync('database/migrations').filter(file => file.endsWith('.sql')).sort()
  .map(file => readFileSync(`database/migrations/${file}`, 'utf8'));
for (let i = 0; i < 2; i++) for (const migration of migrations) await db.exec(migration);
let failQueries = false;
async function sql(strings, ...values) {
  if (failQueries) throw Error('Simulated database outage');
  const text = strings.reduce((result, part, i) => result + part + (i < values.length ? `$${i + 1}` : ''), '');
  return (await db.query(text, values)).rows;
}
const query = async (text, values = []) => (await db.query(text, values)).rows;

// Fake Mercado Libre. Items are mapped by the real mapper, as the real client does.
const items = new Map();
const calls = { item: [], list: 0 };
let listFails = false, itemFails = false;
const item = (id, changes = {}) => ({
  id, seller_id: Number(SELLER), title: 'Toyota Corolla XEi', price: 20000, currency_id: 'USD', status: 'active',
  permalink: `https://auto.mercadolibre.com.ar/${id}`,
  pictures: [{ secure_url: 'https://http2.mlstatic.com/D_NQ_NP_1-O.jpg' }],
  attributes: [
    { id: 'BRAND', name: 'Marca', value_name: 'Toyota' }, { id: 'MODEL', name: 'Modelo', value_name: 'Corolla' },
    { id: 'TRIM', name: 'Versión', value_name: 'XEi' }, { id: 'VEHICLE_YEAR', name: 'Año', value_name: '2021' },
  ],
  start_time: '2026-10-01T10:00:00.000Z', last_updated: '2026-10-20T10:00:00.000Z',
  seller_contact: 'PRIVATE_FIELD', ...changes,
});

const overrides = {
  'react': { cache: fn => fn },
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) }, after: fn => deferred.push(fn) },
  '@/lib/alerts/database': { getAlertsSql: () => sql, isAlertsDatabaseConfigured: () => true },
  './database': { getAlertsSql: () => sql, isAlertsDatabaseConfigured: () => true },
  '@/lib/alerts/price-delivery': { enqueuePriceItem: async () => assert.fail('Price alerts are disabled'), runPriceAlertWorkSafely: async () => {} },
  '@/lib/integrations/mercado-libre/credentials': { authorized: request => request.headers.get('authorization') === `Bearer ${apiKey}` },
  './access-token': { catalogAccessToken: async () => 'access-token' },
};
let deferred = [];
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
    calls.item.push(id);
    if (itemFails) throw failures.failure('catalog_query', 'http_error', { httpStatus: 500 });
    if (!items.has(id)) throw failures.failure('catalog_query', 'http_error', { httpStatus: 404 });
    return mapMercadoLibreItemToVehicle(items.get(id), { plain_text: `Descripción ${id}` });
  },
  async readMercadoLibrePublications() {
    calls.list++;
    if (listFails) throw failures.failure('catalog_query', 'http_error', { httpStatus: 503 });
    const active = [...items.values()].filter(({ status }) => status === 'active');
    return { seller: { id: Number(SELLER) }, publications: { items: active.map(entry => mapMercadoLibreItemToVehicle(entry)) } };
  },
};

const store = load('lib/catalog/store.ts');
const sync = load('lib/integrations/mercado-libre/inventory-sync.ts');
const webhook = load('app/api/mercado-libre/webhook/route.ts');
const syncRoute = load('app/api/mercado-libre/sync/route.ts');
const catalogRoute = load('app/api/mercado-libre/catalog/route.ts');
const catalog = load('lib/integrations/mercado-libre/catalog.ts');

const notify = (id, changes = {}) => webhook.POST(new Request('https://example.test/api/mercado-libre/webhook', {
  method: 'POST', body: JSON.stringify({ topic: 'items', resource: `/items/${id}`, user_id: 123, application_id: 456, ...changes }),
}));
const runDeferred = async () => { for (const task of deferred.splice(0)) await task(); };
const row = async id => (await query('SELECT * FROM public.catalog_publications WHERE publication_id = $1', [id]))[0];
const history = async id => (await query('SELECT price FROM public.catalog_price_history WHERE publication_id = $1 ORDER BY id', [id]))
  .map(({ price }) => Number(price));
const job = async id => (await query('SELECT * FROM public.catalog_sync_jobs WHERE publication_id = $1', [id]))[0];
const previousError = console.error;
console.error = () => {};

try {
  // Webhook: only our seller's item notifications are queued, durably, before acknowledging.
  items.set('MLA1', item('MLA1'));
  assert.equal((await notify('MLA1', { user_id: 999 })).status, 200);
  assert.equal((await notify('MLA1', { application_id: 999 })).status, 200);
  assert.equal((await notify('MLA1', { topic: 'questions' })).status, 200);
  assert.equal(await job('MLA1'), undefined, 'Foreign or unrelated notifications are ignored');
  failQueries = true;
  assert.equal((await notify('MLA1')).status, 503, 'An event that cannot be queued must be retried by Mercado Libre');
  failQueries = false;
  assert.equal((await notify('MLA1')).status, 200);
  assert.equal(calls.item.length, 0, 'The webhook itself never calls Mercado Libre');
  await runDeferred();
  assert.deepEqual(calls.item, ['MLA1']);

  // The copy holds public presentation data only.
  let saved = await row('MLA1');
  assert.equal(saved.status, 'active');
  assert.equal(saved.slug, 'toyota-corolla-xei-mla1');
  assert.equal(Number(saved.price), 20000);
  assert.ok(saved.published_at, 'First active sync records the publication date');
  assert.equal(JSON.stringify(saved).includes('PRIVATE_FIELD'), false, 'Private seller fields are never stored');
  assert.deepEqual(Object.keys(saved.source).sort(), ['attributes', 'id', 'permalink', 'pictures', 'title']);
  assert.deepEqual(await history('MLA1'), [20000], 'The first observed price starts the history');
  const job1 = await job('MLA1');
  assert.equal(Number(job1.processed_revision), Number(job1.revision));

  // An identical re-read changes nothing visible.
  const firstChange = saved.content_changed_at;
  await notify('MLA1'); await runDeferred();
  saved = await row('MLA1');
  assert.equal(saved.content_changed_at.getTime(), firstChange.getTime(), 'Unchanged content keeps updatedAt');
  assert.deepEqual(await history('MLA1'), [20000]);

  // A price change is recorded once, and the slug survives a listing edit.
  items.set('MLA1', item('MLA1', { price: 18500, last_updated: '2026-10-21T10:00:00.000Z',
    attributes: [...item('MLA1').attributes.filter(({ id }) => id !== 'MODEL'), { id: 'MODEL', name: 'Modelo', value_name: 'Corolla Cross' }] }));
  await notify('MLA1'); await notify('MLA1'); await runDeferred();
  saved = await row('MLA1');
  assert.equal(Number(saved.price), 18500);
  assert.equal(saved.vehicle.model, 'Corolla Cross');
  assert.equal(saved.slug, 'toyota-corolla-xei-mla1', 'The URL stays stable when the title changes');
  assert.ok(saved.content_changed_at > firstChange);
  assert.deepEqual(await history('MLA1'), [20000, 18500]);

  // Reads come from the copy, with canonical slugs, and never call Mercado Libre.
  const before = calls.item.length + calls.list;
  assert.deepEqual((await catalog.listCatalogVehicles()).map(({ slug }) => slug), ['toyota-corolla-xei-mla1']);
  const vehicle = await catalog.findCatalogVehicle('toyota-corolla-xei-mla1');
  assert.equal(vehicle.price, 18500);
  assert.equal(vehicle.updatedAt, saved.content_changed_at.toISOString());
  assert.equal(await catalog.findCatalogVehicle('toyota-corolla-cross-xei-mla1'), undefined, 'Only the canonical slug resolves');
  assert.equal((await catalog.findCatalogPublication('toyota-corolla-cross-xei-mla1')).vehicle.slug, 'toyota-corolla-xei-mla1',
    'Other slugs for the same publication resolve so the page can redirect');
  assert.equal(await catalog.findCatalogPublication('toyota-corolla-mla999'), null);
  assert.equal(calls.item.length + calls.list, before, 'Page reads never call Mercado Libre');

  // Lifecycle: paused leaves the listing but keeps its page, deleted items are closed.
  items.set('MLA1', item('MLA1', { price: 18500, status: 'paused' }));
  await notify('MLA1'); await runDeferred();
  assert.deepEqual(await catalog.listCatalogVehicles(), []);
  assert.equal((await catalog.findCatalogVehicle('toyota-corolla-xei-mla1')).status, 'paused');
  items.delete('MLA1');
  await notify('MLA1'); await runDeferred();
  saved = await row('MLA1');
  assert.equal(saved.status, 'closed');
  assert.ok(saved.closed_at, 'Closing records the date');
  assert.ok(saved.published_at, 'Publication date is kept');

  // Items of another seller are never stored.
  items.set('MLA2', item('MLA2', { seller_id: 999 }));
  await notify('MLA2'); await runDeferred();
  assert.equal(await row('MLA2'), undefined);
  items.delete('MLA2');

  // A worker whose lease expired cannot overwrite a newer read.
  items.set('MLA3', item('MLA3'));
  await store.enqueueCatalogJobs(['MLA3']);
  const lease = '00000000-0000-4000-8000-000000000001';
  const leased = await store.leaseCatalogJob(lease);
  assert.equal(leased.id, 'MLA3');
  await query("UPDATE public.catalog_sync_jobs SET lease_id = '00000000-0000-4000-8000-000000000002' WHERE publication_id = 'MLA3'");
  const stale = await store.savePublication(mapMercadoLibreItemToVehicle(item('MLA3')), lease);
  assert.equal(stale.saved, false);
  assert.equal(stale.becameAvailable, false, 'A stale write records no availability');
  assert.equal(await row('MLA3'), undefined);
  await query("UPDATE public.catalog_sync_jobs SET lease_id = NULL, lease_until = NULL WHERE publication_id = 'MLA3'");

  // A notification during processing makes the item due again after the current read.
  await store.enqueueCatalogJobs(['MLA3']);
  const inFlight = await store.leaseCatalogJob(lease);
  await store.enqueueCatalogJobs(['MLA3']);
  await store.completeCatalogJob('MLA3', lease, inFlight.revision);
  const pending = await job('MLA3');
  assert.ok(Number(pending.revision) > Number(pending.processed_revision), 'The newer revision stays queued');
  await sync.runCatalogSyncWork();
  assert.equal((await row('MLA3')).status, 'active');

  // Provider failures back off with a safe error code and are given up after repeated attempts.
  itemFails = true;
  await store.enqueueCatalogJobs(['MLA3']);
  assert.equal(await sync.processNextCatalogJob(), true);
  let failed = await job('MLA3');
  assert.equal(failed.last_error, 'catalog_query:http_error:500');
  assert.ok(failed.next_attempt_at > new Date(), 'Retries wait for the backoff');
  assert.equal(await sync.processNextCatalogJob(), false, 'An item in backoff is not retried immediately');
  for (let attempt = 2; attempt <= 8; attempt++) {
    await query("UPDATE public.catalog_sync_jobs SET next_attempt_at = now() WHERE publication_id = 'MLA3'");
    await sync.processNextCatalogJob();
  }
  failed = await job('MLA3');
  assert.equal(Number(failed.processed_revision), Number(failed.revision), 'Abandoned after eight attempts');
  assert.equal(failed.last_error, 'catalog_query:http_error:500', 'The error stays visible for diagnostics');
  assert.equal((await row('MLA3')).status, 'active', 'A failing read never changes the stored vehicle');
  itemFails = false;

  // Reconciliation queues new, changed, unlisted and stale items, and never edits rows itself.
  items.set('MLA4', item('MLA4'));
  items.set('MLA3', item('MLA3', { status: 'paused' }));
  let result = await sync.reconcileCatalog();
  assert.deepEqual(result, { skipped: false, listed: 1, enqueued: 2 });
  assert.equal((await row('MLA3')).status, 'active', 'Absence from the listing alone does not change a vehicle');
  await sync.runCatalogSyncWork();
  assert.equal((await row('MLA3')).status, 'paused');
  assert.equal((await row('MLA4')).status, 'active');
  result = await sync.reconcileCatalog();
  assert.equal(result.enqueued, 0, 'An unchanged catalog queues nothing');
  await query("UPDATE public.catalog_publications SET synced_at = now() - interval '25 hours' WHERE publication_id IN ('MLA3', 'MLA1')");
  result = await sync.reconcileCatalog();
  assert.equal(result.enqueued, 1, 'Stale rows are refreshed daily, except closed ones');
  await sync.runCatalogSyncWork();

  // An empty or failed listing cannot remove vehicles from the site.
  const listed = new Map(items); items.clear();
  await sync.reconcileCatalog();
  assert.equal((await row('MLA4')).status, 'active', 'Only an item read can close a vehicle');
  items.set('MLA4', listed.get('MLA4')); items.set('MLA3', listed.get('MLA3'));
  await sync.runCatalogSyncWork();
  assert.equal((await row('MLA4')).status, 'active');
  listFails = true;
  await assert.rejects(sync.reconcileCatalog());
  const run = (await query("SELECT * FROM public.catalog_sync_runs"))[0];
  assert.equal(run.last_failure, 'catalog_query:http_error:503');
  assert.equal(run.lease_id, null, 'A failed run releases its lease');
  listFails = false;

  // Only one reconciliation at a time.
  await query("UPDATE public.catalog_sync_runs SET lease_id = '00000000-0000-4000-8000-000000000003', lease_until = now() + interval '1 minute'");
  assert.deepEqual(await sync.reconcileCatalog(), { skipped: true });
  await query("UPDATE public.catalog_sync_runs SET lease_id = NULL, lease_until = NULL");

  // Cron route: CRON_SECRET only.
  const cron = (auth) => syncRoute.GET(new Request('https://example.test/api/mercado-libre/sync', auth ? { headers: { Authorization: auth } } : {}));
  assert.equal((await cron()).status, 401);
  assert.equal((await cron('Bearer wrong')).status, 401);
  const cronResponse = await cron(`Bearer ${process.env.CRON_SECRET}`);
  assert.equal(cronResponse.status, 200);
  assert.equal(cronResponse.headers.get('cache-control'), 'private, no-store');
  listFails = true;
  const failedCron = await cron(`Bearer ${process.env.CRON_SECRET}`);
  assert.equal(failedCron.status, 503);
  assert.match((await failedCron.json()).incidentId, /^[a-f0-9-]{36}$/);
  listFails = false;

  // Backend catalog endpoint: served from the copy, any status by ID, public fields only.
  const backend = (search = '', key = apiKey) => catalogRoute.GET(new Request(`https://example.test/api/mercado-libre/catalog${search}`,
    { headers: { Authorization: `Bearer ${key}` } }));
  assert.equal((await backend('', 'wrong')).status, 401);
  assert.equal((await backend('?item=mla4')).status, 400);
  assert.deepEqual((await (await backend()).json()).vehicles.map(({ mercadoLibreId }) => mercadoLibreId), ['MLA4']);
  const closed = await (await backend('?item=MLA1')).json();
  assert.equal(closed.vehicle.status, 'closed');
  assert.equal(closed.description.plain_text, 'Descripción MLA1');
  assert.equal(JSON.stringify(closed).includes('PRIVATE_FIELD'), false);
  assert.equal((await backend('?item=MLA999')).status, 404);

  const health = await store.readSyncHealth();
  assert.equal(health.publications.active, 1);
  assert.ok(health.reconciliation.lastCompletedAt);

  // Search alerts: a car becoming available is recorded in the same statement as its save, once
  // per transition. previous_status is null for a new listing.
  const events = async id => (await query('SELECT previous_status FROM public.inventory_alert_events WHERE publication_id = $1 ORDER BY created_at, id', [id]))
    .map(({ previous_status }) => previous_status);
  assert.deepEqual(await events('MLA4'), [], 'Stock first seen weeks after it was listed is not news');
  const fresh = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
  const sync6 = async (changes = {}) => { items.set('MLA6', item('MLA6', { start_time: fresh, ...changes })); await notify('MLA6'); await runDeferred(); };
  await sync6();
  assert.deepEqual(await events('MLA6'), [null], 'A new listing is recorded');
  await sync6();
  await sync6({ price: 19000 });
  assert.deepEqual(await events('MLA6'), [null], 'Re-reads and price changes of an available car are not new availability');
  await sync6({ status: 'paused' });
  assert.deepEqual(await events('MLA6'), [null], 'A reservation is not availability');
  await sync6();
  assert.deepEqual(await events('MLA6'), [null, 'paused'], 'A reservation that falls through is recorded');
  items.set('MLA1', item('MLA1'));
  await notify('MLA1'); await runDeferred();
  assert.deepEqual(await events('MLA1'), ['closed'], 'A closed listing that comes back is recorded, however old');
  assert.ok((await query("SELECT * FROM public.inventory_alert_events")).every(({ state }) => state === 'pending'),
    'Without alert email configuration nothing is matched');
} finally {
  console.error = previousError;
  await db.close();
}
console.log('Inventory sync: rerunnable migrations, durable webhook queue, seller-checked public-only copy, stable slugs, price history, lifecycle, availability events, stale-lease protection, revisions, backoff, safe reconciliation, cron auth and database-only reads passed.');
