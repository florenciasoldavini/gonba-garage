import assert from 'node:assert/strict';
import { beforeAll, describe, it, vi } from 'vitest';
import { GET } from '@/app/api/mercado-libre/diagnostics/route';
import { providerFailure } from '@/lib/integrations/mercado-libre/failures';
import { runtimeImports } from '../helpers/modules.mjs';

const backend = vi.hoisted(() => ({
  authenticated: false, upstream: null, connectionReads: 0, refreshCalls: 0, syncHealthReads: 0,
}));
vi.mock('@/lib/integrations/mercado-libre/credentials', () => ({
  authorized: () => backend.authenticated,
  readConnectionDiagnostics: async () => { backend.connectionReads++; return { state: 'connected', providerVerified: false }; },
}));
vi.mock('@/lib/integrations/mercado-libre/access-token', () => ({
  catalogAccessToken: async () => { backend.refreshCalls++; throw backend.upstream; },
}));
vi.mock('@/lib/integrations/mercado-libre/publication-diagnostics', () => ({ readPublicationDiagnostics: async () => assert.fail() }));
vi.mock('@/lib/catalog/store', () => ({ readSyncHealth: async () => { backend.syncHealthReads++; return { jobs: { pending: 0 } }; } }));

const secret = 'DO_NOT_LOG_ACCESS_OR_REFRESH_TOKEN';
const diagnostics = query => GET(new Request(`https://example.test/api/mercado-libre/diagnostics${query}`));

// Each step continues from the calls the previous one counted.
describe('diagnostics route', () => {
  beforeAll(async () => {
    backend.upstream = await providerFailure(Response.json({ error: 'invalid_grant', error_description: secret,
      access_token: secret, refresh_token: secret }, { status: 400 }), 'token_refresh');
  });

  it('loads only its expected runtime dependencies', () => {
    const dependencies = ['server-only', 'next/server', '@/lib/integrations/mercado-libre/credentials', '@/lib/integrations/mercado-libre/access-token',
      '@/lib/integrations/mercado-libre/publication-diagnostics', '@/lib/integrations/mercado-libre/failures', '@/lib/catalog/store', '@/lib/env'];
    for (const id of runtimeImports('app/api/mercado-libre/diagnostics/route.ts')) {
      if (dependencies.includes(id)) continue;
      assert.equal(id, 'node:crypto');
    }
  });

  it('rejects unauthenticated requests before reading anything', async () => {
    assert.equal((await diagnostics('?connection=1')).status, 401);
    assert.equal(backend.connectionReads, 0);
  });

  it('checks the connection without consuming a refresh token', async () => {
    backend.authenticated = true;
    const healthResponse = await diagnostics('?connection=1');
    assert.equal(healthResponse.status, 200);
    assert.equal(healthResponse.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(backend.connectionReads, 1);
    assert.equal(backend.refreshCalls, 0, 'The health check must never consume a refresh token');
  });

  it('checks the sync health from the database only', async () => {
    const syncResponse = await diagnostics('?sync=1');
    assert.equal(syncResponse.status, 200);
    assert.equal(backend.syncHealthReads, 1);
    assert.equal(backend.refreshCalls, 0, 'The sync health check reads only the database');
  });

  it('correlates a provider failure without exposing the secret', async () => {
    const errorResponse = await diagnostics('');
    assert.equal(errorResponse.status, 503);
    const errorBody = await errorResponse.json();
    assert.equal(errorBody.incidentId, backend.upstream.incident.incidentId);
    assert.equal(JSON.stringify(errorBody).includes(secret), false);
  });
});
