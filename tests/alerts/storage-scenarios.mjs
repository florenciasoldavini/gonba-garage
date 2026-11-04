import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Storage scenarios shared by local PostgreSQL (alert-storage.test.mjs) and the configured Neon
// database (alert-storage.live.test.mjs). Each one removes its own test data.

export async function checkInventoryStorage(sql, subscriptions) {
  const email = `gonba-storage-test-${randomUUID()}@example.invalid`;
  const search = {
    email,
    query: 'integration-test',
    make: 'Toyota',
    transmission: 'automatic',
    bodyType: '',
    fuel: '',
    minPrice: 0,
    maxPrice: 100000,
    minMileage: 0,
    maxMileage: 0,
  };
  try {
    const saved = await Promise.all(Array.from({ length: 3 }, () => subscriptions.saveInventorySubscription(search)));
    const inventoryRows = await sql`SELECT * FROM public.vehicle_inventory_alerts WHERE email = ${email}`;
    assert.equal(inventoryRows.length, 1, 'Concurrent subscriptions must deduplicate');
    assert.equal(Number(inventoryRows[0].max_price), 100000);
    assert.equal(inventoryRows[0].status, 'pending', 'New searches wait for email confirmation');
    assert.ok(
      saved.every(
        row =>
          row.status === 'pending' && row.id === inventoryRows[0].id && row.generation === inventoryRows[0].generation,
      ),
    );
    const { id, generation } = inventoryRows[0];
    assert.equal(
      await subscriptions.confirmInventorySubscription(id, randomUUID()),
      false,
      'Another generation cannot confirm',
    );
    assert.equal((await sql`SELECT status FROM public.vehicle_inventory_alerts WHERE id = ${id}`)[0].status, 'pending');
    assert.equal(await subscriptions.confirmInventorySubscription(id, generation), true);
    assert.equal(await subscriptions.confirmInventorySubscription(id, generation), true, 'Confirmation is idempotent');
    const inventory = (await sql`SELECT * FROM public.vehicle_inventory_alerts WHERE id = ${id}`)[0];
    assert.equal(inventory.status, 'active');
    assert.ok(inventory.confirmed_at, 'Confirmation time is recorded');
    assert.equal(
      (await subscriptions.saveInventorySubscription(search)).status,
      'active',
      'Resubmitting keeps an active search active',
    );
    await sql`UPDATE public.vehicle_inventory_alerts SET status = 'cancelled' WHERE id = ${id}`;
    const renewed = await subscriptions.saveInventorySubscription(search);
    assert.equal(renewed.status, 'pending', 'A cancelled search needs a new confirmation');
    assert.notEqual(renewed.generation, generation);
    assert.equal(
      await subscriptions.confirmInventorySubscription(id, generation),
      false,
      'An old link cannot reactivate a new signup',
    );
  } finally {
    await sql`DELETE FROM public.vehicle_inventory_alerts WHERE email = ${email}`;
  }
}

export async function checkPriceStorage(sql, subscriptions) {
  const email = `gonba-storage-test-${randomUUID()}@example.invalid`;
  try {
    await subscriptions.savePriceSubscription({
      email,
      vehicleSlug: 'gonba-storage-test',
      price: 100,
      currency: 'USD',
    });
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
  }
}
