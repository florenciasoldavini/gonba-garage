import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import * as subscriptions from '@/lib/alerts/subscriptions';
import { POST as inventoryRoute } from '@/app/api/inventory-alerts/route';
import { POST as priceRoute } from '@/app/api/price-alerts/route';
import { migrate, pgliteSession, readMigrations } from '../../scripts/migration-runner.mjs';
import { createDatabase, createSql } from '../helpers/postgres.mjs';
import { checkInventoryStorage, checkPriceStorage } from './storage-scenarios.mjs';

// Real SQL, signup limiter and storage behind both routes on local PostgreSQL (PGlite), with alert
// emails not configured (demo mode).
const state = vi.hoisted(() => ({ db: null }));
vi.mock('next/server', async importOriginal => ({ ...await importOriginal(), after: () => {} }));
vi.mock('@/lib/alerts/database', () => ({ getAlertsSql: () => state.sql, isAlertsDatabaseConfigured: () => true }));
vi.mock('@/lib/alerts/price-delivery', () => ({}));
vi.mock('@/lib/alerts/confirmation', () => ({ sendSignupConfirmationSafely: async () => assert.fail('Demo mode sends no confirmation') }));
vi.mock('@/lib/integrations/mercado-libre/access-token', () => ({}));
vi.mock('@/lib/integrations/mercado-libre/oauth', () => ({}));
vi.mock('@/lib/integrations/mercado-libre/catalog', () => ({
  findCatalogVehicle: async slug => ({ slug, price: 100, currency: 'USD', status: 'active' }),
}));

const sql = createSql(() => state.db);
state.sql = sql;

beforeEach(() => {
  vi.stubEnv('ALERTS_SIGNING_SECRET', 'test-secret-never-used-outside-tests-123456');
  vi.stubEnv('RESEND_API_KEY', undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('alert migrations', () => {
  beforeAll(async () => {
    state.db = new PGlite();
    // Subscriptions created before double opt-in must stay active (grandfathered as confirmed).
    const migrations = readMigrations();
    await migrate(pgliteSession(state.db), migrations.slice(0, 2));
    await state.db.exec(`INSERT INTO public.vehicle_inventory_alerts (email) VALUES ('legacy@example.invalid');
      INSERT INTO public.vehicle_price_alerts (email, vehicle_slug, current_price, currency) VALUES ('legacy@example.invalid', 'legacy-mla1', 1, 'USD')`);
    await migrate(pgliteSession(state.db), migrations);
  });
  afterAll(() => state.db.close());

  it('keeps existing rows active after the migration', async () => {
    for (const table of ['vehicle_inventory_alerts', 'vehicle_price_alerts']) {
      const legacy = (await state.db.query(`SELECT status, confirmed_at FROM public.${table} WHERE email = 'legacy@example.invalid'`)).rows;
      assert.deepEqual(legacy, [{ status: 'active', confirmed_at: null }], `${table}: existing rows stay active after the migration`);
    }
  });

  // Code deployed before this migration inserts without a status; those rows must stay active.
  it('is safe to apply before deploying the new code', async () => {
    await state.db.exec(`INSERT INTO public.vehicle_inventory_alerts (email) VALUES ('old-code@example.invalid');
      INSERT INTO public.vehicle_price_alerts (email, vehicle_slug, current_price, currency) VALUES ('old-code@example.invalid', 'old-code-mla2', 1, 'USD')`);
    for (const table of ['vehicle_inventory_alerts', 'vehicle_price_alerts']) {
      const rows = (await state.db.query(`SELECT status FROM public.${table} WHERE email = 'old-code@example.invalid'`)).rows;
      assert.deepEqual(rows, [{ status: 'active' }], `${table}: the migration is safe to apply before deploying the new code`);
    }
  });
});

describe('alert storage', () => {
  beforeAll(async () => { state.db = await createDatabase(); });
  afterAll(() => state.db.close());

  it('deduplicates concurrent searches and confirms them once per generation', () => checkInventoryStorage(sql, subscriptions));

  it('keeps an active price baseline and needs a new confirmation after cancelling', () => checkPriceStorage(sql, subscriptions));

  it('keeps SQL parameters as literal data', async () => {
    const malicious = { email: 'quoted@example.invalid', query: "'; DROP TABLE vehicle_inventory_alerts; --", make: '',
      transmission: '', bodyType: '', fuel: '', minPrice: 0, maxPrice: 0, minMileage: 0, maxMileage: 0 };
    await subscriptions.saveInventorySubscription(malicious);
    const rows = await sql`SELECT search_query FROM public.vehicle_inventory_alerts WHERE email = ${malicious.email}`;
    assert.equal(rows[0].search_query, malicious.query, 'SQL parameters must stay literal data');
  });

  it('enforces its constraints in the database', async () => {
    await assert.rejects(async () => sql`INSERT INTO public.vehicle_inventory_alerts (email, min_price, max_price)
      VALUES ('invalid-bounds@example.invalid', 100, 10)`, /check constraint/);
    await assert.rejects(async () => sql`INSERT INTO public.vehicle_price_alerts (email, vehicle_slug, current_price, currency, status)
      VALUES ('invalid-status@example.invalid', 'a', 1, 'USD', 'confirmed')`, /check constraint/);
  });
});

// Each step continues from the windows and signups the previous one left.
describe('signup limits', () => {
  const routes = { inventory: inventoryRoute, price: priceRoute };
  let counter = 0;
  const signup = async (scope, { email = `limit-${counter++}@example.invalid`, ip = `198.51.100.${counter % 250}` } = {}) => {
    const body = scope === 'price' ? { email, vehicleSlug: `demo-car-${counter++}` } : { email, query: `search ${counter++}` };
    return routes[scope](new Request('https://example.test/api/alerts', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `${ip}, 10.0.0.1` }, body: JSON.stringify(body) }));
  };
  const statuses = async (count, next) => { const result = []; for (let i = 0; i < count; i++) result.push((await next(i)).status); return result; };
  const resetWindows = () => sql`DELETE FROM public.price_alert_signup_windows`;

  beforeAll(async () => { state.db = await createDatabase(); });
  afterAll(() => state.db.close());

  describe.each([['inventory', 'price'], ['price', 'inventory']])('%s endpoint', (scope, other) => {
    it('limits each IP, IPv6 per /64, with its own bucket per endpoint', async () => {
      await resetWindows();
      assert.deepEqual(new Set(await statuses(20, () => signup(scope, { ip: '203.0.113.7' }))), new Set([201]));
      const limited = await signup(scope, { ip: '203.0.113.7' });
      assert.equal(limited.status, 429, `${scope}: per-IP limit`);
      assert.equal((await limited.json()).message, 'Recibimos demasiadas solicitudes. Probá más tarde.');
      assert.equal((await signup(scope, { ip: '203.0.113.8' })).status, 201, `${scope}: other IPs are unaffected`);
      assert.equal((await signup(other, { ip: '203.0.113.7' })).status, 201, `${scope}: the other endpoint keeps its own IP bucket`);
      await statuses(20, () => signup(scope, { ip: '2001:db8:1:2::1' }));
      assert.equal((await signup(scope, { ip: '2001:db8:1:2:ffff::9' })).status, 429, `${scope}: IPv6 is limited per /64`);
      assert.equal((await signup(scope, { ip: '2001:db8:1:3::1' })).status, 201);
    });

    it('limits each email per endpoint, in windows that expire', async () => {
      await resetWindows();
      const email = `victim-${scope}@example.invalid`;
      assert.deepEqual(new Set(await statuses(5, i => signup(scope, { email, ip: `192.0.2.${i}` }))), new Set([201]));
      assert.equal((await signup(scope, { email, ip: '192.0.2.200' })).status, 429, `${scope}: per-email limit`);
      assert.equal((await signup(other, { email, ip: '192.0.2.201' })).status, 201, `${scope}: per-email buckets are per endpoint`);
      await sql`UPDATE public.price_alert_signup_windows SET started_at = now() - interval '61 minutes'`;
      assert.equal((await signup(scope, { email, ip: '192.0.2.202' })).status, 201, `${scope}: windows expire`);
    });

    it('applies a global limit that cannot exhaust the other endpoint', async () => {
      await resetWindows();
      assert.deepEqual(new Set(await statuses(100, i => signup(scope, { ip: `10.${scope.length}.${i}.1` }))), new Set([201]));
      assert.equal((await signup(scope, { ip: '10.250.0.1' })).status, 429, `${scope}: global limit`);
      assert.equal((await signup(other, { ip: '10.250.0.1' })).status, 201, `${scope}: one endpoint cannot exhaust the other`);
    });
  });

  it('hashes rate-limit keys and stores demo signups as pending', async () => {
    const keys = (await sql`SELECT key FROM public.price_alert_signup_windows`).map(row => row.key).join(' ');
    assert.doesNotMatch(keys, /@|203\.0\.113|10\.250|2001:db8/, 'Rate-limit keys never contain raw emails or IPs');
    assert.equal((await sql`SELECT count(*)::int AS n FROM public.vehicle_inventory_alerts WHERE email LIKE 'limit-%' AND status <> 'pending'`)[0].n, 0,
      'Demo signups are stored as pending');
  });

  it('skips per-IP buckets without a signing secret but keeps the global one', async () => {
    await resetWindows();
    vi.stubEnv('ALERTS_SIGNING_SECRET', undefined);
    assert.deepEqual(new Set(await statuses(30, () => signup('inventory', { ip: '203.0.113.9' }))), new Set([201]),
      'Without a signing secret (demo only) per-IP buckets are skipped');
    await sql`UPDATE public.price_alert_signup_windows SET attempts = 100 WHERE key = 'inventory:global'`;
    assert.equal((await signup('inventory')).status, 429, 'The global bucket still applies without a signing secret');
  });
});
