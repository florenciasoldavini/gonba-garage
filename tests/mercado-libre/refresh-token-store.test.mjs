import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
import { failure, IntegrationFailure, providerFailure } from '@/lib/integrations/mercado-libre/failures';
import { createRefreshTokenStore } from '@/lib/integrations/mercado-libre/refresh-token-store';

// Each step continues from the stored record the previous one left, like the instances of a
// deployment sharing one blob.
describe('refresh-token store', () => {
  let value = null;
  let revision = 0;
  const storage = {
    async read() {
      return value ? { record: structuredClone(value), etag: String(revision) } : null;
    },
    async write(next, etag) {
      if (value ? etag !== String(revision) : etag !== undefined) throw new Error('Precondition failed');
      value = structuredClone(next);
      return String(++revision);
    },
  };
  const options = { pollMs: 5, waitMs: 2_000 };
  const instance = () =>
    createRefreshTokenStore(
      storage,
      t => `encrypted:${t}`,
      t => t.slice(10),
      options,
    );
  const store = instance();
  const access = (value, ms = 3_600_000) => ({ value, expiresAt: Date.now() + ms });
  const expire = () => {
    value.accessTokenExpiresAt = Date.now() - 1;
  };
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
    assert.deepEqual(
      parallel.map(token => token.value),
      ['access', 'access'],
      'The concurrent instance waits for the renewal',
    );
    assert.equal(value.encryptedRefreshToken, 'encrypted:rotated');
    assert.equal(value.encryptedAccessToken, 'encrypted:access', 'The access token is stored encrypted');
    assert.equal(value.refreshStartedAt, null);
  });

  it('reuses the stored access token in a new instance', async () => {
    const storedRevision = revision;
    assert.equal((await instance().accessToken(mustNotRun)).value, 'access');
    assert.equal(revision, storedRevision, 'Reusing a valid access token does not write');
  });

  it("waits through another instance's renewal and picks up the new token", async () => {
    expire();
    let release;
    const gate = new Promise(resolve => {
      release = resolve;
    });
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
      await new Promise(resolve => {
        finish = resolve;
      });
      const next = access('slow');
      await save('rotated-slow', next);
      return next;
    });
    while (value.refreshStartedAt === null) await new Promise(resolve => setTimeout(resolve, 1));
    const impatient = createRefreshTokenStore(
      storage,
      t => `encrypted:${t}`,
      t => t.slice(10),
      { pollMs: 5, waitMs: 30 },
    );
    await assert.rejects(impatient.accessToken(mustNotRun), error => error.incident.code === 'renewal_in_progress');
    finish();
    assert.equal((await slow).value, 'slow');
  });

  it('never reuses the old token after a failed or interrupted renewal', async () => {
    expire();
    await assert.rejects(
      store.accessToken(async () => {
        throw new Error('Ambiguous provider timeout');
      }),
    );
    assert.equal(value.lastFailure.stage, 'token_refresh');
    assert.equal(value.lastFailure.code, 'operation_failed');
    originalIncidentId = value.lastFailure.incidentId;
    lockedRevision = revision;
    await assert.rejects(
      instance().accessToken(mustNotRun),
      error => error.incident.incidentId === originalIncidentId,
      'A failed renewal is reported immediately instead of waiting',
    );
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
    assert.equal(
      value.lastFailure.incidentId,
      originalIncidentId,
      'Reauthorization must preserve the original diagnostic',
    );
  });

  it('rejects a stale writer after the record was replaced', async () => {
    await assert.rejects(
      store.accessToken(async (_token, save) => {
        // Simulate a late writer after an administrator has replaced the record.
        revision++;
        await save('obsolete', access('obsolete'));
      }),
    );
    assert.equal(value.encryptedRefreshToken, 'encrypted:reauthorized');
  });

  // A renewal that provably did not consume the token releases its lock: the request never reached
  // Mercado Libre, or Mercado Libre answered 429 or 5xx. Anything ambiguous or definite stays locked.
  describe('released renewals', () => {
    const reconnect = async token => {
      value.refreshStartedAt = Date.now() - 121_000;
      await store.authorize(token);
    };
    const logs = () => {
      const entries = [];
      const record = message => entries.push(JSON.parse(message));
      vi.spyOn(console, 'error').mockImplementation(record);
      vi.spyOn(console, 'warn').mockImplementation(record);
      return name => entries.filter(entry => entry.event === name);
    };
    const reset = code => new TypeError('fetch failed', { cause: Object.assign(new Error('socket'), { code }) });

    it.each([
      ['a connection that was never made', () => reset('ECONNREFUSED'), 'connection_failed'],
      ['a 429', () => providerFailure(Response.json({}, { status: 429 }), 'token_refresh'), 'http_error'],
      ['a 503', () => providerFailure(new Response('down', { status: 503 }), 'token_refresh'), 'http_error'],
    ])('unlocks the same token after %s', async (label, error, code) => {
      const events = logs();
      await reconnect('kept');
      await assert.rejects(
        store.accessToken(async () => {
          throw await error();
        }),
        thrown => thrown.incident.code === code,
      );
      assert.equal(value.refreshStartedAt, null, 'The unconsumed token is unlocked');
      assert.equal(value.encryptedRefreshToken, 'encrypted:kept', 'The same refresh token is kept');
      assert.equal(value.lastFailure.code, code, 'The failure is recorded');
      assert.ok(value.refreshRetryAfter > Date.now(), 'Renewals pause briefly');
      assert.equal(events('mercado_libre_refresh_released').length, 1);
    });

    it('reports the failure during the pause, without calling Mercado Libre or writing', async () => {
      const paused = revision;
      await assert.rejects(
        instance().accessToken(mustNotRun),
        thrown => thrown instanceof IntegrationFailure && thrown.incident.incidentId === value.lastFailure.incidentId,
      );
      assert.equal(revision, paused);
    });

    it('renews the same token normally after the pause', async () => {
      value.refreshRetryAfter = Date.now() - 1;
      const renewed = await instance().accessToken(async (token, save) => {
        assert.equal(token, 'kept', 'The released token is the one renewed');
        const next = access('recovered');
        await save('rotated-after-release', next);
        return next;
      });
      assert.equal(renewed.value, 'recovered');
      assert.equal(value.refreshRetryAfter, undefined);
    });

    it.each([
      ['our own timeout', () => new DOMException('aborted', 'TimeoutError')],
      ['a dropped connection', () => reset('ECONNRESET')],
      [
        'invalid_grant',
        () => failure('token_refresh', 'http_error', { httpStatus: 400, providerCode: 'invalid_grant' }),
      ],
      ['an unreadable token response', () => failure('token_response', 'invalid_response')],
      ['a 5xx on a later stage', () => failure('credential_save', 'http_error', { httpStatus: 503 })],
    ])('keeps the lock after %s, and reports it', async (label, error) => {
      const events = logs();
      await reconnect('kept');
      await assert.rejects(
        store.accessToken(async () => {
          throw error();
        }),
      );
      assert.notEqual(value.refreshStartedAt, null);
      assert.equal(value.refreshRetryAfter, undefined);
      assert.equal(events('mercado_libre_reauthorization_required').length, 1);
    });

    it('keeps the lock when a token was saved before the failure', async () => {
      await reconnect('kept');
      await assert.rejects(
        store.accessToken(async (_token, save) => {
          await save('rotated', access('fresh'));
          throw failure('token_refresh', 'http_error', { httpStatus: 503 });
        }),
      );
      assert.equal(value.encryptedRefreshToken, 'encrypted:rotated', 'The saved rotation is never undone');
      assert.equal(value.refreshRetryAfter, undefined);
    });

    it('repeats the event on every blocked request, without tokens', async () => {
      await reconnect('kept');
      await assert.rejects(
        store.accessToken(async () => {
          throw failure('token_response', 'invalid_response');
        }),
      );
      const events = logs();
      await assert.rejects(instance().accessToken(mustNotRun));
      const [stuck] = events('mercado_libre_reauthorization_required');
      assert.equal(stuck.lastFailure.stage, 'token_response');
      assert.equal(typeof stuck.lockAgeSeconds, 'number');
      assert.equal(JSON.stringify(stuck).includes('encrypted:'), false);
    });

    it('stays locked when unlocking itself fails', async () => {
      logs();
      await reconnect('kept');
      const { write } = storage;
      storage.write = async (next, etag) => {
        if (next.refreshRetryAfter) throw new Error('Blob unavailable');
        return write(next, etag);
      };
      await assert.rejects(
        store.accessToken(async () => {
          throw reset('ECONNREFUSED');
        }),
      );
      storage.write = write;
      assert.notEqual(value.refreshStartedAt, null);
      assert.equal(value.lastFailure.code, 'connection_failed');
    });
  });
});
