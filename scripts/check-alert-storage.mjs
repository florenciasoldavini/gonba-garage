import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import * as net from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import ts from 'typescript';

function load(path, dependencies) {
  const result = {};
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('exports', 'require', compiled)(result, id => {
    if (id === 'server-only') return {};
    assert.ok(id in dependencies, `Unexpected dependency: ${id}`);
    return dependencies[id];
  });
  return result;
}

const calls = [];
let configured = true;
let failStorage = false;
let vehicle = { slug: 'toyota-sw4-mla123', price: 49900, currency: 'USD', status: 'active' };
const { randomUUID } = crypto;
let deferred = [];
const dependencies = {
  'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) }, after: fn => deferred.push(fn) },
  '@/lib/alerts/database': { isAlertsDatabaseConfigured: () => configured },
  '@/lib/alerts/config': { alertDeliveryEnabled: () => false },
  '@/lib/alerts/price-delivery': {},
  '@/lib/alerts/signup-limit': { reserveAlertSignup: async () => true },
  '@/lib/alerts/confirmation': { sendSignupConfirmationSafely: async () => assert.fail('Demo mode sends no confirmation') },
  '@/lib/integrations/mercado-libre/access-token': {},
  '@/lib/integrations/mercado-libre/oauth': {},
  '@/lib/alerts/subscriptions': {
    saveInventorySubscription: async input => { if (failStorage) throw new Error('Private DB error'); calls.push(input); return { id: randomUUID(), generation: randomUUID(), status: 'pending' }; },
    savePriceSubscription: async input => { if (failStorage) throw new Error('Private DB error'); calls.push(input); },
  },
  '@/lib/integrations/mercado-libre/catalog': { findCatalogVehicle: async () => vehicle },
};
dependencies['@/lib/alerts/request-guard'] = load('../lib/alerts/request-guard.ts', dependencies);
const inventory = load('../app/api/inventory-alerts/route.ts', dependencies).POST;
const price = load('../app/api/price-alerts/route.ts', dependencies).POST;
const post = (body, headers = {}) => new Request('https://example.test/api/alerts', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const request = { email: ' Test@Example.invalid ', vehicleSlug: vehicle.slug };
for (const handler of [inventory, price]) {
  const before = calls.length;
  // A cross-site HTML form can only send simple content types, never application/json.
  const form = new Request('https://example.test/api/alerts', { method: 'POST', body: JSON.stringify(request) });
  assert.equal(form.headers.get('content-type'), 'text/plain;charset=UTF-8');
  assert.equal((await handler(form)).status, 415);
  assert.equal((await handler(post(request, { 'Content-Type': 'application/x-www-form-urlencoded' }))).status, 415);
  assert.equal((await handler(post(request, { Origin: 'https://attacker.test' }))).status, 403);
  assert.equal((await handler(post(request, { Origin: 'null' }))).status, 403);
  assert.equal((await handler(post(request, { Origin: 'https://attacker.test', Host: 'example.test' }))).status, 403);
  assert.equal((await handler(post(request, { 'Sec-Fetch-Site': 'cross-site' }))).status, 403);
  assert.equal(calls.length, before, 'Rejected cross-site requests must not touch storage');
  assert.equal((await handler(post(request, { 'Content-Type': 'Application/JSON; charset=utf-8' }))).status, 201);
  assert.equal((await handler(post(request, { Origin: 'https://example.test', 'Sec-Fetch-Site': 'same-origin' }))).status, 201);
  // Behind Vercel and other proxies the public host arrives in Host / X-Forwarded-Host, not request.url.
  assert.equal((await handler(post(request, { Origin: 'https://preview-abc.vercel.app',
    'X-Forwarded-Host': 'preview-abc.vercel.app' }))).status, 201);
  assert.equal((await handler(post(request, { Origin: 'http://localhost:3100', Host: 'localhost:3100' }))).status, 201);
  assert.equal(calls.length, before + 4);
}
for (const handler of [inventory, price]) {
  for (const body of [null, [], 'bad', { email: 'invalid' }]) assert.equal((await handler(post(body))).status, 400);
  const started = performance.now();
  assert.equal((await handler(post({ ...request, email: `a@${'.'.repeat(1_000_000)}@` }))).status, 400);
  assert.ok(performance.now() - started < 1000, 'Oversized emails must be rejected before the regex runs');
  const before = calls.length;
  assert.equal((await handler(post({ website: 'bot' }))).status, 201);
  assert.equal(calls.length, before, 'Honeypot must not touch storage');
  configured = false;
  assert.equal((await handler(post(request))).status, 503);
  configured = true;
}
assert.equal((await inventory(post({ ...request, minPrice: 20, maxPrice: 10 }))).status, 400);
assert.equal((await inventory(post({ ...request, maxMileage: -1 }))).status, 400);
assert.equal((await inventory(post({ ...request, transmission: 'invalid' }))).status, 400);
assert.equal((await inventory(post({ ...request, minPrice: 0, maxPrice: 100000, make: 'Toyota' }))).status, 201);
assert.equal(calls.at(-1).email, 'test@example.invalid');
assert.equal(calls.at(-1).maxPrice, 100000);
assert.equal((await price(post({ ...request, price: 1, currency: 'ARS' }))).status, 201);
assert.equal(calls.at(-1).price, 49900, 'Client cannot override the catalog price');
assert.equal(calls.at(-1).currency, 'USD');
vehicle = null;
assert.equal((await price(post(request))).status, 400);
vehicle = { ...request, slug: request.vehicleSlug, status: 'paused' };
assert.equal((await price(post(request))).status, 400);
vehicle = { slug: request.vehicleSlug, price: 49900, currency: 'USD', status: 'active' };
failStorage = true;
for (const handler of [inventory, price]) {
  const response = await handler(post(request));
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(await response.json()).includes('Private DB error'), false);
}
assert.equal(deferred.length, 0, 'Demo mode queues no confirmation email');
console.log('Alert routes: same-origin JSON only, validation, oversized email, normalized email, honeypot, missing configuration, live catalog prices and safe failures passed.');

async function checkStorage(sql, subscriptions) {
  const email = `gonba-storage-test-${randomUUID()}@example.invalid`;
  const search = { email, query: 'integration-test', make: 'Toyota', transmission: 'automatic', bodyType: '', fuel: '',
    minPrice: 0, maxPrice: 100000, minMileage: 0, maxMileage: 0 };
  try {
    const saved = await Promise.all(Array.from({ length: 3 }, () => subscriptions.saveInventorySubscription(search)));
    const inventoryRows = await sql`SELECT * FROM public.vehicle_inventory_alerts WHERE email = ${email}`;
    assert.equal(inventoryRows.length, 1, 'Concurrent subscriptions must deduplicate');
    assert.equal(Number(inventoryRows[0].max_price), 100000);
    assert.equal(inventoryRows[0].status, 'pending', 'New searches wait for email confirmation');
    assert.ok(saved.every(row => row.status === 'pending' && row.id === inventoryRows[0].id && row.generation === inventoryRows[0].generation));
    const { id, generation } = inventoryRows[0];
    assert.equal(await subscriptions.confirmInventorySubscription(id, randomUUID()), false, 'Another generation cannot confirm');
    assert.equal((await sql`SELECT status FROM public.vehicle_inventory_alerts WHERE id = ${id}`)[0].status, 'pending');
    assert.equal(await subscriptions.confirmInventorySubscription(id, generation), true);
    assert.equal(await subscriptions.confirmInventorySubscription(id, generation), true, 'Confirmation is idempotent');
    let inventory = (await sql`SELECT * FROM public.vehicle_inventory_alerts WHERE id = ${id}`)[0];
    assert.equal(inventory.status, 'active');
    assert.ok(inventory.confirmed_at, 'Confirmation time is recorded');
    assert.equal((await subscriptions.saveInventorySubscription(search)).status, 'active', 'Resubmitting keeps an active search active');
    await sql`UPDATE public.vehicle_inventory_alerts SET status = 'cancelled' WHERE id = ${id}`;
    const renewed = await subscriptions.saveInventorySubscription(search);
    assert.equal(renewed.status, 'pending', 'A cancelled search needs a new confirmation');
    assert.notEqual(renewed.generation, generation);
    assert.equal(await subscriptions.confirmInventorySubscription(id, generation), false, 'An old link cannot reactivate a new signup');
    await subscriptions.savePriceSubscription({ email, vehicleSlug: 'gonba-storage-test', price: 100, currency: 'USD' });
    let rows = await sql`SELECT * FROM public.vehicle_price_alerts WHERE email = ${email}`;
    assert.equal(rows[0].status, 'pending', 'Demo price signups are stored pending');
    await subscriptions.savePriceSubscription({ email, vehicleSlug: 'gonba-storage-test', price: 95, currency: 'USD' });
    rows = await sql`SELECT * FROM public.vehicle_price_alerts WHERE email = ${email}`;
    assert.equal(Number(rows[0].current_price), 95, 'A pending alert takes the latest catalog price');
    await sql`UPDATE public.vehicle_price_alerts SET status = 'active' WHERE email = ${email}`;
    await subscriptions.savePriceSubscription({ email, vehicleSlug: 'gonba-storage-test', price: 90, currency: 'ARS' });
    rows = await sql`SELECT * FROM public.vehicle_price_alerts WHERE email = ${email}`;
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].current_price), 95, 'Repeated requests must preserve an active price baseline');
    assert.equal(rows[0].currency, 'USD');
    assert.equal(rows[0].status, 'active');
    await sql`UPDATE public.vehicle_price_alerts SET status = 'cancelled' WHERE email = ${email}`;
    await subscriptions.savePriceSubscription({ email, vehicleSlug: 'gonba-storage-test', price: 90, currency: 'ARS' });
    rows = await sql`SELECT * FROM public.vehicle_price_alerts WHERE email = ${email}`;
    assert.equal(rows[0].status, 'pending', 'Re-subscribing after cancellation needs a new confirmation');
    assert.equal(Number(rows[0].current_price), 90);
    assert.equal(rows[0].currency, 'ARS');
  } finally {
    await sql`DELETE FROM public.vehicle_price_alerts WHERE email = ${email}`;
    await sql`DELETE FROM public.vehicle_inventory_alerts WHERE email = ${email}`;
  }
  console.log('Storage: pending signups, scoped idempotent confirmation, concurrent deduplication, price baselines and re-subscription passed; test data removed.');
}

if (process.argv.includes('--live')) {
  if (existsSync('.env.local')) process.loadEnvFile('.env.local');
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for the live storage test');
  const driver = await import('@neondatabase/serverless');
  const database = load('../lib/alerts/database.ts', { '@neondatabase/serverless': driver });
  const subscriptions = load('../lib/alerts/subscriptions.ts', { './database': database });
  await checkStorage(database.getAlertsSql(), subscriptions);
} else {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    const migrations = ['20261028_alert_subscriptions.sql', '20261029_price_alert_delivery.sql', '20261030_alert_signup_confirmation.sql']
      .map(file => readFileSync(new URL(`../database/migrations/${file}`, import.meta.url), 'utf8'));
    // Subscriptions created before double opt-in must stay active (grandfathered as confirmed).
    for (const migration of migrations.slice(0, 2)) await db.exec(migration);
    await db.exec(`INSERT INTO public.vehicle_inventory_alerts (email) VALUES ('legacy@example.invalid');
      INSERT INTO public.vehicle_price_alerts (email, vehicle_slug, current_price, currency) VALUES ('legacy@example.invalid', 'legacy-mla1', 1, 'USD')`);
    for (let i = 0; i < 2; i++) for (const migration of migrations) await db.exec(migration);
    const sql = async (strings, ...values) => {
      const text = strings.reduce((result, part, index) => result + part + (index < values.length ? '$' + (index + 1) : ''), '');
      return (await db.query(text, values)).rows;
    };
    for (const table of ['vehicle_inventory_alerts', 'vehicle_price_alerts']) {
      const legacy = (await db.query(`SELECT status, confirmed_at FROM public.${table} WHERE email = 'legacy@example.invalid'`)).rows;
      assert.deepEqual(legacy, [{ status: 'active', confirmed_at: null }], `${table}: existing rows stay active after the migration`);
    }
    // Code deployed before this migration inserts without a status; those rows must stay active.
    await db.exec(`INSERT INTO public.vehicle_inventory_alerts (email) VALUES ('old-code@example.invalid');
      INSERT INTO public.vehicle_price_alerts (email, vehicle_slug, current_price, currency) VALUES ('old-code@example.invalid', 'old-code-mla2', 1, 'USD')`);
    for (const table of ['vehicle_inventory_alerts', 'vehicle_price_alerts']) {
      const rows = (await db.query(`SELECT status FROM public.${table} WHERE email = 'old-code@example.invalid'`)).rows;
      assert.deepEqual(rows, [{ status: 'active' }], `${table}: the migration is safe to apply before deploying the new code`);
    }
    const subscriptions = load('../lib/alerts/subscriptions.ts', { './database': { getAlertsSql: () => sql } });
    await checkStorage(sql, subscriptions);
    const malicious = { email: 'quoted@example.invalid', query: "'; DROP TABLE vehicle_inventory_alerts; --", make: '',
      transmission: '', bodyType: '', fuel: '', minPrice: 0, maxPrice: 0, minMileage: 0, maxMileage: 0 };
    await subscriptions.saveInventorySubscription(malicious);
    const rows = await sql`SELECT search_query FROM public.vehicle_inventory_alerts WHERE email = ${malicious.email}`;
    assert.equal(rows[0].search_query, malicious.query, 'SQL parameters must stay literal data');
    await assert.rejects(sql`INSERT INTO public.vehicle_inventory_alerts (email, min_price, max_price)
      VALUES ('invalid-bounds@example.invalid', 100, 10)`, /check constraint/);
    await assert.rejects(sql`INSERT INTO public.vehicle_price_alerts (email, vehicle_slug, current_price, currency, status)
      VALUES ('invalid-status@example.invalid', 'a', 1, 'USD', 'confirmed')`, /check constraint/);
    console.log('Local PostgreSQL: rerunnable migrations, grandfathered active rows, real SQL, injection safety and database constraints passed.');

    // Real limiter and storage behind both routes, in demo mode (delivery disabled).
    process.env.ALERTS_SIGNING_SECRET = 'test-secret-never-used-outside-tests-123456';
    const config = load('../lib/alerts/config.ts', { 'node:crypto': crypto });
    const limiter = load('../lib/alerts/signup-limit.ts', { 'node:crypto': crypto, 'node:net': net, './database': { getAlertsSql: () => sql }, './config': config });
    const live = { ...dependencies, '@/lib/alerts/config': config, '@/lib/alerts/signup-limit': limiter, '@/lib/alerts/subscriptions': subscriptions,
      '@/lib/integrations/mercado-libre/catalog': { findCatalogVehicle: async slug => ({ slug, price: 100, currency: 'USD', status: 'active' }) } };
    const routes = { inventory: load('../app/api/inventory-alerts/route.ts', live).POST, price: load('../app/api/price-alerts/route.ts', live).POST };
    let counter = 0;
    const signup = async (scope, { email = `limit-${counter++}@example.invalid`, ip = `198.51.100.${counter % 250}` } = {}) => {
      const body = scope === 'price' ? { email, vehicleSlug: `demo-car-${counter++}` } : { email, query: `search ${counter++}` };
      return routes[scope](new Request('https://example.test/api/alerts', { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `${ip}, 10.0.0.1` }, body: JSON.stringify(body) }));
    };
    const statuses = async (count, next) => { const result = []; for (let i = 0; i < count; i++) result.push((await next(i)).status); return result; };
    const resetWindows = () => sql`DELETE FROM public.price_alert_signup_windows`;
    for (const [scope, other] of [['inventory', 'price'], ['price', 'inventory']]) {
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

      await resetWindows();
      const email = `victim-${scope}@example.invalid`;
      assert.deepEqual(new Set(await statuses(5, i => signup(scope, { email, ip: `192.0.2.${i}` }))), new Set([201]));
      assert.equal((await signup(scope, { email, ip: '192.0.2.200' })).status, 429, `${scope}: per-email limit`);
      assert.equal((await signup(other, { email, ip: '192.0.2.201' })).status, 201, `${scope}: per-email buckets are per endpoint`);
      await sql`UPDATE public.price_alert_signup_windows SET started_at = now() - interval '61 minutes'`;
      assert.equal((await signup(scope, { email, ip: '192.0.2.202' })).status, 201, `${scope}: windows expire`);

      await resetWindows();
      assert.deepEqual(new Set(await statuses(100, i => signup(scope, { ip: `10.${scope.length}.${i}.1` }))), new Set([201]));
      assert.equal((await signup(scope, { ip: '10.250.0.1' })).status, 429, `${scope}: global limit`);
      assert.equal((await signup(other, { ip: '10.250.0.1' })).status, 201, `${scope}: one endpoint cannot exhaust the other`);
    }
    const keys = (await sql`SELECT key FROM public.price_alert_signup_windows`).map(row => row.key).join(' ');
    assert.doesNotMatch(keys, /@|203\.0\.113|10\.250|2001:db8/, 'Rate-limit keys never contain raw emails or IPs');
    assert.equal((await sql`SELECT count(*)::int AS n FROM public.vehicle_inventory_alerts WHERE email LIKE 'limit-%' AND status <> 'pending'`)[0].n, 0,
      'Demo signups are stored as pending');

    await resetWindows();
    delete process.env.ALERTS_SIGNING_SECRET;
    assert.deepEqual(new Set(await statuses(30, () => signup('inventory', { ip: '203.0.113.9' }))), new Set([201]),
      'Without a signing secret (demo only) per-IP buckets are skipped');
    await sql`UPDATE public.price_alert_signup_windows SET attempts = 100 WHERE key = 'inventory:global'`;
    assert.equal((await signup('inventory')).status, 429, 'The global bucket still applies without a signing secret');
    console.log('Signup limits: per-IP (IPv6 /64), per-email and global 429s for both endpoints, separate endpoint buckets, expiry, hashed keys and demo fallback passed.');
  } finally {
    await db.close();
  }
}
