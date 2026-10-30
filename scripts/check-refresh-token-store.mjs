import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const failures = {};
new Function('exports', 'require', ts.transpileModule(readFileSync(new URL('../lib/integrations/mercado-libre/failures.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(failures, require);

const source = readFileSync(new URL('../lib/integrations/mercado-libre/refresh-token-store.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('exports', 'require', compiled)(exports, id => id === './failures' ? failures : require(id));
const { createRefreshTokenStore } = exports;
let value = null;
let revision = 0;
const storage = {
  async read() { return value ? { record: structuredClone(value), etag: String(revision) } : null; },
  async write(next, etag) {
    if (value ? etag !== String(revision) : etag !== undefined) throw new Error('Precondition failed');
    value = structuredClone(next);
    return String(++revision);
  },
};
const options = { pollMs: 5, waitMs: 2_000 };
const instance = () => createRefreshTokenStore(storage, t => `encrypted:${t}`, t => t.slice(10), options);
const store = instance();
const access = (value, ms = 3_600_000) => ({ value, expiresAt: Date.now() + ms });
const expire = () => { value.accessTokenExpiresAt = Date.now() - 1; };
const mustNotRun = async () => assert.fail('Must not consume the refresh token');
await store.authorize('original');
let consumed = 0;
const operation = async (token, save) => {
  consumed++;
  assert.equal(token, 'original');
  await new Promise(resolve => setTimeout(resolve, 30));
  const next = access('access');
  await save('rotated', next);
  return next;
};
const parallel = await Promise.all([instance().accessToken(operation), instance().accessToken(operation)]);
assert.equal(consumed, 1, 'Only one instance may consume the one-use token');
assert.deepEqual(parallel.map(token => token.value), ['access', 'access'], 'The concurrent instance waits for the renewal');
assert.equal(value.encryptedRefreshToken, 'encrypted:rotated');
assert.equal(value.encryptedAccessToken, 'encrypted:access', 'The access token is stored encrypted');
assert.equal(value.refreshStartedAt, null);

// A new instance reuses the stored access token instead of spending the refresh token again.
const storedRevision = revision;
assert.equal((await instance().accessToken(mustNotRun)).value, 'access');
assert.equal(revision, storedRevision, 'Reusing a valid access token does not write');

// An instance arriving during another instance's renewal waits and picks up the new token.
expire();
let release;
const gate = new Promise(resolve => { release = resolve; });
const renewing = instance().accessToken(async (token, save) => {
  assert.equal(token, 'rotated');
  await gate;
  const next = access('second');
  await save('rotated-again', next);
  return next;
});
while (value.refreshStartedAt === null) await new Promise(resolve => setTimeout(resolve, 1));
const waiting = instance().accessToken(mustNotRun);
setTimeout(release, 30);
assert.deepEqual([(await renewing).value, (await waiting).value], ['second', 'second']);

// A renewal that outlasts the wait fails as in progress, without touching the refresh token.
expire();
let finish;
const slow = instance().accessToken(async (_token, save) => {
  await new Promise(resolve => { finish = resolve; });
  const next = access('slow');
  await save('rotated-slow', next);
  return next;
});
while (value.refreshStartedAt === null) await new Promise(resolve => setTimeout(resolve, 1));
const impatient = createRefreshTokenStore(storage, t => `encrypted:${t}`, t => t.slice(10), { pollMs: 5, waitMs: 30 });
await assert.rejects(impatient.accessToken(mustNotRun), error => error.incident.code === 'renewal_in_progress');
finish();
assert.equal((await slow).value, 'slow');

expire();
await assert.rejects(store.accessToken(async () => { throw new Error('Ambiguous provider timeout'); }));
assert.equal(value.lastFailure.stage, 'token_refresh');
assert.equal(value.lastFailure.code, 'operation_failed');
const originalIncidentId = value.lastFailure.incidentId;
const lockedRevision = revision;
await assert.rejects(instance().accessToken(mustNotRun), error => error.incident.incidentId === originalIncidentId,
  'A failed renewal is reported immediately instead of waiting');
value.refreshStartedAt = Date.now() - 121_000;
await assert.rejects(instance().accessToken(mustNotRun), error => error.incident.code === 'renewal_interrupted');
assert.equal(revision, lockedRevision, 'An interrupted refresh must not reuse the old token');

// A renewal whose function died left a lock without a recorded failure: never reclaimed either.
const interrupted = structuredClone(value);
delete value.lastFailure;
await assert.rejects(instance().accessToken(mustNotRun), error => error.incident.code === 'renewal_interrupted');
assert.equal(revision, lockedRevision);
Object.assign(value, interrupted, { refreshStartedAt: Date.now() });

await assert.rejects(store.authorize('too-soon'));
value.refreshStartedAt = Date.now() - 121_000;
await store.authorize('reauthorized');
assert.equal(value.refreshStartedAt, null);
assert.equal(value.encryptedAccessToken, undefined, 'Reauthorization discards the stored access token');
assert.equal(value.lastFailure.incidentId, originalIncidentId, 'Reauthorization must preserve the original diagnostic');
await assert.rejects(store.accessToken(async (_token, save) => {
  // Simulate a late writer after an administrator has replaced the record.
  revision++;
  await save('obsolete', access('obsolete'));
}));
assert.equal(value.encryptedRefreshToken, 'encrypted:reauthorized');
console.log('Refresh-token storage: exclusive renewal, shared access-token reuse, waiting through a concurrent renewal, rotation, fail-closed recovery, and stale writer rejection passed.');
