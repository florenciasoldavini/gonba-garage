import { randomUUID } from 'node:crypto';
import { failure, readSafeIncident, reportIntegrationFailure, safeFailure, type IntegrationIncident } from './failures';

export type TokenRecord = {
  version: 1;
  encryptedRefreshToken: string;
  refreshStartedAt: number | null;
  lastFailure?: IntegrationIncident;
  refreshIncidentId?: string;
};

export type TokenStorage = {
  read(): Promise<{ record: TokenRecord; etag: string } | null>;
  write(record: TokenRecord, etag?: string): Promise<string>;
};

/** Conditional writes must be atomic. Never reclaim an interrupted refresh automatically:
 * Mercado Libre may already have consumed the previous token before a network failure.
 */
export function createRefreshTokenStore(storage: TokenStorage, encrypt: (token: string) => string, decrypt: (value: string) => string) {
  return {
    async authorize(token: string) {
      const existing = await storage.read();
      if (existing?.record.refreshStartedAt && Date.now() - existing.record.refreshStartedAt < 120_000) {
        throw failure('credential_lock', 'renewal_in_progress');
      }
      const lastFailure = readSafeIncident(existing?.record.lastFailure);
      await storage.write({ version: 1, encryptedRefreshToken: encrypt(token), refreshStartedAt: null,
        ...(lastFailure ? { lastFailure } : {}) }, existing?.etag);
    },
    async refresh<T>(operation: (token: string, save: (next: string) => Promise<void>) => Promise<T>) {
      const existing = await storage.read().catch(error => { throw safeFailure(error, 'credential_read'); });
      if (!existing) throw failure('credential_read', 'not_connected');
      if (existing.record.refreshStartedAt !== null) {
        const previous = readSafeIncident(existing.record.lastFailure);
        const activeIncident = existing.record.refreshIncidentId;
        const incidentId = typeof activeIncident === 'string' && /^[a-f0-9-]{36}$/.test(activeIncident)
          ? activeIncident : previous && Date.parse(previous.occurredAt) >= existing.record.refreshStartedAt ? previous.incidentId : undefined;
        throw failure('credential_lock', Date.now() - existing.record.refreshStartedAt < 120_000
          ? 'renewal_in_progress' : 'renewal_interrupted', incidentId ? { incidentId } : {});
      }
      let token: string;
      try { token = decrypt(existing.record.encryptedRefreshToken); }
      catch (error) { throw safeFailure(error, 'credential_decrypt'); }
      const incidentId = randomUUID();
      const locked = { ...existing.record, refreshStartedAt: Date.now(), refreshIncidentId: incidentId };
      const lockEtag = await storage.write(locked, existing.etag).catch(error => { throw safeFailure(error, 'credential_lock'); });
      let saved = false;
      console.info(JSON.stringify({ event: 'mercado_libre_refresh_started', incidentId }));
      try {
        const result = await operation(token, async (next) => {
          if (saved) throw failure('credential_save', 'invalid_response');
          const lastFailure = readSafeIncident(existing.record.lastFailure);
          try {
            await storage.write({ version: 1, encryptedRefreshToken: encrypt(next), refreshStartedAt: null,
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
    },
  };
}
