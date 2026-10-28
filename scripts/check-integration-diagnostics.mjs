import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('exports', 'require', code)(exports, id => {
    if (id === 'server-only') return {};
    if (id in dependencies) return dependencies[id];
    assert.equal(id, 'node:crypto');
    return require(id);
  });
  return exports;
}
const failures = load('../lib/integrations/mercado-libre/failures.ts');
const { providerFailure, safeFailure, readSafeIncident, reportIntegrationFailure } = failures;
const secret = 'DO_NOT_LOG_ACCESS_OR_REFRESH_TOKEN';
const upstream = await providerFailure(Response.json({ error: 'invalid_grant', error_description: secret,
  access_token: secret, refresh_token: secret }, { status: 400 }), 'token_refresh');
assert.equal(upstream.incident.httpStatus, 400);
assert.equal(upstream.incident.providerCode, 'invalid_grant');
assert.equal(JSON.stringify(upstream.incident).includes(secret), false);
const arbitrary = await providerFailure(Response.json({ error: secret }, { status: 500 }), 'catalog_query');
assert.equal(arbitrary.incident.providerCode, undefined);
assert.equal(safeFailure(new DOMException(secret, 'TimeoutError'), 'token_refresh').incident.code, 'timeout');
assert.equal(safeFailure(new TypeError(secret), 'catalog_query').incident.code, 'network_error');
assert.equal(safeFailure(Object.assign(new Error(secret), { statusCode: 403 }), 'credential_save').incident.httpStatus, 403);
const captured = [];
const previousLog = console.error;
console.error = message => captured.push(message);
try { reportIntegrationFailure(new Error(secret), 'catalog_query'); }
finally { console.error = previousLog; }
assert.ok(captured.length);
assert.equal(captured.join('').includes(secret), false);
assert.deepEqual(readSafeIncident({ ...upstream.incident, token: secret, message: secret }), upstream.incident);

const { createRefreshTokenStore } = load('../lib/integrations/mercado-libre/refresh-token-store.ts', { './failures': failures });
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
const store = createRefreshTokenStore(storage, token => `cipher:${token}`, value => value.slice(7));
await store.authorize('original');
await assert.rejects(store.refresh(async () => { throw upstream; }));
const providerIncident = record.lastFailure;
assert.equal(providerIncident.stage, 'token_refresh');
assert.equal(providerIncident.providerCode, 'invalid_grant');
assert.equal(record.refreshIncidentId, providerIncident.incidentId);
const lockedRevision = revision;
await assert.rejects(store.refresh(async () => assert.fail('Blocked renewal must not contact the provider')),
  error => error.incident.code === 'renewal_in_progress' && error.incident.incidentId === providerIncident.incidentId);
assert.equal(revision, lockedRevision, 'Blocked requests must preserve the original failure');
record.refreshStartedAt = Date.now() - 121000;
await assert.rejects(store.refresh(async () => assert.fail()), error => error.incident.code === 'renewal_interrupted');
await store.authorize('new');
assert.deepEqual(record.lastFailure, providerIncident);
await store.refresh(async (_token, save) => { await save('next'); return 'access'; });
assert.deepEqual(record.lastFailure, providerIncident, 'A successful refresh also keeps the last incident');
assert.equal(record.refreshIncidentId, undefined);
await assert.rejects(store.refresh(async () => 'forgot to save'),
  error => error.incident.stage === 'credential_save' && error.incident.code === 'replacement_not_saved');
record.refreshStartedAt = Date.now() - 121000;
await store.authorize('restart-for-storage-test');
failSavingReplacement = true;
await assert.rejects(store.refresh(async (_token, save) => save('unsaved')));
assert.equal(record.lastFailure.stage, 'credential_save');
assert.equal(record.lastFailure.httpStatus, 503);
assert.equal(record.refreshStartedAt === null, false, 'Diagnostics must not unlock an ambiguous rotation');

const originalSeller = process.env.MERCADO_LIBRE_SELLER_ID;
process.env.MERCADO_LIBRE_SELLER_ID = '123';
try {
  const credentials = load('../lib/integrations/mercado-libre/credentials.ts', {
    '@vercel/blob': { get: async () => ({ statusCode: 200, stream: new Response(JSON.stringify(record)).body, blob: { etag: '1' } }) },
    './oauth': { securelyMatches: () => true }, './refresh-token-store': { createRefreshTokenStore }, './failures': failures,
  });
  const connection = await credentials.readConnectionDiagnostics();
  assert.ok(['renewing', 'reauthorization_required'].includes(connection.state));
  assert.equal(connection.lastFailure.stage, 'credential_save');
  assert.equal(connection.providerVerified, false);
  assert.equal(JSON.stringify(connection).includes('cipher:'), false);
  assert.equal('encryptedRefreshToken' in connection, false);
} finally {
  if (originalSeller === undefined) delete process.env.MERCADO_LIBRE_SELLER_ID;
  else process.env.MERCADO_LIBRE_SELLER_ID = originalSeller;
}
let authenticated = false;
let connectionReads = 0;
let refreshCalls = 0;
const diagnosticRoute = load('../app/api/mercado-libre/diagnostics/route.ts', {
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  '@/lib/integrations/mercado-libre/credentials': {
    authorized: () => authenticated, required: () => '123',
    readConnectionDiagnostics: async () => { connectionReads++; return { state: 'connected', providerVerified: false }; },
  },
  '@/lib/integrations/mercado-libre/access-token': { catalogAccessToken: async () => { refreshCalls++; throw upstream; } },
  '@/lib/integrations/mercado-libre/publication-diagnostics': { readPublicationDiagnostics: async () => assert.fail() },
  '@/lib/integrations/mercado-libre/failures': failures,
});
const healthRequest = new Request('https://example.test/api/mercado-libre/diagnostics?connection=1');
assert.equal((await diagnosticRoute.GET(healthRequest)).status, 401);
assert.equal(connectionReads, 0);
authenticated = true;
const healthResponse = await diagnosticRoute.GET(healthRequest);
assert.equal(healthResponse.status, 200);
assert.equal(healthResponse.headers.get('Cache-Control'), 'private, no-store');
assert.equal(connectionReads, 1);
assert.equal(refreshCalls, 0, 'The health check must never consume a refresh token');
const errorResponse = await diagnosticRoute.GET(new Request('https://example.test/api/mercado-libre/diagnostics'));
assert.equal(errorResponse.status, 503);
const errorBody = await errorResponse.json();
assert.equal(errorBody.incidentId, upstream.incident.incidentId);
assert.equal(JSON.stringify(errorBody).includes(secret), false);
console.log('Integration diagnostics: provider rejection vs storage failure, timeout, network error, safe persistence, correlation, reauthorization history and read-only credential privacy passed.');
