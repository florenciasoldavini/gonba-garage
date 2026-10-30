import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
const dependencies = {
  'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
  '@/lib/alerts/database': { isAlertsDatabaseConfigured: () => configured },
  '@/lib/alerts/config': { alertDeliveryEnabled: () => false },
  '@/lib/alerts/price-delivery': {},
  '@/lib/alerts/signup-limit': {},
  '@/lib/integrations/mercado-libre/access-token': {},
  '@/lib/integrations/mercado-libre/oauth': {},
  '@/lib/alerts/subscriptions': {
    saveInventorySubscription: async input => { if (failStorage) throw new Error('Private DB error'); calls.push(input); },
    savePriceSubscription: async input => { if (failStorage) throw new Error('Private DB error'); calls.push(input); },
  },
  '@/lib/integrations/mercado-libre/catalog': { findCatalogVehicle: async () => vehicle },
};
const inventory = load('../app/api/inventory-alerts/route.ts', dependencies).POST;
const price = load('../app/api/price-alerts/route.ts', dependencies).POST;
const post = body => new Request('https://example.test/api/alerts', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const request = { email: ' Test@Example.invalid ', vehicleSlug: vehicle.slug };
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
console.log('Alert routes: validation, oversized email, normalized email, honeypot, missing configuration, live catalog prices and safe failures passed.');

async function checkStorage(sql, subscriptions) {
  const email = `gonba-storage-test-${randomUUID()}@example.invalid`;
  const search = { email, query: 'integration-test', make: 'Toyota', transmission: 'automatic', bodyType: '', fuel: '',
    minPrice: 0, maxPrice: 100000, minMileage: 0, maxMileage: 0 };
  try {
    await Promise.all(Array.from({ length: 3 }, () => subscriptions.saveInventorySubscription(search)));
    const inventoryRows = await sql`SELECT * FROM public.vehicle_inventory_alerts WHERE email = ${email}`;
    assert.equal(inventoryRows.length, 1, 'Concurrent subscriptions must deduplicate');
    assert.equal(Number(inventoryRows[0].max_price), 100000);
    await subscriptions.savePriceSubscription({ email, vehicleSlug: 'gonba-storage-test', price: 100, currency: 'USD' });
    await subscriptions.savePriceSubscription({ email, vehicleSlug: 'gonba-storage-test', price: 90, currency: 'ARS' });
    let rows = await sql`SELECT * FROM public.vehicle_price_alerts WHERE email = ${email}`;
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].current_price), 100, 'Repeated requests must preserve the original price baseline');
    assert.equal(rows[0].currency, 'USD');
    await sql`UPDATE public.vehicle_price_alerts SET status = 'cancelled' WHERE email = ${email}`;
    await subscriptions.savePriceSubscription({ email, vehicleSlug: 'gonba-storage-test', price: 90, currency: 'ARS' });
    rows = await sql`SELECT * FROM public.vehicle_price_alerts WHERE email = ${email}`;
    assert.equal(rows[0].status, 'active');
    assert.equal(Number(rows[0].current_price), 90);
    assert.equal(rows[0].currency, 'ARS');
  } finally {
    await sql`DELETE FROM public.vehicle_price_alerts WHERE email = ${email}`;
    await sql`DELETE FROM public.vehicle_inventory_alerts WHERE email = ${email}`;
  }
  console.log('Storage: insert, concurrent deduplication, stable price baseline and re-subscription passed; test data removed.');
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
    const migration = readFileSync(new URL('../database/migrations/20261028_alert_subscriptions.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    const sql = async (strings, ...values) => {
      const text = strings.reduce((result, part, index) => result + part + (index < values.length ? '$' + (index + 1) : ''), '');
      return (await db.query(text, values)).rows;
    };
    const subscriptions = load('../lib/alerts/subscriptions.ts', { './database': { getAlertsSql: () => sql } });
    await checkStorage(sql, subscriptions);
    const malicious = { email: 'quoted@example.invalid', query: "'; DROP TABLE vehicle_inventory_alerts; --", make: '',
      transmission: '', bodyType: '', fuel: '', minPrice: 0, maxPrice: 0, minMileage: 0, maxMileage: 0 };
    await subscriptions.saveInventorySubscription(malicious);
    const rows = await sql`SELECT search_query FROM public.vehicle_inventory_alerts WHERE email = ${malicious.email}`;
    assert.equal(rows[0].search_query, malicious.query, 'SQL parameters must stay literal data');
    await assert.rejects(sql`INSERT INTO public.vehicle_inventory_alerts (email, min_price, max_price)
      VALUES ('invalid-bounds@example.invalid', 100, 10)`, /check constraint/);
    console.log('Local PostgreSQL: rerunnable migration, real SQL, injection safety and database constraints passed.');
  } finally {
    await db.close();
  }
}
