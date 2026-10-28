import { readFileSync, existsSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
if (!process.env.DATABASE_URL) throw new Error('Set the server-only DATABASE_URL before migrating.');
const sql = neon(process.env.DATABASE_URL);
// This migration deliberately contains plain DDL only, without functions or embedded semicolons.
const migration = readFileSync(new URL('../database/migrations/20261028_alert_subscriptions.sql', import.meta.url), 'utf8');
const statements = migration.split(';').map(statement => statement.trim()).filter(Boolean);
await sql.transaction(statements.map(statement => sql.query(statement)));
const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('vehicle_price_alerts', 'vehicle_inventory_alerts') ORDER BY tablename`;
if (tables.length !== 2) throw new Error('Alert tables are incomplete.');
console.log('Alert schema applied and verified: vehicle_price_alerts, vehicle_inventory_alerts.');
