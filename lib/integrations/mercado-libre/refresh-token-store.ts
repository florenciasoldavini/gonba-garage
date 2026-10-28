export type TokenRecord = {
  version: 1;
  encryptedRefreshToken: string;
  refreshStartedAt: number | null;
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
        throw new Error('Renewal in progress; retry authorization later');
      }
      await storage.write({ version: 1, encryptedRefreshToken: encrypt(token), refreshStartedAt: null }, existing?.etag);
    },
    async refresh<T>(operation: (token: string, save: (next: string) => Promise<void>) => Promise<T>) {
      const existing = await storage.read();
      if (!existing || existing.record.refreshStartedAt !== null) throw new Error('Connection requires authorization or renewal is in progress');
      const token = decrypt(existing.record.encryptedRefreshToken);
      const locked = { ...existing.record, refreshStartedAt: Date.now() };
      const lockEtag = await storage.write(locked, existing.etag);
      let saved = false;
      const result = await operation(token, async (next) => {
        if (saved) throw new Error('Refresh token already saved');
        await storage.write({ version: 1, encryptedRefreshToken: encrypt(next), refreshStartedAt: null }, lockEtag);
        saved = true;
      });
      if (!saved) throw new Error('Replacement refresh token was not saved');
      return result;
    },
  };
}
