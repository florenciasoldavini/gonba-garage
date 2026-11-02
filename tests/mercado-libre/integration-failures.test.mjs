import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
import { providerFailure, readSafeIncident, reportIntegrationFailure, safeFailure } from '@/lib/integrations/mercado-libre/failures';
import { createRefreshTokenStore } from '@/lib/integrations/mercado-libre/refresh-token-store';
import { readConnectionDiagnostics } from '@/lib/integrations/mercado-libre/credentials';
import { runtimeImports } from '../helpers/modules.mjs';

// The credentials read the shared record from the private blob.
const blob = vi.hoisted(() => ({ record: null }));
vi.mock('@vercel/blob', () => ({
  get: async () => ({ statusCode: 200, stream: new Response(JSON.stringify(blob.record)).body, blob: { etag: '1' } }),
}));
vi.mock('@/lib/integrations/mercado-libre/oauth', () => ({ securelyMatches: () => true }));

const secret = 'DO_NOT_LOG_ACCESS_OR_REFRESH_TOKEN';
const tokenRejection = () => providerFailure(Response.json({ error: 'invalid_grant', error_description: secret,
  access_token: secret, refresh_token: secret }, { status: 400 }), 'token_refresh');

it('loads only its expected runtime dependencies', () => {
  const allowed = {
    'lib/integrations/mercado-libre/failures.ts': [],
    'lib/integrations/mercado-libre/refresh-token-store.ts': ['./failures'],
    'lib/integrations/mercado-libre/credentials.ts': ['@vercel/blob', './oauth', './refresh-token-store', './failures'],
  };
  for (const [file, dependencies] of Object.entries(allowed)) {
    for (const id of runtimeImports(file)) {
      if (id === 'server-only' || dependencies.includes(id)) continue;
      assert.equal(id, 'node:crypto', file);
    }
  }
});

describe('safe failure reports', () => {
  it('keeps the provider code of a token rejection and no secret', async () => {
    const upstream = await tokenRejection();
    assert.equal(upstream.incident.httpStatus, 400);
    assert.equal(upstream.incident.providerCode, 'invalid_grant');
    assert.equal(JSON.stringify(upstream.incident).includes(secret), false);
    const arbitrary = await providerFailure(Response.json({ error: secret }, { status: 500 }), 'catalog_query');
    assert.equal(arbitrary.incident.providerCode, undefined);
  });

  it('classifies timeouts, network errors and storage statuses', () => {
    assert.equal(safeFailure(new DOMException(secret, 'TimeoutError'), 'token_refresh').incident.code, 'timeout');
    assert.equal(safeFailure(new TypeError(secret), 'catalog_query').incident.code, 'network_error');
    assert.equal(safeFailure(Object.assign(new Error(secret), { statusCode: 403 }), 'credential_save').incident.httpStatus, 403);
  });

  it('logs without the secret', () => {
    const captured = [];
    vi.spyOn(console, 'error').mockImplementation(message => { captured.push(message); });
    reportIntegrationFailure(new Error(secret), 'catalog_query');
    assert.ok(captured.length);
    assert.equal(captured.join('').includes(secret), false);
  });

  it('reads back only the safe incident fields', async () => {
    const upstream = await tokenRejection();
    assert.deepEqual(readSafeIncident({ ...upstream.incident, token: secret, message: secret }), upstream.incident);
  });
});

// Each step continues from the stored record the previous one left.
describe('renewal diagnostics', () => {
  let record = null;
  let revision = 0;
  let failSavingReplacement = false;
  const storage = {
    async read() { return record ? { record: structuredClone(record), etag: String(revision) } : null; },
    async write(next, etag) {
      if (record ? etag !== String(revision) : etag !== undefined) throw new Error(secret);
      if (failSavingReplacement && next.refreshStartedAt === null) throw Object.assign(new Error(secret), { statusCode: 503 });
      record = structuredClone(next);
      return String(++revision);
    },
  };
  const store = createRefreshTokenStore(storage, token => `cipher:${token}`, value => value.slice(7), { pollMs: 5, waitMs: 100 });
  // Saved as already expired, so each call below renews instead of reusing it.
  const expired = value => ({ value, expiresAt: Date.now() - 1 });
  let upstream;
  let providerIncident;

  it('records a provider rejection and reports it while the renewal is blocked', async () => {
    upstream = await tokenRejection();
    await store.authorize('original');
    await assert.rejects(store.accessToken(async () => { throw upstream; }));
    providerIncident = record.lastFailure;
    assert.equal(providerIncident.stage, 'token_refresh');
    assert.equal(providerIncident.providerCode, 'invalid_grant');
    assert.equal(record.refreshIncidentId, providerIncident.incidentId);
    const lockedRevision = revision;
    await assert.rejects(store.accessToken(async () => assert.fail('Blocked renewal must not contact the provider')),
      error => error.incident.code === 'renewal_in_progress' && error.incident.incidentId === providerIncident.incidentId);
    assert.equal(revision, lockedRevision, 'Blocked requests must preserve the original failure');
    record.refreshStartedAt = Date.now() - 121000;
    await assert.rejects(store.accessToken(async () => assert.fail()), error => error.incident.code === 'renewal_interrupted');
  });

  it('keeps the last incident through reauthorization and a successful refresh', async () => {
    await store.authorize('new');
    assert.deepEqual(record.lastFailure, providerIncident);
    await store.accessToken(async (_token, save) => { await save('next', expired('access')); return expired('access'); });
    assert.deepEqual(record.lastFailure, providerIncident, 'A successful refresh also keeps the last incident');
    assert.equal(record.refreshIncidentId, undefined);
  });

  it('reports a renewal that never saved its replacement', async () => {
    await assert.rejects(store.accessToken(async () => expired('forgot to save')),
      error => error.incident.stage === 'credential_save' && error.incident.code === 'replacement_not_saved');
  });

  it('keeps an ambiguous rotation locked when storage fails', async () => {
    record.refreshStartedAt = Date.now() - 121000;
    await store.authorize('restart-for-storage-test');
    failSavingReplacement = true;
    await assert.rejects(store.accessToken(async (_token, save) => save('unsaved', expired('unsaved'))));
    assert.equal(record.lastFailure.stage, 'credential_save');
    assert.equal(record.lastFailure.httpStatus, 503);
    assert.equal(record.refreshStartedAt === null, false, 'Diagnostics must not unlock an ambiguous rotation');
  });

  it('shows the connection state without any token', async () => {
    vi.stubEnv('MERCADO_LIBRE_SELLER_ID', '123');
    record.encryptedAccessToken = 'cipher:shared-access';
    record.accessTokenExpiresAt = Date.now() + 60_000;
    blob.record = record;
    const connection = await readConnectionDiagnostics();
    assert.ok(['renewing', 'reauthorization_required'].includes(connection.state));
    assert.equal(connection.lastFailure.stage, 'credential_save');
    assert.equal(connection.providerVerified, false);
    assert.equal(JSON.stringify(connection).includes('cipher:'), false);
    assert.equal('encryptedRefreshToken' in connection, false);
    assert.equal(JSON.stringify(connection).includes('access'), false, 'Diagnostics never expose the shared access token');
  });
});
