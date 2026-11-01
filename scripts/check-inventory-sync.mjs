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
const calls = { item: [], list: 0, category: [] };
let listFails = false, itemFails = false;
const item = (id, changes = {}) => ({
  id, seller_id: Number(SELLER), category_id: 'MLA1744', title: 'Toyota Corolla XEi', price: 20000, currency_id: 'USD', status: 'active',
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
    // Every status, as the real scan returns it.
    return { seller: { id: Number(SELLER) }, publications: { items: [...items.values()].map(entry => mapMercadoLibreItemToVehicle(entry)) } };
  },
  // Real Mercado Libre Argentina ancestries (cars, motorcycles, trucks, savings plans and a toy
  // category), plus a hypothetical future subcategory of cars.
  async readMercadoLibreCategoryPath(id) {
    calls.category.push(id);
    const paths = { MLA1744: ['MLA1743', 'MLA1744'], MLA1763: ['MLA1743', 'MLA1763'], MLA1784: ['MLA1743', 'MLA1784'],
      MLA58254: ['MLA1743', 'MLA58254'], MLA3422: ['MLA1132', 'MLA3422'], MLA900001: ['MLA1743', 'MLA1744', 'MLA900001'] };
    if (!paths[id]) throw failures.failure('catalog_query', 'http_error', { httpStatus: 503 });
    return paths[id];
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
  const stale = await store.savePublication(mapMercadoLibreItemToVehicle(item('MLA3')), 'MLA1744', lease);
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
  assert.deepEqual(result, { skipped: false, listed: 2, enqueued: 2 }, 'Every status is listed, not only active');
  assert.equal((await row('MLA3')).status, 'active', 'Reconciliation alone does not change a vehicle');
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

  // Backfill: every car, pickup and motorcycle of the seller reaches the copy in any status, so cars
  // sold or reserved before the copy existed keep a page. Anything else (a scale model, a savings
  // plan, a truck) never does, whatever its status or however it arrives. Each row records the
  // category that qualified it.
  items.set('MLA7', item('MLA7', { status: 'closed' }));
  items.set('MLA8', item('MLA8', { status: 'paused', category_id: 'MLA1763', title: 'KTM 790 Adventure R',
    attributes: [{ id: 'BRAND', name: 'Marca', value_name: 'KTM' }, { id: 'MODEL', name: 'Modelo', value_name: '790 Adventure' }] }));
  items.set('MLA9', item('MLA9', { status: 'paused', category_id: 'MLA3422', title: 'Dodge Polara RT 1:43' }));
  items.set('MLA10', item('MLA10', { category_id: 'MLA1784', title: 'Plan de ahorro' }));
  items.set('MLA13', item('MLA13', { category_id: 'MLA58254', title: 'Mercedes-Benz Atego 1726' }));
  items.set('MLA14', item('MLA14', { category_id: 'MLA900001' }));
  result = await sync.reconcileCatalog();
  assert.deepEqual(result, { skipped: false, listed: 5, enqueued: 3 }, 'Only cars, pickups and motorcycles are listed and queued');
  await sync.runCatalogSyncWork();
  assert.equal((await row('MLA7')).status, 'closed', 'A car closed before the copy existed is stored');
  assert.equal((await row('MLA7')).vehicle_category, 'MLA1744');
  assert.equal((await row('MLA8')).status, 'paused', 'A motorcycle is stored');
  assert.equal((await row('MLA8')).vehicle_category, 'MLA1763');
  assert.equal((await row('MLA14')).vehicle_category, 'MLA1744', 'A subcategory of cars qualifies through its parent');
  assert.equal(await row('MLA9'), undefined, 'A scale model is not stored');
  assert.equal(await row('MLA10'), undefined, 'A savings plan is not stored');
  assert.equal(await row('MLA13'), undefined, 'A truck is not stored');
  await notify('MLA9'); await notify('MLA10'); await runDeferred();
  assert.equal(await row('MLA9'), undefined, 'A notification does not store a non-vehicle either');
  assert.equal(await row('MLA10'), undefined);
  assert.equal(Number((await job('MLA9')).processed_revision), Number((await job('MLA9')).revision), 'The job is done');
  assert.equal(new Set(calls.category).size, calls.category.length, 'Each category is looked up once');
  assert.equal((await sync.reconcileCatalog()).enqueued, 0, 'Non-vehicles are not queued again every day');
  // An item without a category, or whose category cannot be read, is retried rather than guessed.
  items.set('MLA11', item('MLA11', { category_id: undefined }));
  items.set('MLA12', item('MLA12', { category_id: 'MLA5' }));
  result = await sync.reconcileCatalog();
  assert.equal(result.enqueued, 2, 'An unknown category does not stop reconciliation');
  await sync.runCatalogSyncWork();
  assert.equal((await job('MLA11')).last_error, 'catalog_query:invalid_response');
  assert.equal((await job('MLA12')).last_error, 'catalog_query:http_error:503');
  assert.equal(await row('MLA11'), undefined);
  assert.equal(await row('MLA12'), undefined);
  for (const id of ['MLA7', 'MLA8', 'MLA9', 'MLA10', 'MLA11', 'MLA12', 'MLA13', 'MLA14']) items.delete(id);
  await sync.reconcileCatalog(); await sync.runCatalogSyncWork();
  assert.equal((await row('MLA14')).status, 'closed', 'A deleted car keeps its category when closed');

  // The database itself rejects any write without a car, pickup or motorcycle category, so no other
  // code path can store something else. The SQL list matches vehicle-categories.ts.
  const { VEHICLE_CATEGORIES } = load('lib/integrations/mercado-libre/vehicle-categories.ts');
  const categoryMigration = readFileSync('database/migrations/20261102_catalog_vehicle_category.sql', 'utf8');
  assert.deepEqual([...categoryMigration.matchAll(/'(MLA\d+)'/g)].map(([, id]) => id).sort(), Object.keys(VEHICLE_CATEGORIES).sort());
  const directInsert = category => query(`INSERT INTO public.catalog_publications (publication_id, slug, status, price, currency,
    vehicle, source${category === undefined ? '' : ', vehicle_category'}) VALUES ('MLA15', 'direct-mla15', 'active', 1, 'USD', '{}', '{}'
    ${category === undefined ? '' : ', $1'})`, category === undefined ? [] : [category]);
  for (const category of [undefined, null, 'MLA58254', 'MLA3422']) {
    await assert.rejects(directInsert(category), /vehicle_category_check/, `A direct write with category ${category} is rejected`);
  }
  await assert.rejects(query("UPDATE public.catalog_publications SET vehicle_category = NULL WHERE publication_id = 'MLA7'"),
    /vehicle_category_check/, 'A stored car cannot lose its category');
  // Rows saved before categories were recorded stay readable, and reconciliation reads each one
  // still listed again to record its category.
  await query("ALTER TABLE public.catalog_publications DROP CONSTRAINT catalog_publications_vehicle_category_check");
  await query("UPDATE public.catalog_publications SET vehicle_category = NULL WHERE publication_id IN ('MLA3', 'MLA4')");
  await db.exec(categoryMigration);
  assert.equal((await row('MLA4')).vehicle_category, null, 'Existing rows are not checked by the migration');
  assert.deepEqual((await catalog.listCatalogVehicles()).map(({ slug }) => slug), ['toyota-corolla-xei-mla4'], 'They stay on the site');
  result = await sync.reconcileCatalog();
  assert.equal(result.enqueued, 2, 'Uncategorised rows still listed are read again');
  await sync.runCatalogSyncWork();
  assert.equal((await row('MLA3')).vehicle_category, 'MLA1744');
  assert.equal((await row('MLA4')).vehicle_category, 'MLA1744');
  assert.equal((await sync.reconcileCatalog()).enqueued, 0, 'Once recorded, nothing is read again');

  // The real client lists every status through scan pages, and reads a category's ancestry.
  const client = load('lib/integrations/mercado-libre/oauth.ts');
  const realFetch = globalThis.fetch;
  const requested = [];
  const pages = { '': { results: ['MLA21', 'MLA22'], scroll_id: 'next' }, next: { results: ['MLA23'], scroll_id: 'last' }, last: { results: [] } };
  globalThis.fetch = async url => {
    const { pathname, searchParams } = new URL(url);
    requested.push(`${pathname}?${searchParams}`);
    if (pathname === '/users/me') return Response.json({ id: Number(SELLER) });
    if (pathname === `/users/${SELLER}/items/search`) {
      return Response.json({ seller_id: Number(SELLER), paging: { total: 3 }, ...pages[searchParams.get('scroll_id') ?? ''] });
    }
    if (pathname === '/items/bulk') {
      const statuses = { MLA21: 'active', MLA22: 'paused', MLA23: 'closed' };
      return Response.json(searchParams.get('ids').split(',').map(id => ({ status_code: 200, body: item(id, { status: statuses[id] }) })));
    }
    if (pathname === '/categories/MLA1763') return Response.json({ id: 'MLA1763', path_from_root: [{ id: 'MLA1743' }, { id: 'MLA1763' }] });
    if (pathname === '/categories/MLA1') return Response.json({ id: 'MLA1', path_from_root: [] });
    return new Response(null, { status: 404 });
  };
  try {
    const listing = await client.readMercadoLibrePublications('access-token');
    assert.deepEqual(listing.publications.items.map(({ vehicle }) => vehicle.status), ['active', 'paused', 'closed']);
    const searches = requested.filter(path => path.includes('/items/search'));
    assert.equal(searches.length, 2, 'Scan pages are followed until every item is found');
    assert.ok(searches.every(path => path.includes('search_type=scan') && !path.includes('status=')), 'No status filter');
    assert.deepEqual(await client.readMercadoLibreCategoryPath('MLA1763', 'access-token'), ['MLA1743', 'MLA1763']);
    await assert.rejects(client.readMercadoLibreCategoryPath('MLA1', 'access-token'), /invalid_response/);
  } finally {
    globalThis.fetch = realFetch;
  }

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
console.log('Inventory sync: rerunnable migrations, durable webhook queue, seller-checked public-only copy, stable slugs, price history, lifecycle, availability events, stale-lease protection, revisions, backoff, safe reconciliation, all-status car and motorcycle backfill, database-enforced vehicle categories, cron auth and database-only reads passed.');
