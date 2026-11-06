import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: () => {}, unstable_cache: read => read }));
vi.mock('@/lib/catalog/store', () => ({ findCatalogPublication: vi.fn(), listActiveCatalogVehicles: vi.fn() }));

const { retryOnce } = await import('../../lib/catalog/cache.ts');

describe('catalog reads', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const settle = async promise => {
    const settled = promise.then(
      value => ({ value }),
      error => ({ error }),
    );
    await vi.runAllTimersAsync();
    return settled;
  };

  it('does not read twice when the first read works', async () => {
    const read = vi.fn(async () => 'cars');
    assert.deepEqual(await settle(retryOnce(read)), { value: 'cars' });
    assert.equal(read.mock.calls.length, 1);
  });

  it('survives one dropped connection', async () => {
    const read = vi.fn(async () => 'cars').mockRejectedValueOnce(new Error('other side closed'));
    assert.deepEqual(await settle(retryOnce(read)), { value: 'cars' });
    assert.equal(read.mock.calls.length, 2);
  });

  it('throws when the second read fails too, so the failure is never stored as a result', async () => {
    const outage = new Error('database unreachable');
    const read = vi.fn(async () => {
      throw outage;
    });
    assert.equal((await settle(retryOnce(read))).error, outage);
    assert.equal(read.mock.calls.length, 2);
  });
});
