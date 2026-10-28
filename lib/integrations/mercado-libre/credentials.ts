import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { securelyMatches } from './oauth';
import { createRefreshTokenStore, type TokenRecord } from './refresh-token-store';

export function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function authorized(request: Request) {
  const expected = process.env.MERCADO_LIBRE_CATALOG_API_KEY?.trim();
  return !!expected && securelyMatches(request.headers.get('authorization') ?? '', `Bearer ${expected}`);
}

function store() {
  const seller = required('MERCADO_LIBRE_SELLER_ID');
  if (!/^\d+$/.test(seller)) throw new Error('Invalid seller ID');
  const pathname = `mercado-libre/${seller}/refresh-token.json`;
  return createRefreshTokenStore({
    async read() {
      const result = await get(pathname, { access: 'private', useCache: false });
      if (!result) return null;
      if (result.statusCode !== 200) throw new Error('Unable to read credentials');
      const record = await new Response(result.stream).json() as TokenRecord;
      if (record.version !== 1 || typeof record.encryptedRefreshToken !== 'string' ||
        (record.refreshStartedAt !== null && !Number.isFinite(record.refreshStartedAt))) throw new Error('Invalid credential record');
      return { record, etag: result.blob.etag };
    },
    async write(record, etag) {
      const result = await put(pathname, JSON.stringify(record), {
        access: 'private', addRandomSuffix: false, allowOverwrite: !!etag,
        ...(etag ? { ifMatch: etag } : {}), contentType: 'application/json',
      });
      return result.etag;
    },
  }, encrypt, decrypt);
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
  await store().authorize(token);
}

export async function withRefreshToken<T>(operation: (token: string, save: (next: string) => Promise<void>) => Promise<T>) {
  return store().refresh(operation);
}
