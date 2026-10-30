import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { securelyMatches } from './oauth';
import { createRefreshTokenStore, type AccessToken, type TokenRecord } from './refresh-token-store';
import { failure, readSafeIncident, safeFailure } from './failures';

export function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw failure('configuration', 'missing_configuration');
  return value;
}

export function authorized(request: Request) {
  const expected = process.env.MERCADO_LIBRE_CATALOG_API_KEY?.trim();
  return !!expected && securelyMatches(request.headers.get('authorization') ?? '', `Bearer ${expected}`);
}

function storage() {
  const seller = required('MERCADO_LIBRE_SELLER_ID');
  if (!/^\d+$/.test(seller)) throw new Error('Invalid seller ID');
  const pathname = `mercado-libre/${seller}/refresh-token.json`;
  return {
    async read() {
      const result = await get(pathname, { access: 'private', useCache: false });
      if (!result) return null;
      if (result.statusCode !== 200) throw new Error('Unable to read credentials');
      const record = await new Response(result.stream).json() as TokenRecord;
      if (record.version !== 1 || typeof record.encryptedRefreshToken !== 'string' ||
        (record.refreshStartedAt !== null && !Number.isFinite(record.refreshStartedAt)) ||
        (record.encryptedAccessToken !== undefined && typeof record.encryptedAccessToken !== 'string') ||
        (record.accessTokenExpiresAt !== undefined && !Number.isFinite(record.accessTokenExpiresAt))) throw new Error('Invalid credential record');
      return { record, etag: result.blob.etag };
    },
    async write(record: TokenRecord, etag?: string) {
      const result = await put(pathname, JSON.stringify(record), {
        access: 'private', addRandomSuffix: false, allowOverwrite: !!etag,
        ...(etag ? { ifMatch: etag } : {}), contentType: 'application/json',
      });
      return result.etag;
    },
  };
}

function store() {
  return createRefreshTokenStore(storage(), encrypt, decrypt);
}

/** Private, read-only health view. Does not refresh tokens or expose encrypted credentials or access tokens. */
export async function readConnectionDiagnostics() {
  const existing = await storage().read().catch(error => { throw safeFailure(error, 'credential_read'); });
  if (!existing) return { state: 'not_connected', lastFailure: null };
  const { refreshStartedAt, lastFailure } = existing.record;
  const lockAgeSeconds = refreshStartedAt === null ? null : Math.max(0, Math.floor((Date.now() - refreshStartedAt) / 1000));
  return {
    state: lockAgeSeconds === null ? 'connected' : lockAgeSeconds < 120 ? 'renewing' : 'reauthorization_required',
    // An unlocked record is present, but this read-only check does not prove provider acceptance.
    providerVerified: false,
    refreshStartedAt: refreshStartedAt === null ? null : new Date(refreshStartedAt).toISOString(),
    lockAgeSeconds,
    incidentId: typeof existing.record.refreshIncidentId === 'string' && /^[a-f0-9-]{36}$/.test(existing.record.refreshIncidentId)
      ? existing.record.refreshIncidentId : null,
    lastFailure: readSafeIncident(lastFailure),
  };
}

function key() {
  const value = Buffer.from(required('MERCADO_LIBRE_TOKEN_ENCRYPTION_KEY'), 'base64');
  if (value.length !== 32) throw new Error('Encryption key must contain 32 bytes');
  return value;
}

function encrypt(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(required('MERCADO_LIBRE_SELLER_ID')));
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join('.');
}

function decrypt(value: string) {
  const [version, iv, tag, ciphertext] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Invalid encrypted token');
  const cipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  cipher.setAAD(Buffer.from(required('MERCADO_LIBRE_SELLER_ID')));
  cipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([cipher.update(Buffer.from(ciphertext, 'base64')), cipher.final()]).toString('utf8');
}

export async function saveAuthorization(sellerId: number, token: string) {
  if (String(sellerId) !== required('MERCADO_LIBRE_SELLER_ID')) throw new Error('Unexpected seller');
  try { await store().authorize(token); }
  catch (error) { throw safeFailure(error, 'credential_save'); }
}

export async function sharedAccessToken(renew: (token: string, save: (next: string, access: AccessToken) => Promise<void>) => Promise<AccessToken>) {
  return store().accessToken(renew);
}
