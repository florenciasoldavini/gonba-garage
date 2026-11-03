import assert from 'node:assert/strict';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import { mapMercadoLibreItemToVehicle } from '@/features/vehicles/data/mercado-libre-vehicle-mapper';
import * as store from '@/lib/catalog/store';
import * as sync from '@/lib/integrations/mercado-libre/inventory-sync';
import * as catalog from '@/lib/integrations/mercado-libre/catalog';
import { VEHICLE_CATEGORIES } from '@/lib/integrations/mercado-libre/vehicle-categories';
import * as webhook from '@/app/api/mercado-libre/webhook/route';
import * as syncRoute from '@/app/api/mercado-libre/sync/route';
import * as catalogRoute from '@/app/api/mercado-libre/catalog/route';
import { readMigrations } from '../../scripts/migration-runner.mjs';
import { createDatabase, createSql } from '../helpers/postgres.mjs';

const SELLER = '123';
const apiKey = 'catalog-api-key-for-tests';

// `beforeQuery` runs before each application query, to interleave work at an exact point.
const state = vi.hoisted(() => ({ sql: null, deferred: [], beforeQuery: null }));
// Fake Mercado Libre. Items are mapped by the real mapper, as the real client does.
const mercadoLibre = vi.hoisted(() => ({
  items: new Map(),
  calls: { item: [], list: 0, category: [] },
  listFails: false,
  itemFails: false,
  listTotal: null,
  // Items the scan lists but the bulk read does not return.
  bulkFails: new Set(),
}));
// The Next.js data cache behind unstable_cache, which reads it from globalThis outside a server.
// Off, it stores nothing and every read reaches the database. `expired` records each
// revalidateTag call, which drops the entries carrying the tag, as the platform cache does.
const dataCache = vi.hoisted(() => {
  const dataCache = { enabled: false, entries: new Map(), expired: [], expiryFails: false };
  globalThis.__incrementalCache = {
    isOnDemandRevalidate: false,
    generateSimpleCacheKey: async key => key,
    get: async key => (dataCache.enabled ? (dataCache.entries.get(key)?.entry ?? null) : null),
    set: async (key, value, { tags }) => {
      if (dataCache.enabled) dataCache.entries.set(key, { entry: { value, isStale: false }, tags });
    },
  };
  return dataCache;
});
vi.mock('next/cache', async importOriginal => ({
  ...(await importOriginal()),
  revalidateTag: (tag, profile) => {
    if (dataCache.expiryFails) throw Error('Simulated cache outage');
    dataCache.expired.push([tag, profile]);
    for (const [key, { tags }] of dataCache.entries) if (tags.includes(tag)) dataCache.entries.delete(key);
  },
}));
vi.mock('next/server', async importOriginal => ({
  ...(await importOriginal()),
  after: task => {
    state.deferred.push(task);
  },
}));
vi.mock('@/lib/database', () => ({ getSql: () => state.sql, isDatabaseConfigured: () => true }));
vi.mock('@/lib/alerts/price-delivery', () => ({
  enqueuePriceItem: async () => assert.fail('Price alerts are disabled'),
  runPriceAlertWorkSafely: async () => {},
}));
vi.mock('@/lib/integrations/mercado-libre/credentials', () => ({
  authorized: request => request.headers.get('authorization') === 'Bearer catalog-api-key-for-tests',
}));
vi.mock('@/lib/integrations/mercado-libre/access-token', () => ({ catalogAccessToken: async () => 'access-token' }));
vi.mock('@/lib/integrations/mercado-libre/api', async () => {
  const failures = await import('@/lib/integrations/mercado-libre/failures');
  const { mapMercadoLibreItemToVehicle } = await import('@/features/vehicles/data/mercado-libre-vehicle-mapper');
  const { items, calls } = mercadoLibre;
  return {
    async readMercadoLibrePublication(id) {
      calls.item.push(id);
      if (mercadoLibre.itemFails) throw failures.failure('catalog_query', 'http_error', { httpStatus: 500 });
      if (!items.has(id)) throw failures.failure('catalog_query', 'http_error', { httpStatus: 404 });
      return mapMercadoLibreItemToVehicle(items.get(id), { plain_text: `Descripción ${id}` });
    },
    async readMercadoLibrePublications() {
      calls.list++;
      if (mercadoLibre.listFails) throw failures.failure('catalog_query', 'http_error', { httpStatus: 503 });
      // Every status, as the real scan returns it.
      const read = [...items.values()].filter(({ id }) => !mercadoLibre.bulkFails.has(id));
      return {
        seller: { id: 123 },
        publications: {
          total: mercadoLibre.listTotal ?? items.size,
          items: read.map(entry => mapMercadoLibreItemToVehicle(entry)),
          unread: [...mercadoLibre.bulkFails].map(id => ({
            id,
            incident: failures.failure('catalog_query', 'http_error', { httpStatus: 404 }).incident,
          })),
        },
      };
    },
    // Real Mercado Libre Argentina ancestries (cars, motorcycles, trucks, savings plans and a toy
    // category), plus a hypothetical future subcategory of cars.
    async readMercadoLibreCategoryPath(id) {
      calls.category.push(id);
      const paths = {
        MLA1744: ['MLA1743', 'MLA1744'],
        MLA1763: ['MLA1743', 'MLA1763'],
        MLA1784: ['MLA1743', 'MLA1784'],
        MLA58254: ['MLA1743', 'MLA58254'],
        MLA3422: ['MLA1132', 'MLA3422'],
        MLA900001: ['MLA1743', 'MLA1744', 'MLA900001'],
      };
      if (!paths[id]) throw failures.failure('catalog_query', 'http_error', { httpStatus: 503 });
      return paths[id];
    },
  };
});

const item = (id, changes = {}) => ({
  id,
  seller_id: Number(SELLER),
  category_id: 'MLA1744',
  title: 'Toyota Corolla XEi',
  price: 20000,
  currency_id: 'USD',
  status: 'active',
  permalink: `https://auto.mercadolibre.com.ar/${id}`,
  pictures: [{ secure_url: 'https://http2.mlstatic.com/D_NQ_NP_1-O.jpg' }],
  attributes: [
    { id: 'BRAND', name: 'Marca', value_name: 'Toyota' },
    { id: 'MODEL', name: 'Modelo', value_name: 'Corolla' },
    { id: 'TRIM', name: 'Versión', value_name: 'XEi' },
    { id: 'VEHICLE_YEAR', name: 'Año', value_name: '2021' },
  ],
  start_time: '2026-10-01T10:00:00.000Z',
  last_updated: '2026-10-20T10:00:00.000Z',
  seller_contact: 'PRIVATE_FIELD',
  ...changes,
});

beforeEach(() => {
  vi.stubEnv('MERCADO_LIBRE_SELLER_ID', SELLER);
  vi.stubEnv('MERCADO_LIBRE_CLIENT_ID', '456');
  vi.stubEnv('CRON_SECRET', 'test-cron-secret-never-used-outside-tests');
  vi.stubEnv('MERCADO_LIBRE_BACKEND_URL', undefined);
  // Without the alert email configuration no alert work runs (lib/alerts/config.ts).
  vi.stubEnv('RESEND_API_KEY', undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Mercado Libre item mapper', () => {
  it('shows the placeholder for a publication without photos', () => {
    assert.equal(
      mapMercadoLibreItemToVehicle(item('MLA9', { pictures: [] })).vehicle.image,
      '/vehicle-photo-placeholder.jpg',
      'A publication without photos shows the placeholder, never a photo of another car',
    );
  });

  // Whole-number attributes sent only as text: the Argentine thousands dot is not a decimal point.
  it('reads whole-number attributes with thousands separators', () => {
    const mapped = attributes => mapMercadoLibreItemToVehicle(item('MLA9', { attributes })).vehicle;
    const kilometers = value_name => mapped([{ id: 'KILOMETERS', name: 'Kilómetros', value_name }]).mileageKm;
    assert.equal(kilometers('120.000 km'), 120000);
    assert.equal(kilometers('120,000 km'), 120000);
    assert.equal(kilometers('120000 km'), 120000);
    assert.equal(kilometers('sin dato'), 0);
    assert.equal(mapped([]).mileageKm, 0);
    assert.equal(mapped([{ id: 'VEHICLE_YEAR', name: 'Año', value_name: '2019' }]).year, 2019);
    assert.equal(
      mapped([{ id: 'KILOMETERS', name: 'Kilómetros', value_struct: { number: 85000, unit: 'km' } }]).mileageKm,
      85000,
    );
  });
});

describe('Mercado Libre client', () => {
  it('lists every status through scan pages and reads a category ancestry', async () => {
    const client = await vi.importActual('@/lib/integrations/mercado-libre/api');
    const requested = [];
    const pages = {
      '': { results: ['MLA21', 'MLA22'], scroll_id: 'next' },
      next: { results: ['MLA23'], scroll_id: 'last' },
      last: { results: [] },
    };
    vi.stubGlobal('fetch', async url => {
      const { pathname, searchParams } = new URL(url);
      requested.push(`${pathname}?${searchParams}`);
      if (pathname === '/users/me') return Response.json({ id: Number(SELLER) });
      if (pathname === `/users/${SELLER}/items/search`) {
        return Response.json({
          seller_id: Number(SELLER),
          paging: { total: 3 },
          ...pages[searchParams.get('scroll_id') ?? ''],
        });
      }
      if (pathname === '/items/bulk') {
        const statuses = { MLA21: 'active', MLA22: 'paused', MLA23: 'closed' };
        return Response.json(
          searchParams
            .get('ids')
            .split(',')
            .map(id => ({ status_code: 200, body: item(id, { status: statuses[id] }) })),
        );
      }
      if (pathname === '/categories/MLA1763')
        return Response.json({ id: 'MLA1763', path_from_root: [{ id: 'MLA1743' }, { id: 'MLA1763' }] });
      if (pathname === '/categories/MLA1') return Response.json({ id: 'MLA1', path_from_root: [] });
      return new Response(null, { status: 404 });
    });
    const listing = await client.readMercadoLibrePublications('access-token');
    assert.deepEqual(
      listing.publications.items.map(({ vehicle }) => vehicle.status),
      ['active', 'paused', 'closed'],
    );
    const searches = requested.filter(path => path.includes('/items/search'));
    assert.equal(searches.length, 2, 'Scan pages are followed until every item is found');
    assert.ok(
      searches.every(path => path.includes('search_type=scan') && !path.includes('status=')),
      'No status filter',
    );
    assert.deepEqual(await client.readMercadoLibreCategoryPath('MLA1763', 'access-token'), ['MLA1743', 'MLA1763']);
    await assert.rejects(client.readMercadoLibreCategoryPath('MLA1', 'access-token'), /invalid_response/);
  });

  // A few hundred publications must not become a burst of parallel bulk requests.
  it('reads bulk batches a few at a time, in order', async () => {
    const client = await vi.importActual('@/lib/integrations/mercado-libre/api');
    const ids = Array.from({ length: 210 }, (_, index) => `MLA${1000 + index}`);
    let inFlight = 0;
    let maxInFlight = 0;
    let bulkRequests = 0;
    vi.stubGlobal('fetch', async url => {
      const { pathname, searchParams } = new URL(url);
      if (pathname === '/users/me') return Response.json({ id: Number(SELLER) });
      if (pathname === `/users/${SELLER}/items/search`)
        return Response.json({ paging: { total: ids.length }, results: ids });
      bulkRequests++;
      maxInFlight = Math.max(maxInFlight, ++inFlight);
      await new Promise(resolve => setTimeout(resolve, 5));
      inFlight--;
      return Response.json(
        searchParams
          .get('ids')
          .split(',')
          .map(id => ({ status_code: 200, body: item(id) })),
      );
    });
    const listing = await client.readMercadoLibrePublications('access-token');
    assert.equal(bulkRequests, 11);
    assert.ok(
      maxInFlight <= client.ITEMS_BULK_CONCURRENCY,
      `At most ${client.ITEMS_BULK_CONCURRENCY} bulk requests at once, saw ${maxInFlight}`,
    );
    assert.ok(maxInFlight > 1, 'Batches still run in parallel');
    assert.deepEqual(
      listing.publications.items.map(({ source }) => source.id),
      ids,
    );
    assert.deepEqual(listing.publications.unread, []);
  });

  it('returns an item the bulk read missed as unread instead of failing the listing', async () => {
    const client = await vi.importActual('@/lib/integrations/mercado-libre/api');
    let bulkStatus = 200;
    vi.stubGlobal('fetch', async url => {
      const { pathname } = new URL(url);
      if (pathname === '/users/me') return Response.json({ id: Number(SELLER) });
      if (pathname === `/users/${SELLER}/items/search`)
        return Response.json({ paging: { total: 3 }, results: ['MLA21', 'MLA22', 'MLA23'] });
      if (bulkStatus !== 200) return Response.json({ error: 'too_many_requests' }, { status: bulkStatus });
      // MLA22 was deleted after the scan; MLA23 is missing from the response altogether.
      return Response.json([
        { status_code: 200, body: item('MLA21') },
        {
          id: 'MLA22',
          status_code: 404,
          body: { message: 'Item with id MLA22 not found', error: 'not_found', status: 404 },
        },
      ]);
    });
    const listing = await client.readMercadoLibrePublications('access-token');
    assert.deepEqual(
      listing.publications.items.map(({ source }) => source.id),
      ['MLA21'],
    );
    assert.deepEqual(
      listing.publications.unread.map(({ id, incident: { stage, code, httpStatus } }) => ({
        id,
        stage,
        code,
        httpStatus,
      })),
      [
        { id: 'MLA22', stage: 'catalog_query', code: 'http_error', httpStatus: 404 },
        { id: 'MLA23', stage: 'catalog_query', code: 'invalid_response', httpStatus: undefined },
      ],
    );
    assert.equal(JSON.stringify(listing).includes('not found'), false, 'No provider text is kept');
    bulkStatus = 429;
    await assert.rejects(
      client.readMercadoLibrePublications('access-token'),
      /catalog_query: http_error/,
      'A failed bulk request still fails the listing',
    );
  });
});

// One synced copy in real PostgreSQL. Each step continues from the copy, the queue and the fake
// Mercado Libre account the previous steps left.
describe('catalog sync', () => {
  const { items, calls } = mercadoLibre;
  const faults = { query: false };
  let db;
  const query = async (text, values = []) => (await db.query(text, values)).rows;
  const notify = (id, changes = {}) =>
    webhook.POST(
      new Request('https://example.test/api/mercado-libre/webhook', {
        method: 'POST',
        body: JSON.stringify({
          topic: 'items',
          resource: `/items/${id}`,
          user_id: 123,
          application_id: 456,
          ...changes,
        }),
      }),
    );
  const runDeferred = async () => {
    for (const task of state.deferred.splice(0)) await task();
  };
  const row = async id => (await query('SELECT * FROM public.catalog_publications WHERE publication_id = $1', [id]))[0];
  const history = async id =>
    (await query('SELECT price FROM public.catalog_price_history WHERE publication_id = $1 ORDER BY id', [id])).map(
      ({ price }) => Number(price),
    );
  const job = async id => (await query('SELECT * FROM public.catalog_sync_jobs WHERE publication_id = $1', [id]))[0];
  const lease = '00000000-0000-4000-8000-000000000001';
  let saved, firstChange, result, listed;

  beforeAll(async () => {
    // Every migration, through the same runner as `npm run db:migrate`.
    db = await createDatabase();
    const sql = createSql(() => db, faults);
    state.sql = Object.assign(
      (strings, ...values) => {
        const query = sql(strings, ...values);
        return {
          ...query,
          then: (onFulfilled, onRejected) =>
            Promise.resolve(state.beforeQuery?.(query.text))
              .then(() => query)
              .then(onFulfilled, onRejected),
        };
      },
      { transaction: sql.transaction },
    );
  });
  afterAll(() => db.close());

  it("queues only the seller's item notifications, durably, before acknowledging", async () => {
    items.set('MLA1', item('MLA1'));
    assert.equal((await notify('MLA1', { user_id: 999 })).status, 200);
    assert.equal((await notify('MLA1', { application_id: 999 })).status, 200);
    assert.equal((await notify('MLA1', { topic: 'questions' })).status, 200);
    assert.equal(await job('MLA1'), undefined, 'Foreign or unrelated notifications are ignored');
    faults.query = true;
    assert.equal((await notify('MLA1')).status, 503, 'An event that cannot be queued must be retried by Mercado Libre');
    faults.query = false;
    assert.equal((await notify('MLA1')).status, 200);
    assert.equal(calls.item.length, 0, 'The webhook itself never calls Mercado Libre');
    await runDeferred();
    assert.deepEqual(calls.item, ['MLA1']);
  });

  it('stores public presentation data only', async () => {
    saved = await row('MLA1');
    assert.equal(saved.status, 'active');
    assert.equal(saved.slug, 'toyota-corolla-xei-mla1');
    assert.equal(Number(saved.price), 20000);
    assert.ok(saved.published_at, 'First active sync records the publication date');
    assert.equal(JSON.stringify(saved).includes('PRIVATE_FIELD'), false, 'Private seller fields are never stored');
    assert.deepEqual(Object.keys(saved.source).sort(), ['attributes', 'id', 'permalink', 'pictures', 'title']);
    assert.deepEqual(await history('MLA1'), [20000], 'The first observed price starts the history');
    const job1 = await job('MLA1');
    assert.equal(Number(job1.processed_revision), Number(job1.revision));
  });

  it('changes nothing visible on an identical re-read', async () => {
    firstChange = saved.content_changed_at;
    await notify('MLA1');
    await runDeferred();
    saved = await row('MLA1');
    assert.equal(saved.content_changed_at.getTime(), firstChange.getTime(), 'Unchanged content keeps updatedAt');
    assert.deepEqual(await history('MLA1'), [20000]);
  });

  it('records a price change once and keeps the slug when the listing is edited', async () => {
    items.set(
      'MLA1',
      item('MLA1', {
        price: 18500,
        last_updated: '2026-10-21T10:00:00.000Z',
        attributes: [
          ...item('MLA1').attributes.filter(({ id }) => id !== 'MODEL'),
          { id: 'MODEL', name: 'Modelo', value_name: 'Corolla Cross' },
        ],
      }),
    );
    await notify('MLA1');
    await notify('MLA1');
    await runDeferred();
    saved = await row('MLA1');
    assert.equal(Number(saved.price), 18500);
    assert.equal(saved.vehicle.model, 'Corolla Cross');
    assert.equal(saved.slug, 'toyota-corolla-xei-mla1', 'The URL stays stable when the title changes');
    assert.ok(saved.content_changed_at > firstChange);
    assert.deepEqual(await history('MLA1'), [20000, 18500]);
  });

  it('reads from the copy, with canonical slugs, without calling Mercado Libre', async () => {
    const before = calls.item.length + calls.list;
    assert.deepEqual(
      (await catalog.listCatalogVehicles()).map(({ slug }) => slug),
      ['toyota-corolla-xei-mla1'],
    );
    const vehicle = await catalog.findCatalogVehicle('toyota-corolla-xei-mla1');
    assert.equal(vehicle.price, 18500);
    assert.equal(vehicle.updatedAt, saved.content_changed_at.toISOString());
    assert.equal(
      await catalog.findCatalogVehicle('toyota-corolla-cross-xei-mla1'),
      undefined,
      'Only the canonical slug resolves',
    );
    assert.equal(
      (await catalog.findCatalogPublication('toyota-corolla-cross-xei-mla1')).vehicle.slug,
      'toyota-corolla-xei-mla1',
      'Other slugs for the same publication resolve so the page can redirect',
    );
    assert.equal(await catalog.findCatalogPublication('toyota-corolla-mla999'), null);
    assert.equal(calls.item.length + calls.list, before, 'Page reads never call Mercado Libre');
  });

  it("keeps a paused car's page out of the listing and closes a deleted one", async () => {
    items.set('MLA1', item('MLA1', { price: 18500, status: 'paused' }));
    await notify('MLA1');
    await runDeferred();
    assert.deepEqual(await catalog.listCatalogVehicles(), []);
    assert.equal((await catalog.findCatalogVehicle('toyota-corolla-xei-mla1')).status, 'paused');
    items.delete('MLA1');
    await notify('MLA1');
    await runDeferred();
    saved = await row('MLA1');
    assert.equal(saved.status, 'closed');
    assert.ok(saved.closed_at, 'Closing records the date');
    assert.ok(saved.published_at, 'Publication date is kept');
    await query(
      `UPDATE public.catalog_publications SET vehicle = jsonb_set(vehicle, '{image}', '"/showroom-car.jpg"') WHERE publication_id = 'MLA1'`,
    );
    assert.equal(
      (await catalog.findCatalogVehicle('toyota-corolla-xei-mla1')).image,
      '/vehicle-photo-placeholder.jpg',
      'A closed row saved with the previous fallback photo reads as the placeholder',
    );
  });

  it("never stores another seller's items", async () => {
    items.set('MLA2', item('MLA2', { seller_id: 999 }));
    await notify('MLA2');
    await runDeferred();
    assert.equal(await row('MLA2'), undefined);
    items.delete('MLA2');
  });

  it('does not let a worker whose lease expired overwrite a newer read', async () => {
    items.set('MLA3', item('MLA3'));
    await store.enqueueCatalogJobs(['MLA3']);
    const leased = await store.leaseCatalogJob(lease);
    assert.equal(leased.id, 'MLA3');
    await query(
      "UPDATE public.catalog_sync_jobs SET lease_id = '00000000-0000-4000-8000-000000000002' WHERE publication_id = 'MLA3'",
    );
    const stale = await store.savePublication(mapMercadoLibreItemToVehicle(item('MLA3')), 'MLA1744', lease);
    assert.equal(stale.saved, false);
    assert.equal(stale.becameAvailable, false, 'A stale write records no availability');
    assert.equal(await row('MLA3'), undefined);
    await query(
      "UPDATE public.catalog_sync_jobs SET lease_id = NULL, lease_until = NULL WHERE publication_id = 'MLA3'",
    );
  });

  it('makes an item due again when notified during processing', async () => {
    await store.enqueueCatalogJobs(['MLA3']);
    const inFlight = await store.leaseCatalogJob(lease);
    await store.enqueueCatalogJobs(['MLA3']);
    await store.completeCatalogJob('MLA3', lease, inFlight.revision);
    const pending = await job('MLA3');
    assert.ok(Number(pending.revision) > Number(pending.processed_revision), 'The newer revision stays queued');
    await sync.runCatalogSyncWork();
    assert.equal((await row('MLA3')).status, 'active');
  });

  it('backs off provider failures with a safe error code and gives up after repeated attempts', async () => {
    mercadoLibre.itemFails = true;
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
    mercadoLibre.itemFails = false;
  });

  it('reconciles by queueing new, changed, unlisted and stale items, never editing rows itself', async () => {
    items.set('MLA4', item('MLA4'));
    items.set('MLA3', item('MLA3', { status: 'paused' }));
    result = await sync.reconcileCatalog();
    assert.deepEqual(
      result,
      { skipped: false, listed: 2, unread: 0, enqueued: 2, pruned: 0 },
      'Every status is listed, not only active',
    );
    assert.equal((await row('MLA3')).status, 'active', 'Reconciliation alone does not change a vehicle');
    await sync.runCatalogSyncWork();
    assert.equal((await row('MLA3')).status, 'paused');
    assert.equal((await row('MLA4')).status, 'active');
    result = await sync.reconcileCatalog();
    assert.equal(result.enqueued, 0, 'An unchanged catalog queues nothing');
    await query(
      "UPDATE public.catalog_publications SET synced_at = now() - interval '25 hours' WHERE publication_id IN ('MLA3', 'MLA1')",
    );
    result = await sync.reconcileCatalog();
    assert.equal(result.enqueued, 1, 'Stale rows are refreshed daily, except closed ones');
    await sync.runCatalogSyncWork();
  });

  it('cannot remove vehicles from the site through an empty or failed listing', async () => {
    listed = new Map(items);
    items.clear();
    await sync.reconcileCatalog();
    assert.equal((await row('MLA4')).status, 'active', 'Only an item read can close a vehicle');
    items.set('MLA4', listed.get('MLA4'));
    items.set('MLA3', listed.get('MLA3'));
    await sync.runCatalogSyncWork();
    assert.equal((await row('MLA4')).status, 'active');
    mercadoLibre.listFails = true;
    await assert.rejects(sync.reconcileCatalog());
    const run = (await query("SELECT * FROM public.catalog_sync_runs WHERE id = 'reconciliation'"))[0];
    assert.equal(run.last_failure, 'catalog_query:http_error:503');
    assert.equal(run.lease_id, null, 'A failed run releases its lease');
    mercadoLibre.listFails = false;
  });

  // Backfill: every car, pickup and motorcycle of the seller reaches the copy in any status, so cars
  // sold or reserved before the copy existed keep a page. Anything else (a scale model, a savings
  // plan, a truck) never does, whatever its status or however it arrives. Each row records the
  // category that qualified it.
  it('backfills every car, pickup and motorcycle in any status, and nothing else', async () => {
    items.set('MLA7', item('MLA7', { status: 'closed' }));
    items.set(
      'MLA8',
      item('MLA8', {
        status: 'paused',
        category_id: 'MLA1763',
        title: 'KTM 790 Adventure R',
        attributes: [
          { id: 'BRAND', name: 'Marca', value_name: 'KTM' },
          { id: 'MODEL', name: 'Modelo', value_name: '790 Adventure' },
        ],
      }),
    );
    items.set('MLA9', item('MLA9', { status: 'paused', category_id: 'MLA3422', title: 'Dodge Polara RT 1:43' }));
    items.set('MLA10', item('MLA10', { category_id: 'MLA1784', title: 'Plan de ahorro' }));
    items.set('MLA13', item('MLA13', { category_id: 'MLA58254', title: 'Mercedes-Benz Atego 1726' }));
    items.set('MLA14', item('MLA14', { category_id: 'MLA900001' }));
    result = await sync.reconcileCatalog();
    assert.deepEqual(
      result,
      { skipped: false, listed: 5, unread: 0, enqueued: 3, pruned: 0 },
      'Only cars, pickups and motorcycles are listed and queued',
    );
    await sync.runCatalogSyncWork();
    assert.equal((await row('MLA7')).status, 'closed', 'A car closed before the copy existed is stored');
    assert.equal((await row('MLA7')).vehicle_category, 'MLA1744');
    assert.equal((await row('MLA8')).status, 'paused', 'A motorcycle is stored');
    assert.equal((await row('MLA8')).vehicle_category, 'MLA1763');
    assert.equal(
      (await row('MLA14')).vehicle_category,
      'MLA1744',
      'A subcategory of cars qualifies through its parent',
    );
    assert.equal(await row('MLA9'), undefined, 'A scale model is not stored');
    assert.equal(await row('MLA10'), undefined, 'A savings plan is not stored');
    assert.equal(await row('MLA13'), undefined, 'A truck is not stored');
    await notify('MLA9');
    await notify('MLA10');
    await runDeferred();
    assert.equal(await row('MLA9'), undefined, 'A notification does not store a non-vehicle either');
    assert.equal(await row('MLA10'), undefined);
    assert.equal(
      Number((await job('MLA9')).processed_revision),
      Number((await job('MLA9')).revision),
      'The job is done',
    );
    assert.equal(new Set(calls.category).size, calls.category.length, 'Each category is looked up once');
    assert.equal((await sync.reconcileCatalog()).enqueued, 0, 'Non-vehicles are not queued again every day');
  });

  // An item without a category, or whose category cannot be read, is retried rather than guessed.
  it('retries an item whose category is missing or unreadable instead of guessing', async () => {
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
    await sync.reconcileCatalog();
    await sync.runCatalogSyncWork();
    assert.equal((await row('MLA14')).status, 'closed', 'A deleted car keeps its category when closed');
  });

  // The database itself rejects any write without a car, pickup or motorcycle category, so no other
  // code path can store something else. The SQL list matches vehicle-categories.ts.
  it('rejects in the database any write without a vehicle category', async () => {
    const categoryMigration = readMigrations().find(({ file }) => file === '20261102_catalog_vehicle_category.sql').sql;
    assert.deepEqual(
      [...categoryMigration.matchAll(/'(MLA\d+)'/g)].map(([, id]) => id).sort(),
      Object.keys(VEHICLE_CATEGORIES).sort(),
    );
    const directInsert = category =>
      query(
        `INSERT INTO public.catalog_publications (publication_id, slug, status, price, currency,
      vehicle, source${category === undefined ? '' : ', vehicle_category'}) VALUES ('MLA15', 'direct-mla15', 'active', 1, 'USD', '{}', '{}'
      ${category === undefined ? '' : ', $1'})`,
        category === undefined ? [] : [category],
      );
    for (const category of [undefined, null, 'MLA58254', 'MLA3422']) {
      await assert.rejects(
        directInsert(category),
        /vehicle_category_check/,
        `A direct write with category ${category} is rejected`,
      );
    }
    await assert.rejects(
      query("UPDATE public.catalog_publications SET vehicle_category = NULL WHERE publication_id = 'MLA7'"),
      /vehicle_category_check/,
      'A stored car cannot lose its category',
    );
  });

  // Rows saved before categories were recorded stay readable, and reconciliation reads each one
  // still listed again to record its category.
  it('keeps rows saved before categories on the site and records their category', async () => {
    await query('ALTER TABLE public.catalog_publications DROP CONSTRAINT catalog_publications_vehicle_category_check');
    await query(
      "UPDATE public.catalog_publications SET vehicle_category = NULL WHERE publication_id IN ('MLA3', 'MLA4')",
    );
    await db.exec(readMigrations().find(({ file }) => file === '20261102_catalog_vehicle_category.sql').sql);
    assert.equal((await row('MLA4')).vehicle_category, null, 'Existing rows are not checked by the migration');
    assert.deepEqual(
      (await catalog.listCatalogVehicles()).map(({ slug }) => slug),
      ['toyota-corolla-xei-mla4'],
      'They stay on the site',
    );
    result = await sync.reconcileCatalog();
    assert.equal(result.enqueued, 2, 'Uncategorised rows still listed are read again');
    await sync.runCatalogSyncWork();
    assert.equal((await row('MLA3')).vehicle_category, 'MLA1744');
    assert.equal((await row('MLA4')).vehicle_category, 'MLA1744');
    assert.equal((await sync.reconcileCatalog()).enqueued, 0, 'Once recorded, nothing is read again');
  });

  it('runs only one reconciliation at a time', async () => {
    await query(
      "UPDATE public.catalog_sync_runs SET lease_id = '00000000-0000-4000-8000-000000000003', lease_until = now() + interval '1 minute' WHERE id = 'reconciliation'",
    );
    assert.deepEqual(await sync.reconcileCatalog(), { skipped: true });
    await query("UPDATE public.catalog_sync_runs SET lease_id = NULL, lease_until = NULL WHERE id = 'reconciliation'");
  });

  it('accepts only CRON_SECRET on the cron route', async () => {
    const cron = auth =>
      syncRoute.GET(
        new Request('https://example.test/api/mercado-libre/sync', auth ? { headers: { Authorization: auth } } : {}),
      );
    assert.equal((await cron()).status, 401);
    assert.equal((await cron('Bearer wrong')).status, 401);
    const cronResponse = await cron(`Bearer ${process.env.CRON_SECRET}`);
    assert.equal(cronResponse.status, 200);
    assert.equal(cronResponse.headers.get('cache-control'), 'private, no-store');
    mercadoLibre.listFails = true;
    const failedCron = await cron(`Bearer ${process.env.CRON_SECRET}`);
    assert.equal(failedCron.status, 503);
    assert.match((await failedCron.json()).incidentId, /^[a-f0-9-]{36}$/);
    mercadoLibre.listFails = false;
  });

  it('serves the backend catalog from the copy, any status by ID, public fields only', async () => {
    const backend = (search = '', key = apiKey) =>
      catalogRoute.GET(
        new Request(`https://example.test/api/mercado-libre/catalog${search}`, {
          headers: { Authorization: `Bearer ${key}` },
        }),
      );
    assert.equal((await backend('', 'wrong')).status, 401);
    assert.equal((await backend('?item=mla4')).status, 400);
    assert.deepEqual(
      (await (await backend()).json()).vehicles.map(({ mercadoLibreId }) => mercadoLibreId),
      ['MLA4'],
    );
    const closed = await (await backend('?item=MLA1')).json();
    assert.equal(closed.vehicle.status, 'closed');
    assert.equal(closed.description.plain_text, 'Descripción MLA1');
    assert.equal(JSON.stringify(closed).includes('PRIVATE_FIELD'), false);
    assert.equal((await backend('?item=MLA999')).status, 404);
  });

  it('reports the sync health', async () => {
    const health = await store.readSyncHealth();
    assert.equal(health.publications.active, 1);
    assert.ok(health.reconciliation.lastCompletedAt);
  });

  // Search alerts: a car becoming available is recorded in the same statement as its save, once
  // per transition. previous_status is null for a new listing.
  it('records each availability transition once for search alerts', async () => {
    const events = async id =>
      (
        await query(
          'SELECT previous_status FROM public.inventory_alert_events WHERE publication_id = $1 ORDER BY created_at, id',
          [id],
        )
      ).map(({ previous_status }) => previous_status);
    assert.deepEqual(await events('MLA4'), [], 'Stock first seen weeks after it was listed is not news');
    const fresh = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
    const sync6 = async (changes = {}) => {
      items.set('MLA6', item('MLA6', { start_time: fresh, ...changes }));
      await notify('MLA6');
      await runDeferred();
    };
    await sync6();
    assert.deepEqual(await events('MLA6'), [null], 'A new listing is recorded');
    await sync6();
    await sync6({ price: 19000 });
    assert.deepEqual(
      await events('MLA6'),
      [null],
      'Re-reads and price changes of an available car are not new availability',
    );
    await sync6({ status: 'paused' });
    assert.deepEqual(await events('MLA6'), [null], 'A reservation is not availability');
    await sync6();
    assert.deepEqual(await events('MLA6'), [null, 'paused'], 'A reservation that falls through is recorded');
    items.set('MLA1', item('MLA1'));
    await notify('MLA1');
    await runDeferred();
    assert.deepEqual(await events('MLA1'), ['closed'], 'A closed listing that comes back is recorded, however old');
    assert.ok(
      (await query('SELECT * FROM public.inventory_alert_events')).every(({ state }) => state === 'pending'),
      'Without alert email configuration nothing is matched',
    );
  });

  // Forged and repeated notifications. Mercado Libre sends many copies of one change: a copy of work
  // already queued costs one statement, with no new revision, drain or read.
  it('coalesces copies of a notification into one drain and one read', async () => {
    state.deferred.length = 0;
    calls.item.length = 0;
    items.set('MLA30', item('MLA30'));
    for (let i = 0; i < 5; i++) assert.equal((await notify('MLA30')).status, 200);
    assert.equal(state.deferred.length, 1, 'Five copies start one drain');
    assert.equal(Number((await job('MLA30')).revision), 1, 'Copies of due work add no revision');
    await runDeferred();
    assert.deepEqual(calls.item, ['MLA30'], 'and one read');
    assert.equal((await row('MLA30')).status, 'active');
  });

  it('still reads an item again when notified during a read', async () => {
    await query(
      "UPDATE public.catalog_sync_jobs SET revision = revision + 1, lease_id = $1, lease_until = now() + interval '1 minute' WHERE publication_id = 'MLA30'",
      ['00000000-0000-4000-8000-000000000004'],
    );
    const reading = Number((await job('MLA30')).revision);
    await notify('MLA30');
    assert.equal(Number((await job('MLA30')).revision), reading + 1, 'A notification during a read adds a revision');
    assert.equal(state.deferred.length, 1);
    await query(
      "UPDATE public.catalog_sync_jobs SET lease_id = NULL, lease_until = NULL WHERE publication_id = 'MLA30'",
    );
    await runDeferred();
    assert.equal(Number((await job('MLA30')).processed_revision), reading + 1);
  });

  it('drains due work no worker picked up, and keeps a backoff', async () => {
    await store.enqueueCatalogJobs(['MLA30']);
    await notify('MLA30');
    assert.equal(state.deferred.length, 0, 'A drain is already on its way');
    await query(
      "UPDATE public.catalog_sync_jobs SET next_attempt_at = now() - interval '3 minutes' WHERE publication_id = 'MLA30'",
    );
    await notify('MLA30');
    assert.equal(state.deferred.length, 1, 'Overdue work gets a drain');
    state.deferred.length = 0;
    await query(
      "UPDATE public.catalog_sync_jobs SET next_attempt_at = now() + interval '10 minutes' WHERE publication_id = 'MLA30'",
    );
    await notify('MLA30');
    assert.equal(state.deferred.length, 0, 'A notification does not cut a backoff short');
    assert.ok((await job('MLA30')).next_attempt_at > new Date());
    await query("UPDATE public.catalog_sync_jobs SET next_attempt_at = now() WHERE publication_id = 'MLA30'");
  });

  it('runs one webhook drain at a time, which finds work queued while it held the lease', async () => {
    const otherDrain = '00000000-0000-4000-8000-000000000005';
    assert.equal(await store.acquireNotificationDrain(otherDrain), true);
    assert.equal(await store.acquireNotificationDrain('00000000-0000-4000-8000-000000000006'), false);
    calls.item.length = 0;
    await sync.runCatalogSyncWorkSafely();
    assert.deepEqual(calls.item, [], 'While another drain runs, a second one reads nothing');
    await query(
      "UPDATE public.catalog_sync_runs SET lease_until = now() - interval '1 second' WHERE id = 'notification_drain'",
    );
    items.set('MLA31', item('MLA31'));
    state.beforeQuery = async text => {
      if (!text.includes("id = 'notification_drain'") || !text.includes('last_completed_at')) return;
      state.beforeQuery = null;
      // Arrives after the drain found nothing more, just before it lets go: its own drain would find
      // the lease taken.
      await notify('MLA31');
    };
    await sync.runCatalogSyncWorkSafely();
    state.deferred.length = 0;
    assert.deepEqual(calls.item, ['MLA30', 'MLA31'], 'An expired lease is taken over, and late work is still drained');
    assert.equal((await row('MLA31')).status, 'active');
    assert.equal(
      (await query("SELECT lease_id FROM public.catalog_sync_runs WHERE id = 'notification_drain'"))[0].lease_id,
      null,
    );
  });

  // An item a read found to belong to another seller, or missing, is not read again for a while, unless
  // it is stored. The reconciliation ignores the skip.
  it('skips items of other sellers for a day and missing items for an hour', async () => {
    calls.item.length = 0;
    items.set('MLA32', item('MLA32', { seller_id: 999 }));
    await notify('MLA32');
    await notify('MLA33');
    await runDeferred();
    const hours = async id => ((await job(id)).skip_until - Date.now()) / 3_600_000;
    assert.ok((await hours('MLA32')) > 23.9 && (await hours('MLA32')) <= 24, 'Another seller: skipped for a day');
    assert.ok((await hours('MLA33')) > 0.9 && (await hours('MLA33')) <= 1, 'Missing: skipped for an hour');
    for (let i = 0; i < 3; i++) {
      await notify('MLA32');
      await notify('MLA33');
    }
    assert.equal(state.deferred.length, 0, 'Repeats start nothing');
    assert.deepEqual(calls.item, ['MLA32', 'MLA33'], 'and read nothing');
    await query(
      "UPDATE public.catalog_sync_jobs SET skip_until = now() - interval '1 second' WHERE publication_id = 'MLA33'",
    );
    await notify('MLA33');
    assert.equal(state.deferred.length, 1, 'After the skip, the item is read again');
    await runDeferred();
  });

  it('never skips a stored vehicle, and lets the reconciliation clear a skip', async () => {
    items.delete('MLA30');
    await notify('MLA30');
    await runDeferred();
    assert.equal((await row('MLA30')).status, 'closed');
    assert.equal((await job('MLA30')).skip_until, null, 'A stored vehicle that disappears is closed, never skipped');
    await query(
      "UPDATE public.catalog_sync_jobs SET skip_until = now() + interval '1 day' WHERE publication_id = 'MLA30'",
    );
    await notify('MLA30');
    assert.equal(state.deferred.length, 1, 'A skip never applies to a stored vehicle');
    await runDeferred();
    items.set('MLA33', item('MLA33'));
    await notify('MLA33');
    assert.equal(state.deferred.length, 0);
    assert.ok((await sync.reconcileCatalog()).enqueued >= 1);
    assert.equal((await job('MLA33')).skip_until, null, "The seller's own listing clears the skip");
    await sync.runCatalogSyncWork();
    assert.equal((await row('MLA33')).status, 'active');
  });

  // Mercado Libre's notification addresses: any other source is queued (never lost, in case the list
  // is outdated) but deferred. The webhook never drains it; the daily cron does, after other work.
  it('defers notifications from unlisted addresses to the cron', async () => {
    vi.stubEnv('MERCADO_LIBRE_WEBHOOK_IPS', '54.88.218.97,18.215.140.160');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const notifyFrom = (id, address) =>
      webhook.POST(
        new Request('https://example.test/api/mercado-libre/webhook', {
          method: 'POST',
          headers: { 'x-vercel-forwarded-for': address },
          body: JSON.stringify({ topic: 'items', resource: `/items/${id}`, user_id: 123, application_id: 456 }),
        }),
      );
    items.set('MLA34', item('MLA34'));
    calls.item.length = 0;
    assert.equal((await notifyFrom('MLA34', '203.0.113.9')).status, 200);
    assert.equal((await notifyFrom('MLA34', '203.0.113.9')).status, 200);
    assert.equal((await job('MLA34')).deferred, true);
    assert.equal(state.deferred.length, 0, 'An unlisted source starts no drain');
    await sync.runCatalogSyncWorkSafely();
    assert.deepEqual(calls.item, [], 'and the webhook drain never reads its items');
    assert.equal((await store.readSyncHealth()).jobs.deferred, 1);
    await notifyFrom('MLA34', '54.88.218.97');
    assert.equal((await job('MLA34')).deferred, false, 'A listed source vouches for the item');
    assert.equal(state.deferred.length, 1);
    await runDeferred();
    assert.equal((await row('MLA34')).status, 'active');
    await query(
      "UPDATE public.catalog_sync_jobs SET revision = revision + 1, lease_id = $1, lease_until = now() + interval '1 minute' WHERE publication_id = 'MLA34'",
      ['00000000-0000-4000-8000-000000000008'],
    );
    await notifyFrom('MLA34', '203.0.113.9');
    assert.equal(state.deferred.length, 0, 'An unlisted source never starts a drain, even for an item being read');
    assert.equal((await job('MLA34')).deferred, false, 'nor downgrades work a listed source queued');
    await query(
      "UPDATE public.catalog_sync_jobs SET lease_id = NULL, lease_until = NULL WHERE publication_id = 'MLA34'",
    );
    await notifyFrom('MLA35', '203.0.113.9');
    await query(
      "UPDATE public.catalog_sync_jobs SET next_attempt_at = now() - interval '1 hour' WHERE publication_id = 'MLA35'",
    );
    await store.enqueueCatalogJobs(['MLA34']);
    calls.item.length = 0;
    await sync.runCatalogSyncWork();
    assert.deepEqual(
      calls.item.filter(id => ['MLA34', 'MLA35'].includes(id)),
      ['MLA34', 'MLA35'],
      'The cron reads deferred items last',
    );
  });

  // The daily reconciliation bounds the queue. It deletes only jobs of items never stored, never one
  // being read or touched since it started, and never a catalog row.
  it('prunes jobs nothing needs during the reconciliation', async () => {
    const old = "now() - interval '2 hours'";
    await query(`INSERT INTO public.catalog_sync_jobs (publication_id, revision, processed_revision, last_error, skip_until, deferred,
        lease_id, lease_until, updated_at) VALUES
      ('MLA40', 1, 1, NULL, NULL, false, NULL, NULL, ${old}),
      ('MLA41', 1, 1, NULL, now() + interval '1 hour', false, NULL, NULL, ${old}),
      ('MLA42', 1, 1, 'catalog_query:http_error:500', NULL, false, NULL, NULL, ${old}),
      ('MLA43', 1, 1, 'catalog_query:http_error:500', NULL, false, NULL, NULL, now() - interval '15 days'),
      ('MLA44', 2, 1, NULL, NULL, false, NULL, NULL, ${old}),
      ('MLA45', 2, 1, NULL, NULL, true, NULL, NULL, ${old}),
      ('MLA46', 2, 1, NULL, NULL, true, NULL, NULL, ${old}),
      ('MLA47', 2, 1, NULL, NULL, false, '00000000-0000-4000-8000-000000000007', now() + interval '1 minute', ${old}),
      ('MLA48', 1, 1, NULL, NULL, false, NULL, NULL, now() + interval '1 minute')`);
    await query(`UPDATE public.catalog_sync_jobs SET processed_revision = revision, last_error = 'catalog_query:http_error:500',
      updated_at = now() - interval '30 days' WHERE publication_id = 'MLA4'`);
    items.set('MLA46', item('MLA46'));
    const jobIds = async () =>
      new Set(
        (await query('SELECT publication_id FROM public.catalog_sync_jobs')).map(
          ({ publication_id }) => publication_id,
        ),
      );
    const storedRows = async () => (await query('SELECT publication_id FROM public.catalog_publications')).length;
    const storedBefore = await storedRows();
    // A scan that stopped early proves nothing about deferred items.
    mercadoLibre.listTotal = items.size + 1;
    await sync.reconcileCatalog();
    mercadoLibre.listTotal = null;
    assert.ok((await jobIds()).has('MLA45'), 'An incomplete listing keeps deferred jobs');
    assert.equal((await jobIds()).has('MLA40'), false, 'A finished job of an item never stored goes regardless');
    assert.equal((await jobIds()).has('MLA43'), false, 'So does one given up more than two weeks ago');
    await query(
      `UPDATE public.catalog_sync_jobs SET updated_at = ${old}, deferred = true WHERE publication_id = 'MLA46'`,
    );
    const jobsBefore = await jobIds();
    result = await sync.reconcileCatalog();
    const jobsAfter = await jobIds();
    const deleted = [...jobsBefore].filter(id => !jobsAfter.has(id));
    assert.equal(result.pruned, deleted.length);
    assert.ok(deleted.includes('MLA45'), 'A deferred job the seller does not list is deleted');
    for (const id of ['MLA41', 'MLA42', 'MLA44', 'MLA46', 'MLA47', 'MLA48', 'MLA4', 'MLA32'])
      assert.ok(jobsAfter.has(id), `${id} is kept`);
    assert.equal(
      (await job('MLA46')).deferred,
      false,
      'A deferred item the seller lists is queued by the reconciliation',
    );
    const stored = new Set(
      (await query('SELECT publication_id FROM public.catalog_publications')).map(
        ({ publication_id }) => publication_id,
      ),
    );
    assert.equal(
      deleted.some(id => stored.has(id)),
      false,
      'No job of a stored vehicle is ever deleted',
    );
    assert.equal(await storedRows(), storedBefore, 'Pruning never touches the catalog copy');
    await sync.runCatalogSyncWork();
    assert.equal((await row('MLA46')).status, 'active');
  });

  // One item deleted or failing between the scan and the bulk read must not stop the daily repair.
  it('reads again an item the bulk read missed, without failing the run', async () => {
    items.set('MLA50', item('MLA50'));
    mercadoLibre.bulkFails.add('MLA50');
    result = await sync.reconcileCatalog();
    assert.equal(result.unread, 1);
    const job50 = await job('MLA50');
    assert.ok(
      Number(job50.revision) > Number(job50.processed_revision),
      'The unread item is queued, though never stored',
    );
    const logged = vi
      .mocked(console.error)
      .mock.calls.map(([line]) => JSON.parse(line))
      .find(({ event }) => event === 'catalog_reconciliation_unread');
    assert.deepEqual(
      { ...logged, incidentId: undefined, occurredAt: undefined },
      {
        event: 'catalog_reconciliation_unread',
        publicationId: 'MLA50',
        incidentId: undefined,
        occurredAt: undefined,
        stage: 'catalog_query',
        code: 'http_error',
        httpStatus: 404,
      },
    );
    const run = (await query("SELECT * FROM public.catalog_sync_runs WHERE id = 'reconciliation'"))[0];
    assert.ok(run.last_completed_at > run.last_failed_at, 'The run completes');
    calls.item.length = 0;
    await sync.runCatalogSyncWork();
    assert.ok(calls.item.includes('MLA50'), 'Its own job reads it');
    assert.equal((await row('MLA50')).status, 'active');
    mercadoLibre.bulkFails.clear();
  });

  it('never prunes deferred jobs after a partial bulk read', async () => {
    await query(`INSERT INTO public.catalog_sync_jobs (publication_id, revision, processed_revision, deferred, updated_at)
      VALUES ('MLA51', 2, 1, true, now() - interval '2 hours')`);
    const jobIds = async () =>
      new Set(
        (await query('SELECT publication_id FROM public.catalog_sync_jobs')).map(
          ({ publication_id }) => publication_id,
        ),
      );
    // The scan total can be below what it listed, so the item count alone would call the listing complete.
    mercadoLibre.bulkFails.add('MLA4');
    mercadoLibre.listTotal = items.size - 1;
    result = await sync.reconcileCatalog();
    assert.equal(result.unread, 1);
    assert.ok((await jobIds()).has('MLA51'), 'A listing with an unread item keeps deferred jobs');
    mercadoLibre.bulkFails.clear();
    result = await sync.reconcileCatalog();
    mercadoLibre.listTotal = null;
    assert.equal((await jobIds()).has('MLA51'), false, 'A complete listing still prunes them');
    await sync.runCatalogSyncWork();
  });

  describe('page cache', () => {
    // The two statements pages read the copy with (listActiveCatalogVehicles, findCatalogPublication).
    let pageReads = 0;
    const slug = 'toyota-corolla-xei-mla70';
    const expiredTags = () => dataCache.expired.map(([tag]) => tag).sort();
    const pageTags = ['catalog:active', 'catalog:publication:MLA70'];
    const pageView = async () => ({
      listed: (await catalog.listCatalogVehicles()).filter(vehicle => vehicle.slug === slug),
      vehicle: await catalog.findCatalogVehicle(slug),
    });
    beforeEach(() => {
      Object.assign(dataCache, { enabled: true, expiryFails: false });
      dataCache.entries.clear();
      dataCache.expired.length = 0;
      pageReads = 0;
      state.beforeQuery = text => {
        if (text.startsWith('SELECT publication_id, slug, status, vehicle')) pageReads++;
      };
    });
    afterEach(() => {
      Object.assign(dataCache, { enabled: false, expiryFails: false });
      state.beforeQuery = null;
    });

    it('serves page reads from the cache until a write changes the publication', async () => {
      assert.equal((await pageView()).vehicle, undefined);
      items.set('MLA70', item('MLA70'));
      await notify('MLA70');
      await runDeferred();
      assert.deepEqual(expiredTags(), pageTags, 'A new row expires its page and the list');
      assert.ok(
        dataCache.expired.every(([, profile]) => profile?.expire === 0),
        'The next view waits for fresh data instead of being served the old entry',
      );
      assert.equal((await pageView()).vehicle.price, 20000, 'The missing publication cached before is read again');
      pageReads = 0;
      const view = await pageView();
      assert.equal(view.listed.length, 1);
      assert.equal(pageReads, 0, 'Repeated views never reach the database');

      dataCache.expired.length = 0;
      await notify('MLA70');
      await runDeferred();
      assert.ok(calls.item.at(-1) === 'MLA70' && (await job('MLA70')).attempts === 0, 'The item was read again');
      assert.deepEqual(dataCache.expired, [], 'An identical read changes nothing, so nothing expires');
      await sync.reconcileCatalog();
      await query(
        "UPDATE public.catalog_publications SET synced_at = now() - interval '2 days' WHERE publication_id = 'MLA70'",
      );
      await sync.reconcileCatalog();
      await sync.runCatalogSyncWork();
      assert.deepEqual(dataCache.expired, [], 'Nor does the daily refresh of an unchanged row');
      pageReads = 0;
      assert.deepEqual(await pageView(), view);
      assert.equal(pageReads, 0);

      items.set('MLA70', item('MLA70', { price: 19000, last_updated: '2026-10-22T10:00:00.000Z' }));
      await notify('MLA70');
      await runDeferred();
      assert.deepEqual(expiredTags(), pageTags, 'A price change expires the page and the list');
      assert.equal((await pageView()).vehicle.price, 19000, 'The next view shows the new price');
      assert.equal((await pageView()).listed[0].price, 19000);

      dataCache.expired.length = 0;
      items.set('MLA70', item('MLA70', { price: 19000, status: 'paused' }));
      await notify('MLA70');
      await runDeferred();
      assert.deepEqual(expiredTags(), pageTags);
      assert.deepEqual((await pageView()).listed, [], 'A paused car leaves the list at once');
      assert.equal((await pageView()).vehicle.status, 'paused');

      dataCache.expired.length = 0;
      items.delete('MLA70');
      await notify('MLA70');
      await runDeferred();
      assert.deepEqual(expiredTags(), pageTags, 'Closing a car expires its page');
      assert.equal((await pageView()).vehicle.status, 'closed');
      dataCache.expired.length = 0;
      await sync.enqueueCatalogSync('MLA70');
      await sync.runCatalogSyncWork();
      assert.equal((await row('MLA70')).status, 'closed');
      assert.deepEqual(dataCache.expired, [], 'A car already closed changes nothing');
    });

    it('never stores a failed read', async () => {
      faults.query = true;
      try {
        await assert.rejects(catalog.listCatalogVehicles());
        await assert.rejects(catalog.findCatalogPublication(slug));
        // The similar cars under a car page swallow the failure.
        assert.deepEqual(await catalog.listCatalogVehicles().catch(() => []), []);
      } finally {
        faults.query = false;
      }
      assert.equal(dataCache.entries.size, 0, 'Nothing is cached, not even an empty catalog');
      assert.ok((await catalog.listCatalogVehicles()).length > 0, 'The next view reads the database again');
      assert.ok(await catalog.findCatalogPublication(slug));
    });

    it('keeps the write when the expiry cannot be queued', async () => {
      items.set('MLA71', item('MLA71'));
      dataCache.expiryFails = true;
      await sync.enqueueCatalogSync('MLA71');
      await sync.runCatalogSyncWork();
      const stored = await job('MLA71');
      assert.equal(Number(stored.processed_revision), Number(stored.revision), 'The job completes');
      assert.equal(stored.last_error, null);
      assert.equal((await row('MLA71')).status, 'active');
      assert.ok(
        console.error.mock.calls.some(([line]) => JSON.parse(line).event === 'catalog_cache_expiry_failure'),
        'The failure is logged',
      );
    });

    it('does not cache the deployed backend read by local development', async () => {
      vi.stubEnv('MERCADO_LIBRE_BACKEND_URL', 'https://backend.example.test');
      vi.stubEnv('MERCADO_LIBRE_CATALOG_API_KEY', apiKey);
      const fetch = vi.fn(async () => Response.json({ vehicles: [] }));
      vi.stubGlobal('fetch', fetch);
      await catalog.listCatalogVehicles();
      await catalog.listCatalogVehicles();
      assert.equal(fetch.mock.calls.length, 2, 'Every view shows the copy as the backend has it');
      assert.equal(dataCache.entries.size, 0);
    });
  });
});
