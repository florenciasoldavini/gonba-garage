import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { createRefreshTokenStore } from '@/lib/integrations/mercado-libre/refresh-token-store';

// Each step continues from the stored record the previous one left, like the instances of a
// deployment sharing one blob.
describe('refresh-token store', () => {
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
  let originalIncidentId;
  let lockedRevision;

  it('lets only one of two concurrent instances consume the one-use refresh token', async () => {
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
  });

  it('reuses the stored access token in a new instance', async () => {
    const storedRevision = revision;
    assert.equal((await instance().accessToken(mustNotRun)).value, 'access');
    assert.equal(revision, storedRevision, 'Reusing a valid access token does not write');
  });

  it('waits through another instance\'s renewal and picks up the new token', async () => {
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
  });

  it('fails as in progress when a renewal outlasts the wait, without touching the refresh token', async () => {
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
  });

  it('never reuses the old token after a failed or interrupted renewal', async () => {
    expire();
    await assert.rejects(store.accessToken(async () => { throw new Error('Ambiguous provider timeout'); }));
    assert.equal(value.lastFailure.stage, 'token_refresh');
    assert.equal(value.lastFailure.code, 'operation_failed');
    originalIncidentId = value.lastFailure.incidentId;
    lockedRevision = revision;
    await assert.rejects(instance().accessToken(mustNotRun), error => error.incident.incidentId === originalIncidentId,
      'A failed renewal is reported immediately instead of waiting');
    value.refreshStartedAt = Date.now() - 121_000;
    await assert.rejects(instance().accessToken(mustNotRun), error => error.incident.code === 'renewal_interrupted');
    assert.equal(revision, lockedRevision, 'An interrupted refresh must not reuse the old token');
  });

  // A renewal whose function died left a lock without a recorded failure: never reclaimed either.
  it('never reclaims a lock left without a recorded failure', async () => {
    const interrupted = structuredClone(value);
    delete value.lastFailure;
    await assert.rejects(instance().accessToken(mustNotRun), error => error.incident.code === 'renewal_interrupted');
    assert.equal(revision, lockedRevision);
    Object.assign(value, interrupted, { refreshStartedAt: Date.now() });
  });

  it('reauthorizes only once the lock expires, keeping the original diagnostic', async () => {
    await assert.rejects(store.authorize('too-soon'));
    value.refreshStartedAt = Date.now() - 121_000;
    await store.authorize('reauthorized');
    assert.equal(value.refreshStartedAt, null);
    assert.equal(value.encryptedAccessToken, undefined, 'Reauthorization discards the stored access token');
    assert.equal(value.lastFailure.incidentId, originalIncidentId, 'Reauthorization must preserve the original diagnostic');
  });

  it('rejects a stale writer after the record was replaced', async () => {
    await assert.rejects(store.accessToken(async (_token, save) => {
      // Simulate a late writer after an administrator has replaced the record.
      revision++;
      await save('obsolete', access('obsolete'));
    }));
    assert.equal(value.encryptedRefreshToken, 'encrypted:reauthorized');
  });
});
