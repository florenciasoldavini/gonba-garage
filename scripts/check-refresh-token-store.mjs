import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/integrations/mercado-libre/refresh-token-store.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
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
const store = createRefreshTokenStore(storage, t => `encrypted:${t}`, t => t.slice(10));
await store.authorize('original');
let consumed = 0;
const operation = async (token, save) => { consumed++; assert.equal(token, 'original'); await save('rotated'); return 'access'; };
const parallel = await Promise.allSettled([store.refresh(operation), store.refresh(operation)]);
assert.equal(consumed, 1, 'Only one instance may consume the one-use token');
assert.equal(parallel.filter(r => r.status === 'fulfilled').length, 1);
assert.equal(value.encryptedRefreshToken, 'encrypted:rotated');
assert.equal(value.refreshStartedAt, null);
await assert.rejects(store.refresh(async () => { throw new Error('Ambiguous provider timeout'); }));
const lockedRevision = revision;
await assert.rejects(store.refresh(async () => { throw new Error('must not run'); }));
assert.equal(revision, lockedRevision, 'An interrupted refresh must not reuse the old token');
await assert.rejects(store.authorize('too-soon'));
value.refreshStartedAt = Date.now() - 121_000;
await store.authorize('reauthorized');
assert.equal(value.refreshStartedAt, null);
await assert.rejects(store.refresh(async (_token, save) => {
  // Simulate a late writer after an administrator has replaced the record.
  revision++;
  await save('obsolete');
}));
assert.equal(value.encryptedRefreshToken, 'encrypted:reauthorized');
console.log('Refresh-token storage: exclusive renewal, rotation, fail-closed recovery, and stale writer rejection passed.');
