import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
import { catalogAccessToken } from '@/lib/integrations/mercado-libre/access-token';
import { runtimeImports } from '../helpers/modules.mjs';

const provider = vi.hoisted(() => ({ tokenResponse: null, shared: null }));
vi.mock('@/lib/integrations/mercado-libre/credentials', () => ({ required: () => '123', sharedAccessToken: renew => provider.shared(renew) }));
vi.mock('@/lib/integrations/mercado-libre/oauth', () => ({ refreshMercadoLibreToken: async () => provider.tokenResponse }));

const secret = 'DO_NOT_LOG_ACCESS_OR_REFRESH_TOKEN';

// Each step continues with the access token the previous one left in memory.
describe('catalog access token', () => {
  it('loads only its expected runtime dependencies', () => {
    for (const id of runtimeImports('lib/integrations/mercado-libre/access-token.ts')) {
      if (['server-only', './credentials', './oauth', './failures'].includes(id)) continue;
      assert.equal(id, 'node:crypto');
    }
  });

  it('never saves another seller\'s token', async () => {
    provider.tokenResponse = { user_id: 456, access_token: secret, refresh_token: secret, expires_in: 21600 };
    provider.shared = renew => renew('refresh', async () => assert.fail('Another seller\'s token must not be saved'));
    await assert.rejects(catalogAccessToken(), error => error.incident.code === 'unexpected_seller');
  });

  it('shares the access token only together with the rotated refresh token', async () => {
    const saved = [];
    provider.tokenResponse = { ...provider.tokenResponse, user_id: 123, refresh_token: 'rotated', access_token: 'live-access' };
    provider.shared = renew => renew('refresh', async (next, access) => { saved.push({ next, access }); });
    assert.equal(await catalogAccessToken(), 'live-access');
    assert.equal(saved.length, 1, 'The access token is shared only together with the rotated refresh token');
    assert.equal(saved[0].next, 'rotated');
    assert.ok(saved[0].access.expiresAt > Date.now() + 21_000_000);
  });

  it('reuses a valid in-memory token without reading shared storage', async () => {
    provider.shared = () => assert.fail('A valid in-memory token must not read shared storage');
    assert.equal(await catalogAccessToken(), 'live-access');
  });
});
