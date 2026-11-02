import assert from 'node:assert/strict';
import { afterAll, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import { mapMercadoLibreItemToVehicle } from '@/features/vehicles/data/mercado-libre-vehicle-mapper';
import * as rows from '@/lib/database-rows';
import * as catalogRows from '@/lib/catalog/rows';
import * as alertRows from '@/lib/alerts/rows';
import * as store from '@/lib/catalog/store';
import * as delivery from '@/lib/alerts/inventory-delivery';
import { migrate, pgliteSession, readMigrations } from '../../scripts/migration-runner.mjs';
import { createDatabase, createSql } from '../helpers/postgres.mjs';

// Row parsers at the data-access boundary: valid rows, older shapes and malformed rows, then the
// skip-or-fail behaviour of real reads against PostgreSQL (PGlite). Fixtures live here only.
const state = vi.hoisted(() => ({ sql: null }));
vi.mock('@/lib/database', () => ({ getSql: () => state.sql, isDatabaseConfigured: () => true }));
vi.mock('@/lib/integrations/mep-quote', () => ({ getMepQuote: async () => null }));

const ALERT = '11111111-1111-4111-8111-111111111111';
const GENERATION = '22222222-2222-4222-8222-222222222222';
const ADDRESS = 'buyer@example.invalid';

const item = (id, changes = {}) => ({
  id, seller_id: 123, category_id: 'MLA1744', title: 'Toyota Corolla XEi', price: 20000, currency_id: 'USD', status: 'active',
  permalink: `https://auto.mercadolibre.com.ar/${id}`, pictures: [{ secure_url: 'https://http2.mlstatic.com/D_NQ_NP_1-O.jpg' }],
  attributes: [
    { id: 'BRAND', name: 'Marca', value_name: 'Toyota' }, { id: 'MODEL', name: 'Modelo', value_name: 'Corolla' },
    { id: 'TRIM', name: 'Versión', value_name: 'XEi' }, { id: 'VEHICLE_YEAR', name: 'Año', value_name: '2021' },
    { id: 'KILOMETERS', name: 'Kilómetros', value_struct: { number: 45000, unit: 'km' } },
    { id: 'HAS_ABS_BRAKES', name: 'Frenos ABS', value_name: 'Sí' },
  ],
  start_time: new Date().toISOString(), last_updated: '2026-10-20T10:00:00.000Z', ...changes,
});

const without = (object, ...keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));
const ownColumns = ['slug', 'status', 'updatedAt'];

/** The `vehicle` column exactly as savePublication writes it. */
const storedVehicle = (id, changes) => JSON.parse(JSON.stringify(without(mapMercadoLibreItemToVehicle(item(id, changes)).vehicle, ...ownColumns)));

const catalogRow = (id, vehicle = storedVehicle(id)) => ({
  publication_id: id, slug: `toyota-corolla-xei-${id.toLowerCase()}`, status: 'active', vehicle,
  content_changed_at: new Date('2026-10-21T10:00:00.000Z'),
  source: { id, title: 'Toyota Corolla XEi', pictures: [{ secure_url: 'https://http2.mlstatic.com/D_NQ_NP_1-O.jpg' }],
    attributes: [{ id: 'BRAND', name: 'Marca', value_name: 'Toyota' }], permalink: `https://auto.mercadolibre.com.ar/${id}` },
  description: { plain_text: 'Único dueño.' },
});

/** The field an invalid row is reported for. */
function invalidField(parse, row) {
  try { rows.parseRow('test_table', row, parse); } catch (error) {
    assert.ok(error instanceof rows.InvalidRowError, `Expected an InvalidRowError, got ${error}`);
    return error.field;
  }
  assert.fail('The row was accepted');
}

// The structured invalid-row logs. Workers also log their own retries.
const logged = () => console.error.mock.calls.filter(([line]) => String(line).startsWith('{')).map(([line]) => JSON.parse(line));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('row readers', () => {
  const read = (reader, value) => rows.parseRow('test_table', { value }, row => reader(row.value, 'value'));

  it('reads what both drivers return for each column type', () => {
    assert.equal(read(rows.integer, 7), 7, 'integer columns are numbers');
    assert.equal(read(rows.integer, '9007199254740991'), Number.MAX_SAFE_INTEGER, 'bigint columns are strings');
    assert.equal(read(rows.decimal, '20000.50'), 20000.5, 'numeric columns are strings');
    assert.equal(read(rows.timestamp, new Date('2026-10-20T10:00:00Z')).toISOString(), '2026-10-20T10:00:00.000Z');
    assert.equal(read(rows.timestamp, '2026-10-20T10:00:00Z').toISOString(), '2026-10-20T10:00:00.000Z');
    assert.equal(read(rows.optionalTimestamp, null), null);
  });

  it('rejects values of another type instead of coercing them', () => {
    for (const [reader, value] of [[rows.integer, '1.5'], [rows.integer, 1.5], [rows.integer, '12345678901234567890'],
      [rows.decimal, 'NaN'], [rows.decimal, null], [rows.number, '20000'], [rows.text, 5], [rows.text, undefined],
      [rows.timestamp, new Date('nope')], [rows.timestamp, 'yesterday'], [rows.optionalTimestamp, undefined],
      [rows.uuid, 'not-a-uuid'], [rows.publicationId, 'mla1'], [rows.boolean, 'true'], [rows.record, []],
      [rows.record, null], [rows.textList, ['a', 1]]]) {
      assert.equal(invalidField(row => reader(row.value, 'value'), { value }), 'value', `${reader.name} accepted ${String(value)}`);
    }
  });
});

describe('parseRow and parseRows', () => {
  it('fails a single read clearly, naming the table, the field and only a well-formed row ID', () => {
    const row = { publication_id: 'MLA1', vehicle: { make: 'Toyota', price: 'twenty' }, email: ADDRESS };
    assert.throws(() => rows.parseRow('catalog_publications', row, catalogRows.parseCatalogVehicle),
      { name: 'InvalidRowError', message: 'Invalid catalog_publications row: vehicle.model' });
    assert.deepEqual(logged(), [{ event: 'invalid_database_row', action: 'failed', table: 'catalog_publications',
      field: 'vehicle.model', publicationId: 'MLA1' }]);
    assert.throws(() => rows.parseRow('vehicle_price_alerts', undefined, alertRows.parseAlertEmail), { field: 'row' });
  });

  it('skips and logs invalid rows of a list, never their content', () => {
    const good = { id: ALERT, email: ADDRESS };
    const bad = { id: GENERATION, email: null };
    assert.deepEqual(rows.parseRows('vehicle_inventory_alerts', [good, bad, good], alertRows.parseAlertEmail), [ADDRESS, ADDRESS]);
    assert.deepEqual(logged(), [{ event: 'invalid_database_row', action: 'skipped', table: 'vehicle_inventory_alerts', field: 'email', id: GENERATION }]);
    // A malformed key may itself be content, so it is left out.
    rows.parseRows('vehicle_inventory_alerts', [{ id: ADDRESS, publication_id: ADDRESS }], alertRows.parseAlertEmail);
    assert.ok(console.error.mock.calls.every(([line]) => !line.includes(ADDRESS)), 'No address is ever logged');
  });

  it('lets errors other than invalid fields through', () => {
    const bug = () => { throw new TypeError('bug'); };
    assert.throws(() => rows.parseRows('test_table', [{}], bug), TypeError);
    assert.throws(() => rows.parseRow('test_table', {}, bug), TypeError);
    assert.equal(console.error.mock.calls.length, 0);
  });
});

describe('catalog row parsers', () => {
  it('reads a stored vehicle as the mapper built it', () => {
    const vehicle = without(mapMercadoLibreItemToVehicle(item('MLA1')).vehicle, ...ownColumns);
    assert.deepEqual(catalogRows.parseCatalogVehicle(catalogRow('MLA1')),
      { ...vehicle, slug: 'toyota-corolla-xei-mla1', status: 'active', updatedAt: '2026-10-21T10:00:00.000Z' });
    const publication = catalogRows.parseCatalogPublication(catalogRow('MLA1'));
    assert.deepEqual(publication.source, catalogRow('MLA1').source, 'The stored source is returned as stored');
    assert.deepEqual(publication.description, { plain_text: 'Único dueño.' });
  });

  it('keeps older but legitimate shapes working', () => {
    const vehicle = storedVehicle('MLA1', { permalink: undefined });
    assert.equal('mercadoLibreUrl' in vehicle, false, 'A listing without permalink stores no mercadoLibreUrl');
    // The mapper before whole-number parsing read "45.5" or "-1" as decimals; the old photo fallback.
    const legacy = { ...vehicle, year: 2021.5, mileageKm: -1, image: '/showroom-car.jpg', highlights: ['Frenos ABS', null] };
    const parsed = catalogRows.parseCatalogVehicle(catalogRow('MLA1', legacy));
    assert.equal(parsed.mercadoLibreUrl, undefined);
    assert.deepEqual([parsed.year, parsed.mileageKm, parsed.image, parsed.highlights], [2021.5, -1, '/showroom-car.jpg', ['Frenos ABS']]);

    const publication = catalogRows.parseCatalogPublication({ ...catalogRow('MLA1'), description: null,
      source: { ...without(catalogRow('MLA1').source, 'pictures', 'attributes'), permalink: null } });
    assert.equal(publication.description, null, 'An item without description stores none');
    assert.deepEqual([publication.source.pictures, publication.source.attributes, publication.source.permalink], [[], [], null]);

    const [id, synced] = catalogRows.parseStoredSyncState({ publication_id: 'MLA1', status: 'paused', vehicle_category: null,
      source_updated_at: null, synced_at: new Date('2026-10-21T10:00:00Z') });
    assert.deepEqual([id, synced], ['MLA1', { status: 'paused', vehicleCategory: null, sourceUpdatedAt: null,
      syncedAt: Date.parse('2026-10-21T10:00:00Z') }], 'Rows saved before categories were recorded have none');
  });

  it('rejects malformed catalog rows, naming the field', () => {
    const row = catalogRow('MLA1');
    const vehicle = changes => ({ ...row, vehicle: { ...row.vehicle, ...changes } });
    const cases = [
      [{ ...row, vehicle: null }, 'vehicle'], [{ ...row, vehicle: '{}' }, 'vehicle'],
      [vehicle({ make: undefined }), 'vehicle.make'], [vehicle({ price: '20000' }), 'vehicle.price'],
      [vehicle({ currency: 'EUR' }), 'vehicle.currency'], [vehicle({ highlights: 'ABS' }), 'vehicle.highlights'],
      [vehicle({ mercadoLibreUrl: null }), 'vehicle.mercadoLibreUrl'], [{ ...row, slug: null }, 'slug'],
      [{ ...row, status: 'reserved' }, 'status'], [{ ...row, content_changed_at: 'soon' }, 'content_changed_at'],
    ];
    for (const [invalid, field] of cases) assert.equal(invalidField(catalogRows.parseCatalogVehicle, invalid), field);
    const publication = [
      [{ ...row, source: { ...row.source, id: 'X' } }, 'source.id'],
      [{ ...row, source: { ...row.source, attributes: [{ name: 'Marca' }] } }, 'source.attributes.id'],
      [{ ...row, source: { ...row.source, pictures: ['https://example.invalid/a.jpg'] } }, 'source.pictures'],
      [{ ...row, description: { plain_text: 5 } }, 'description.plain_text'], [{ ...row, description: undefined }, 'description'],
    ];
    for (const [invalid, field] of publication) assert.equal(invalidField(catalogRows.parseCatalogPublication, invalid), field);
    assert.equal(invalidField(catalogRows.parseStoredSyncState, { publication_id: 'MLA1', status: 'active',
      vehicle_category: 'MLA1784', source_updated_at: null, synced_at: new Date() }), 'vehicle_category');
    assert.equal(invalidField(rows.parseJobLease, { publication_id: 'MLA1', revision: null, attempts: 1 }), 'revision');
  });
});

describe('alert row parsers', () => {
  it('reads alert criteria and deliveries as the drivers return them', () => {
    const alert = { id: ALERT, generation: GENERATION, search_query: '', make: 'Toyota', transmission: 'automatic', body_type: '',
      fuel: '', min_price: '0.00', max_price: '30000.00', min_mileage: 0, max_mileage: 80000 };
    assert.deepEqual(alertRows.parseInventoryAlert(alert), { id: ALERT, generation: GENERATION, criteria: { query: '', make: 'Toyota',
      transmission: 'automatic', bodyType: '', fuel: '', minPrice: null, maxPrice: 30000, minMileage: null, maxMileage: 80000 } });
    assert.equal(invalidField(alertRows.parseInventoryAlert, { ...alert, transmission: 'cvt' }), 'transmission');
    assert.equal(invalidField(alertRows.parseInventoryAlert, { ...alert, max_price: null }), 'max_price');

    const claimed = { id: ALERT, alert_id: ALERT, generation: GENERATION, kind: 'drop', price: '18000.00', previous_price: '20000.00',
      currency: 'USD', title: 'Toyota Corolla', vehicle_slug: 'toyota-corolla-mla1', attempts: 1, first_attempt_at: null, request_payload: null };
    assert.deepEqual([alertRows.parsePriceDelivery(claimed).price, alertRows.parsePriceDelivery(claimed).previous_price], [18000, 20000]);
    assert.equal(invalidField(alertRows.parsePriceDelivery, { ...claimed, kind: 'reminder' }), 'kind');
    assert.equal(invalidField(alertRows.parsePriceDelivery, { ...claimed, request_payload: { to: ADDRESS } }), 'request_payload.to');

    const event = { id: ALERT, publication_id: 'MLA1', previous_status: null, attempts: 1 };
    assert.equal(alertRows.parseInventoryEvent(event).previous_status, null, 'A new listing has no previous status');
    assert.equal(invalidField(alertRows.parseInventoryEvent, { ...event, previous_status: 'active' }), 'previous_status');
    assert.equal(invalidField(alertRows.parsePriceSignup, { id: ALERT, generation: GENERATION, status: 'notified', vehicle_title: '' }), 'status');
  });
});

describe('reads with invalid rows', () => {
  let db;
  const query = async (text, values = []) => (await db.query(text, values)).rows;
  async function save(id) {
    const lease = crypto.randomUUID();
    await store.enqueueCatalogJobs([id]);
    assert.equal((await store.leaseCatalogJob(lease)).id, id);
    assert.equal((await store.savePublication(mapMercadoLibreItemToVehicle(item(id)), 'MLA1744', lease)).saved, true);
    await store.completeCatalogJob(id, lease, 1);
  }

  beforeAll(async () => {
    db = await createDatabase();
    state.sql = createSql(() => db);
    for (const id of ['MLA1', 'MLA2', 'MLA3']) await save(id);
    // A schema change the code does not know about yet: a new status value.
    await query('ALTER TABLE public.catalog_publications DROP CONSTRAINT catalog_publications_status_check');
    await query('ALTER TABLE public.vehicle_inventory_alerts DROP CONSTRAINT vehicle_inventory_alerts_transmission_check');
  });
  afterAll(async () => { state.sql = null; await db?.close(); });

  it('lists the catalog without a corrupted car, logging only its publication ID', async () => {
    await query(`UPDATE public.catalog_publications SET vehicle = vehicle - 'make' WHERE publication_id = 'MLA2'`);
    assert.deepEqual((await store.listActiveCatalogVehicles()).map(({ mercadoLibreId }) => mercadoLibreId).sort(), ['MLA1', 'MLA3']);
    assert.deepEqual(logged(), [{ event: 'invalid_database_row', action: 'skipped', table: 'catalog_publications',
      field: 'vehicle.make', publicationId: 'MLA2' }]);
    assert.ok(!console.error.mock.calls.join('').includes('Corolla'), 'No listing content is logged');
  });

  it('fails a corrupted car page clearly and still reads the others', async () => {
    await assert.rejects(store.findCatalogPublication('MLA2'), { name: 'InvalidRowError', table: 'catalog_publications', field: 'vehicle.make' });
    assert.equal((await store.findCatalogPublication('MLA1')).vehicle.mercadoLibreId, 'MLA1');
    assert.equal(await store.findCatalogPublication('MLA9'), null, 'A missing row is still not found, not invalid');
  });

  it('leaves a row the code cannot read out of the reconciliation, which reads the item again', async () => {
    await query(`UPDATE public.catalog_publications SET status = 'reserved' WHERE publication_id = 'MLA3'`);
    assert.deepEqual([...(await store.readStoredSyncState()).keys()].sort(), ['MLA1', 'MLA2']);
    assert.deepEqual(logged().map(({ publicationId, field }) => [publicationId, field]), [['MLA3', 'status']]);
  });

  it('fails the health view clearly instead of reporting a guess', async () => {
    await assert.rejects(store.readSyncHealth(), { name: 'InvalidRowError', table: 'catalog_publications', field: 'status' });
    await query(`UPDATE public.catalog_publications SET status = 'active' WHERE publication_id = 'MLA3'`);
    const health = await store.readSyncHealth();
    assert.deepEqual([health.publications, health.jobs.pending, health.reconciliation.lastStartedAt], [{ active: 3 }, 0, null]);
  });

  it('matches the other alerts when one alert row is invalid, logging only its ID', async () => {
    const other = '33333333-3333-4333-8333-333333333333';
    await query(`INSERT INTO public.vehicle_inventory_alerts (id, generation, email, transmission, status, created_at)
      VALUES ($1, $2, $3, '', 'active', now() - interval '1 day'), ($4, $2, 'other@example.invalid', 'cvt', 'active', now() - interval '1 day')`,
    [ALERT, GENERATION, ADDRESS, other]);
    const [event] = await query(`INSERT INTO public.inventory_alert_events (publication_id) VALUES ('MLA1') RETURNING id`);
    const vehicle = (await store.findCatalogPublication('MLA1')).vehicle;
    assert.deepEqual(await delivery.matchingAlerts(vehicle, event.id), [{ id: ALERT, generation: GENERATION }]);
    assert.deepEqual(logged(), [{ event: 'invalid_database_row', action: 'skipped', table: 'vehicle_inventory_alerts',
      field: 'transmission', id: other }]);
  });

  it('retries an event whose car row is invalid instead of announcing a guess', async () => {
    await query(`UPDATE public.catalog_publications SET vehicle = vehicle - 'make' WHERE publication_id = 'MLA2'`);
    await query(`UPDATE public.inventory_alert_events SET state = 'skipped'`);
    const [{ id }] = await query(`INSERT INTO public.inventory_alert_events (publication_id) VALUES ('MLA2') RETURNING id`);
    assert.equal(await delivery.processNextEvent(), true);
    const [event] = await query('SELECT state, last_error FROM public.inventory_alert_events WHERE id = $1', [id]);
    assert.deepEqual(event, { state: 'pending', last_error: 'processing_failure' });
    assert.deepEqual(logged()[0], { event: 'invalid_database_row', action: 'failed', table: 'catalog_publications',
      field: 'vehicle.make', publicationId: 'MLA2' });
    assert.ok(console.error.mock.calls.some(([line]) => line === 'inventory_alert_match_retry'));
  });

  it('emails the other matched cars when one car row is invalid', async () => {
    vi.stubEnv('ALERTS_SIGNING_SECRET', 'test-secret-never-used-outside-tests-123456');
    vi.stubEnv('ALERTS_PUBLIC_URL', 'https://example.test');
    vi.stubEnv('ALERTS_EMAIL_FROM', 'Gonba <test@example.test>');
    vi.stubEnv('ALERTS_TEST_RECIPIENT', undefined);
    const sent = [];
    vi.stubGlobal('fetch', async (_url, options) => { sent.push(JSON.parse(options.body)); return Response.json({ id: 'mail-1' }); });
    const [{ id }] = await query(`INSERT INTO public.inventory_alert_deliveries (alert_id, generation) VALUES ($1, $2) RETURNING id`, [ALERT, GENERATION]);
    await query(`INSERT INTO public.inventory_alert_matches (alert_id, generation, publication_id, delivery_id)
      SELECT $1, $2, unnest(ARRAY['MLA1', 'MLA2', 'MLA3']), $3`, [ALERT, GENERATION, id]);
    assert.equal(await delivery.processNextDelivery(), true);
    assert.equal(sent.length, 1);
    assert.match(sent[0].subject, /^2 autos/, 'The email describes the two readable cars');
    const [stored] = await query('SELECT state, vehicle_count FROM public.inventory_alert_deliveries WHERE id = $1', [id]);
    assert.deepEqual(stored, { state: 'accepted', vehicle_count: 2 });
    assert.deepEqual(logged(), [{ event: 'invalid_database_row', action: 'skipped', table: 'catalog_publications',
      field: 'vehicle.make', publicationId: 'MLA2' }]);
  });
});

describe('older catalog rows', () => {
  it('reads a row saved before vehicle categories were recorded', async () => {
    const migrations = readMigrations();
    const before = migrations.findIndex(({ file }) => file === '20261102_catalog_vehicle_category.sql');
    const db = await createDatabase(migrations.slice(0, before));
    try {
      const source = without(catalogRow('MLA7').source, 'pictures', 'attributes');
      await db.query(`INSERT INTO public.catalog_publications (publication_id, slug, status, price, currency, vehicle, source)
        VALUES ('MLA7', 'toyota-corolla-xei-mla7', 'closed', 20000, 'USD', $1, $2)`,
      [JSON.stringify(storedVehicle('MLA7', { permalink: undefined })), JSON.stringify(source)]);
      await migrate(pgliteSession(db), migrations);
      state.sql = createSql(() => db);
      const publication = await store.findCatalogPublication('MLA7');
      assert.deepEqual([publication.vehicle.status, publication.vehicle.mercadoLibreUrl, publication.description,
        publication.source.pictures], ['closed', undefined, null, []]);
      assert.equal((await store.readStoredSyncState()).get('MLA7').vehicleCategory, null);
      assert.equal(console.error.mock.calls.length, 0);
    } finally {
      state.sql = null;
      await db.close();
    }
  });
});
