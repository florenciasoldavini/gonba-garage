import { randomUUID } from 'node:crypto';
import { failure, readSafeIncident, reportIntegrationFailure, safeFailure, type IntegrationIncident } from './failures';

export type TokenRecord = {
  version: 1;
  encryptedRefreshToken: string;
  refreshStartedAt: number | null;
  /** Shared by every instance until it expires, so the one-use refresh token rotates about once per lifetime. */
  encryptedAccessToken?: string;
  accessTokenExpiresAt?: number;
  lastFailure?: IntegrationIncident;
  refreshIncidentId?: string;
};

export type TokenStorage = {
  read(): Promise<{ record: TokenRecord; etag: string } | null>;
  write(record: TokenRecord, etag?: string): Promise<string>;
};

export type AccessToken = { value: string; expiresAt: number };
type Renewal = (token: string, save: (next: string, access: AccessToken) => Promise<void>) => Promise<AccessToken>;

const LOCK_MS = 120_000;

/** Conditional writes must be atomic. Never reclaim an interrupted refresh automatically:
 * Mercado Libre may already have consumed the previous token before a network failure.
 */
export function createRefreshTokenStore(storage: TokenStorage, encrypt: (token: string) => string, decrypt: (value: string) => string,
  { pollMs = 1_000, waitMs = 25_000 } = {}) {
  const read = () => storage.read().catch(error => { throw safeFailure(error, 'credential_read'); });

  function stored(record: TokenRecord): AccessToken | null {
    const expiresAt = record.accessTokenExpiresAt;
    if (typeof record.encryptedAccessToken !== 'string' || typeof expiresAt !== 'number' || !(expiresAt > Date.now())) return null;
    try { return { value: decrypt(record.encryptedAccessToken), expiresAt }; }
    catch (error) { throw safeFailure(error, 'credential_decrypt'); }
  }

  function blocked(record: TokenRecord, startedAt: number) {
    const previous = readSafeIncident(record.lastFailure);
    const activeIncident = record.refreshIncidentId;
    const incidentId = typeof activeIncident === 'string' && /^[a-f0-9-]{36}$/.test(activeIncident)
      ? activeIncident : previous && Date.parse(previous.occurredAt) >= startedAt ? previous.incidentId : undefined;
    return failure('credential_lock', Date.now() - startedAt < LOCK_MS
      ? 'renewal_in_progress' : 'renewal_interrupted', incidentId ? { incidentId } : {});
  }

  async function lock(existing: { record: TokenRecord; etag: string }) {
    let token: string;
    try { token = decrypt(existing.record.encryptedRefreshToken); }
    catch (error) { throw safeFailure(error, 'credential_decrypt'); }
    const incidentId = randomUUID();
    const locked = { ...existing.record, refreshStartedAt: Date.now(), refreshIncidentId: incidentId };
    const lockEtag = await storage.write(locked, existing.etag).catch(error => { throw safeFailure(error, 'credential_lock'); });
    return { token, incidentId, locked, lockEtag };
  }

  async function renew(existing: { record: TokenRecord }, { token, incidentId, locked, lockEtag }: Awaited<ReturnType<typeof lock>>,
    operation: Renewal) {
    let saved = false;
    console.info(JSON.stringify({ event: 'mercado_libre_refresh_started', incidentId }));
    try {
      const result = await operation(token, async (next, access) => {
        if (saved) throw failure('credential_save', 'invalid_response');
        const lastFailure = readSafeIncident(existing.record.lastFailure);
        try {
          // The rotated refresh token and its access token are committed together, before either is used.
          await storage.write({ version: 1, encryptedRefreshToken: encrypt(next), refreshStartedAt: null,
            encryptedAccessToken: encrypt(access.value), accessTokenExpiresAt: access.expiresAt,
            ...(lastFailure ? { lastFailure } : {}) }, lockEtag);
        } catch (error) { throw safeFailure(error, 'credential_save'); }
        saved = true;
        console.info(JSON.stringify({ event: 'mercado_libre_refresh_saved', incidentId }));
      });
      if (!saved) throw failure('credential_save', 'replacement_not_saved');
      return result;
    } catch (error) {
      const incident = safeFailure(error, 'token_refresh', incidentId);
      // Keep the lock: a failed/ambiguous renewal must never reuse the one-use token.
      // Save only safe evidence, and never overwrite a newer authorization or rotation.
      if (!saved) {
        try { await storage.write({ ...locked, lastFailure: incident.incident }, lockEtag); }
        catch (diagnosticError) { reportIntegrationFailure(diagnosticError, 'credential_diagnostics_save'); }
      }
      throw incident;
    }
  }

  return {
    async authorize(token: string) {
      const existing = await storage.read();
      if (existing?.record.refreshStartedAt && Date.now() - existing.record.refreshStartedAt < LOCK_MS) {
        throw failure('credential_lock', 'renewal_in_progress');
      }
      // A new authorization discards any stored access token.
      const lastFailure = readSafeIncident(existing?.record.lastFailure);
      await storage.write({ version: 1, encryptedRefreshToken: encrypt(token), refreshStartedAt: null,
        ...(lastFailure ? { lastFailure } : {}) }, existing?.etag);
    },
    /** Reuse the shared access token; otherwise renew it, or wait briefly for another instance's renewal. */
    async accessToken(operation: Renewal) {
      const deadline = Date.now() + waitMs;
      let lost: unknown;
      for (;;) {
        const existing = await read();
        if (!existing) throw failure('credential_read', 'not_connected');
        const current = stored(existing.record);
        if (current) return current;
        const startedAt = existing.record.refreshStartedAt;
        if (startedAt !== null) {
          // Stop waiting once the active renewal has recorded its failure, or the lock is no longer recent.
          const active = existing.record.refreshIncidentId;
          const failed = !!active && readSafeIncident(existing.record.lastFailure)?.incidentId === active;
          if (failed || Date.now() - startedAt >= LOCK_MS || Date.now() + pollMs > deadline) throw blocked(existing.record, startedAt);
          await new Promise(resolve => setTimeout(resolve, pollMs));
          continue;
        }
        if (lost) throw lost;
        let lease;
        // A lost lock race re-reads once to pick up the winner's renewal.
        try { lease = await lock(existing); } catch (error) { lost = error; continue; }
        return renew(existing, lease, operation);
      }
    },
  };
}
