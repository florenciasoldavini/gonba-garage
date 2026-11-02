import assert from 'node:assert/strict';
import { beforeEach, describe, it, vi } from 'vitest';
import { POST } from '@/app/api/mercado-libre/webhook/route';

// The webhook persists each notification for both price alerts and the catalog sync before
// acknowledging it. The queues themselves have their own suites.
const queues = vi.hoisted(() => ({ price: [], sync: [], deferred: [], enqueueFail: false }));
vi.mock('next/server', async importOriginal => ({ ...await importOriginal(), after: task => { queues.deferred.push(task); } }));
vi.mock('@/lib/alerts/database', () => ({ getAlertsSql: () => assert.fail('The webhook only queues'), isAlertsDatabaseConfigured: () => true }));
vi.mock('@/lib/alerts/price-delivery', () => ({
  enqueuePriceItem: async id => { if (queues.enqueueFail) throw Error(); queues.price.push(id); }, runPriceAlertWorkSafely: async () => {},
}));
vi.mock('@/lib/integrations/mercado-libre/inventory-sync', () => ({
  enqueueCatalogSync: async id => { queues.sync.push(id); }, runCatalogSyncWorkSafely: async () => {},
}));
vi.mock('@/lib/alerts/inventory-delivery', () => ({ runInventoryAlertWork: async () => {}, runInventoryAlertWorkSafely: async () => {} }));

const post = body => new Request('https://example.test/api/mercado-libre/webhook', { method: 'POST', body: JSON.stringify(body) });
const notification = { topic: 'items', resource: '/items/MLA123', user_id: 123, application_id: 456 };

beforeEach(() => {
  vi.stubEnv('ALERTS_SIGNING_SECRET', 'test-secret-never-used-outside-tests-123456');
  vi.stubEnv('ALERTS_PUBLIC_URL', 'https://example.test');
  vi.stubEnv('ALERTS_EMAIL_FROM', 'Gonba <test@example.test>');
  vi.stubEnv('RESEND_API_KEY', 'test');
  vi.stubEnv('DATABASE_URL', 'test');
  vi.stubEnv('MERCADO_LIBRE_SELLER_ID', '123');
  vi.stubEnv('MERCADO_LIBRE_CLIENT_ID', '456');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Each step continues from the queues the previous one filled.
describe('Mercado Libre webhook', () => {
  it('rejects an invalid body and ignores another seller', async () => {
    assert.equal((await POST(post(null))).status, 400);
    assert.equal((await POST(post({ ...notification, user_id: 999 }))).status, 200);
    assert.equal(queues.price.length, 0);
  });

  it('queues a price review and a catalog sync before acknowledging', async () => {
    assert.equal((await POST(post(notification))).status, 200);
    assert.deepEqual(queues.price, ['MLA123']);
    assert.deepEqual(queues.sync, ['MLA123'], 'The same notification also queues a catalog sync');
    assert.equal(queues.deferred.length, 1);
  });

  it('asks Mercado Libre to retry when the notification cannot be persisted', async () => {
    queues.enqueueFail = true;
    assert.equal((await POST(post(notification))).status, 503, 'Failed persistence must request provider retry');
  });
});
