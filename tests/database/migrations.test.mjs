import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, describe, it } from 'vitest';
import { ALL_MIGRATIONS, applyMigrationsTwice } from '../helpers/postgres.mjs';

// Each step reads the schema the first one created.
describe('database migrations', () => {
  const db = new PGlite();
  afterAll(() => db.close());

  // The runner reapplies every migration on each deploy, so each one must be rerunnable.
  it('apply in order, twice, on an empty database', async () => {
    assert.ok(ALL_MIGRATIONS.length > 0);
    await applyMigrationsTwice(db, ALL_MIGRATIONS);
  });

  it('create the alert and catalog tables', async () => {
    const tables = (await db.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)).rows.map(({ tablename }) => tablename);
    for (const table of ['vehicle_price_alerts', 'vehicle_inventory_alerts', 'price_alert_item_jobs', 'price_alert_deliveries',
      'price_alert_signup_windows', 'catalog_publications', 'catalog_price_history', 'catalog_sync_jobs', 'catalog_sync_runs',
      'inventory_alert_events', 'inventory_alert_deliveries', 'inventory_alert_matches']) {
      assert.ok(tables.includes(table), `${table} exists`);
    }
  });

  it('add the confirmation columns and the vehicle category constraint', async () => {
    const confirmation = await db.query(`SELECT table_name FROM information_schema.columns WHERE table_schema = 'public'
      AND column_name = 'confirmed_at' AND table_name IN ('vehicle_price_alerts', 'vehicle_inventory_alerts')`);
    assert.equal(confirmation.rows.length, 2);
    const vehicleCategory = await db.query(`SELECT 1 FROM pg_constraint WHERE conname = 'catalog_publications_vehicle_category_check'`);
    assert.equal(vehicleCategory.rows.length, 1);
  });
});
