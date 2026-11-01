import { readFileSync, existsSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
if (!process.env.DATABASE_URL) throw new Error('Set the server-only DATABASE_URL before migrating.');
// Use the same branch credentials with a direct endpoint for schema work.
const migrationUrl = new URL(process.env.DATABASE_URL);
migrationUrl.hostname = migrationUrl.hostname.replace('-pooler.', '.');
const sql = neon(migrationUrl.toString());
// This migration deliberately contains plain DDL only, without functions or embedded semicolons.
const migration = ['20261028_alert_subscriptions.sql', '20261029_price_alert_delivery.sql', '20261030_alert_signup_confirmation.sql', '20261031_catalog_sync.sql',
  '20261101_inventory_alert_delivery.sql', '20261102_catalog_vehicle_category.sql']
  .map(file => readFileSync(new URL('../database/migrations/' + file, import.meta.url), 'utf8')).join('\n');
const statements = migration.split(';').map(statement => statement.trim()).filter(Boolean);
await sql.transaction(statements.map(statement => sql.query(statement)));
const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('vehicle_price_alerts', 'vehicle_inventory_alerts', 'price_alert_item_jobs', 'price_alert_deliveries', 'price_alert_signup_windows',
    'catalog_publications', 'catalog_price_history', 'catalog_sync_jobs', 'catalog_sync_runs',
    'inventory_alert_events', 'inventory_alert_deliveries', 'inventory_alert_matches') ORDER BY tablename`;
if (tables.length !== 12) throw new Error('Alert or catalog tables are incomplete.');
const confirmation = await sql`SELECT table_name FROM information_schema.columns WHERE table_schema = 'public'
  AND column_name = 'confirmed_at' AND table_name IN ('vehicle_price_alerts', 'vehicle_inventory_alerts')`;
if (confirmation.length !== 2) throw new Error('Alert confirmation columns are incomplete.');
const vehicleCategory = await sql`SELECT 1 FROM pg_constraint WHERE conname = 'catalog_publications_vehicle_category_check'`;
if (vehicleCategory.length !== 1) throw new Error('The catalog vehicle category constraint is missing.');
console.log('Alert subscription, delivery, confirmation, catalog sync and search-alert delivery schema applied and verified (12 tables).');
