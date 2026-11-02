import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { beforeAll, describe, it } from 'vitest';
import { checkInventoryStorage, checkPriceStorage } from './storage-scenarios.mjs';

// The same storage scenarios on the Neon database in DATABASE_URL (or .env.local): npm run test:live.
describe.runIf(process.env.TEST_LIVE === '1')('alert storage on the configured Neon database', () => {
  let sql;
  let subscriptions;

  beforeAll(async () => {
    if (existsSync('.env.local')) process.loadEnvFile('.env.local');
    assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for the live storage test');
    sql = (await import('@/lib/alerts/database')).getAlertsSql();
    subscriptions = await import('@/lib/alerts/subscriptions');
  });

  it('deduplicates concurrent searches and confirms them once per generation', () => checkInventoryStorage(sql, subscriptions), 30_000);

  it('keeps an active price baseline and needs a new confirmation after cancelling', () => checkPriceStorage(sql, subscriptions), 30_000);
});
