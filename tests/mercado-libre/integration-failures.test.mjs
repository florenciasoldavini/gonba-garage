import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { describe, it, vi } from 'vitest';
import {
  providerFailure,
  readSafeIncident,
  reportIntegrationFailure,
  safeFailure,
} from '@/lib/integrations/mercado-libre/failures';
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
const tokenRejection = () =>
  providerFailure(
    Response.json(
      { error: 'invalid_grant', error_description: secret, access_token: secret, refresh_token: secret },
      { status: 400 },
    ),
    'token_refresh',
  );

it('loads only its expected runtime dependencies', () => {
  const allowed = {
    'lib/integrations/mercado-libre/failures.ts': [],
    'lib/integrations/mercado-libre/refresh-token-store.ts': ['./failures'],
    'lib/integrations/mercado-libre/credentials.ts': [
      '@vercel/blob',
      '@/lib/env',
      './oauth',
      './refresh-token-store',
      './failures',
    ],
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

  // Only errors of the connection phase prove that a request was never sent.
  describe('requests that never left', () => {
    const failed = code => Object.assign(new Error(secret), { code });
    const fetchFailed = cause => new TypeError('fetch failed', { cause });
    const code = error => safeFailure(error, 'token_refresh').incident.code;

    it.each(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'UND_ERR_CONNECT_TIMEOUT'])(
      'recognizes %s',
      name => assert.equal(code(fetchFailed(failed(name))), 'connection_failed'),
    );
    it.each(['ECONNRESET', 'EPIPE', 'UND_ERR_SOCKET', 'ETIMEDOUT', ''])('treats "%s" as possibly sent', name =>
      assert.equal(code(fetchFailed(failed(name))), 'network_error'),
    );
    it('needs every address of a host to have failed', () => {
      assert.equal(
        code(fetchFailed(new AggregateError([failed('ECONNREFUSED'), failed('ENETUNREACH')]))),
        'connection_failed',
      );
      assert.equal(
        code(fetchFailed(new AggregateError([failed('ECONNREFUSED'), failed('ECONNRESET')]))),
        'network_error',
      );
    });
    it('recognizes real errors from Node fetch, and persists them', async () => {
      const closedPort = await new Promise(resolve => {
        const server = createServer().listen(0, '127.0.0.1', () => {
          const { port } = server.address();
          server.close(() => resolve(port));
        });
      });
      for (const url of [`http://127.0.0.1:${closedPort}/oauth/token`, 'https://gonba-garage.invalid/oauth/token']) {
        const error = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(10_000) }).then(
          () => assert.fail(url),
          thrown => thrown,
        );
        const { incident } = safeFailure(error, 'token_refresh');
        assert.equal(incident.code, 'connection_failed', url);
        assert.equal(readSafeIncident(incident).code, 'connection_failed', 'The code survives being stored');
      }
    });
  });

  it('classifies timeouts, network errors and storage statuses', () => {
    assert.equal(safeFailure(new DOMException(secret, 'TimeoutError'), 'token_refresh').incident.code, 'timeout');
    assert.equal(safeFailure(new TypeError(secret), 'catalog_query').incident.code, 'network_error');
    assert.equal(
      safeFailure(Object.assign(new Error(secret), { statusCode: 403 }), 'credential_save').incident.httpStatus,
      403,
    );
  });

  it('logs without the secret', () => {
    const captured = [];
    vi.spyOn(console, 'error').mockImplementation(message => {
      captured.push(message);
    });
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
    async read() {
      return record ? { record: structuredClone(record), etag: String(revision) } : null;
    },
    async write(next, etag) {
      if (record ? etag !== String(revision) : etag !== undefined) throw new Error(secret);
      if (failSavingReplacement && next.refreshStartedAt === null)
        throw Object.assign(new Error(secret), { statusCode: 503 });
      record = structuredClone(next);
      return String(++revision);
    },
  };
  const store = createRefreshTokenStore(
    storage,
    token => `cipher:${token}`,
    value => value.slice(7),
    { pollMs: 5, waitMs: 100 },
  );
  // Saved as already expired, so each call below renews instead of reusing it.
  const expired = value => ({ value, expiresAt: Date.now() - 1 });
  let upstream;
  let providerIncident;

  it('records a provider rejection and reports it while the renewal is blocked', async () => {
    upstream = await tokenRejection();
    await store.authorize('original');
    await assert.rejects(
      store.accessToken(async () => {
        throw upstream;
      }),
    );
    providerIncident = record.lastFailure;
    assert.equal(providerIncident.stage, 'token_refresh');
    assert.equal(providerIncident.providerCode, 'invalid_grant');
    assert.equal(record.refreshIncidentId, providerIncident.incidentId);
    const lockedRevision = revision;
    await assert.rejects(
      store.accessToken(async () => assert.fail('Blocked renewal must not contact the provider')),
      error =>
        error.incident.code === 'renewal_in_progress' && error.incident.incidentId === providerIncident.incidentId,
    );
    assert.equal(revision, lockedRevision, 'Blocked requests must preserve the original failure');
    record.refreshStartedAt = Date.now() - 121000;
    await assert.rejects(
      store.accessToken(async () => assert.fail()),
      error => error.incident.code === 'renewal_interrupted',
    );
  });

  it('keeps the last incident through reauthorization and a successful refresh', async () => {
    await store.authorize('new');
    assert.deepEqual(record.lastFailure, providerIncident);
    await store.accessToken(async (_token, save) => {
      await save('next', expired('access'));
      return expired('access');
    });
    assert.deepEqual(record.lastFailure, providerIncident, 'A successful refresh also keeps the last incident');
    assert.equal(record.refreshIncidentId, undefined);
  });

  it('reports a renewal that never saved its replacement', async () => {
    await assert.rejects(
      store.accessToken(async () => expired('forgot to save')),
      error => error.incident.stage === 'credential_save' && error.incident.code === 'replacement_not_saved',
    );
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
    assert.equal(
      connection.state,
      'reauthorization_required',
      'A renewal that recorded its failure needs reauthorization',
    );
    assert.equal(connection.reauthorizationRequired, true);
    assert.equal(connection.lastFailure.stage, 'credential_save');
    assert.equal(connection.providerVerified, false);
    assert.equal(JSON.stringify(connection).includes('cipher:'), false);
    assert.equal('encryptedRefreshToken' in connection, false);
    assert.equal(
      JSON.stringify(connection).includes('access'),
      false,
      'Diagnostics never expose the shared access token',
    );
  });

  it('tells a renewal in progress, an interrupted one and a released one apart', async () => {
    vi.stubEnv('MERCADO_LIBRE_SELLER_ID', '123');
    const base = { version: 1, encryptedRefreshToken: 'cipher:token' };
    blob.record = {
      ...base,
      refreshStartedAt: Date.now() - 1_000,
      refreshIncidentId: '00000000-0000-4000-8000-000000000009',
    };
    assert.equal((await readConnectionDiagnostics()).state, 'renewing');
    blob.record = { ...blob.record, refreshStartedAt: Date.now() - 121_000 };
    assert.equal((await readConnectionDiagnostics()).state, 'reauthorization_required', 'Interrupted stays locked');
    blob.record = { ...base, refreshStartedAt: null, refreshRetryAfter: Date.now() + 60_000 };
    const retrying = await readConnectionDiagnostics();
    assert.equal(retrying.state, 'retrying');
    assert.equal(retrying.reauthorizationRequired, false);
    assert.ok(Date.parse(retrying.retryAfter) > Date.now());
    blob.record = { ...blob.record, refreshRetryAfter: Date.now() - 1 };
    assert.equal((await readConnectionDiagnostics()).state, 'connected');
  });
});
