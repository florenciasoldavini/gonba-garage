import assert from 'node:assert/strict';
import { beforeEach, describe, it, vi } from 'vitest';
import { POST } from '@/app/api/mercado-libre/webhook/route';

// The webhook persists each notification for both price alerts and the catalog sync before
// acknowledging it. The queues themselves have their own suites.
const queues = vi.hoisted(() => ({ price: [], sync: [], deferred: [], enqueueFail: false, newWork: true }));
vi.mock('next/server', async importOriginal => ({ ...await importOriginal(), after: task => { queues.deferred.push(task); } }));
vi.mock('@/lib/alerts/database', () => ({ getAlertsSql: () => assert.fail('The webhook only queues'), isAlertsDatabaseConfigured: () => true }));
vi.mock('@/lib/alerts/price-delivery', () => ({
  // Each queue answers whether the notification is new work to drain.
  enqueuePriceItem: async id => { if (queues.enqueueFail) throw Error(); queues.price.push(id); return queues.newWork; },
  runPriceAlertWorkSafely: async () => {},
}));
vi.mock('@/lib/integrations/mercado-libre/inventory-sync', () => ({
  enqueueCatalogSync: async (id, { verified }) => { queues.sync.push([id, verified]); return queues.newWork && verified; },
  runCatalogSyncWorkSafely: async () => {},
}));
vi.mock('@/lib/alerts/inventory-delivery', () => ({ runInventoryAlertWork: async () => {}, runInventoryAlertWorkSafely: async () => {} }));

const post = (body, headers = {}) => new Request('https://example.test/api/mercado-libre/webhook',
  { method: 'POST', headers, body: JSON.stringify(body) });
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
    assert.deepEqual(queues.sync, [['MLA123', true]], 'The same notification also queues a catalog sync');
    assert.equal(queues.deferred.length, 1);
  });

  it('starts no drain for a duplicate of queued work', async () => {
    queues.newWork = false;
    queues.deferred.length = 0;
    assert.equal((await POST(post(notification))).status, 200);
    assert.equal(queues.deferred.length, 0, 'Nothing new to drain, no drain');
    queues.newWork = true;
  });

  // With Mercado Libre's notification addresses configured, any other address is still queued in both
  // queues (it may be a new Mercado Libre address) but starts no work. Only Vercel's own header counts.
  it('queues notifications from unlisted addresses without draining them', async () => {
    vi.stubEnv('MERCADO_LIBRE_WEBHOOK_IPS', '54.88.218.97, 18.215.140.160');
    const warnings = [];
    vi.spyOn(console, 'warn').mockImplementation(message => warnings.push(JSON.parse(message)));
    queues.price.length = 0; queues.sync.length = 0; queues.deferred.length = 0;
    for (const headers of [{}, { 'x-forwarded-for': '54.88.218.97' },
      { 'x-vercel-forwarded-for': '203.0.113.9', 'x-forwarded-for': '54.88.218.97, 203.0.113.9' }]) {
      assert.equal((await POST(post(notification, headers))).status, 200);
    }
    assert.deepEqual(queues.price, ['MLA123', 'MLA123', 'MLA123'], 'An unlisted address is queued, never dropped');
    assert.deepEqual(queues.sync.map(([, verified]) => verified), [false, false, false]);
    assert.equal(queues.deferred.length, 0, 'An unlisted address starts no drain, whatever x-forwarded-for says');
    assert.deepEqual(warnings.map(({ address }) => address), ['', '', '203.0.113.9'], 'Each one is logged with its address');
    assert.equal((await POST(post(notification, { 'x-vercel-forwarded-for': '18.215.140.160' }))).status, 200);
    assert.equal((await POST(post(notification, { 'x-vercel-forwarded-for': '::ffff:54.88.218.97' }))).status, 200);
    assert.deepEqual(queues.sync.slice(3).map(([, verified]) => verified), [true, true]);
    assert.equal(queues.deferred.length, 2, 'A listed address drains as before');
    assert.equal((await POST(post({ ...notification, user_id: 999 }, { 'x-vercel-forwarded-for': '203.0.113.9' }))).status, 200);
    assert.equal(queues.price.length, 5, 'Foreign notifications are still ignored first');
  });

  it('asks Mercado Libre to retry when the notification cannot be persisted', async () => {
    queues.enqueueFail = true;
    assert.equal((await POST(post(notification))).status, 503, 'Failed persistence must request provider retry');
  });
});
