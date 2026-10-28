import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { securelyMatches } from './oauth';

export function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function authorized(request: Request) {
  const expected = process.env.MERCADO_LIBRE_CATALOG_API_KEY?.trim();
  return !!expected && securelyMatches(request.headers.get('authorization') ?? '', `Bearer ${expected}`);
}

function db() {
  return createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).from('mercado_libre_credentials');
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
  const { error } = await db().insert({ seller_id: String(sellerId), encrypted_refresh_token: encrypt(token) });
  if (error?.code === '23505') {
    await withRefreshToken(async (_previous, save) => { await save(token); });
    return;
  }
  if (error) throw new Error('Unable to save connection');
}

export async function withRefreshToken<T>(operation: (token: string, save: (next: string) => Promise<void>) => Promise<T>) {
  const seller = required('MERCADO_LIBRE_SELLER_ID');
  const lease = randomUUID();
  const now = Date.now();
  const { data, error } = await db().update({ lease_id: lease, lease_until: new Date(now + 120_000).toISOString() })
    .eq('seller_id', seller).lt('lease_until', new Date(now).toISOString()).select('encrypted_refresh_token').maybeSingle();
  if (error || !data) throw new Error('Connection unavailable or renewal already in progress');
  try {
    return await operation(decrypt(data.encrypted_refresh_token), async (next) => {
      const { data: updated, error: saveError } = await db().update({ encrypted_refresh_token: encrypt(next), updated_at: new Date().toISOString() })
        .eq('seller_id', seller).eq('lease_id', lease).select('seller_id').single();
      if (saveError || !updated) throw new Error('Unable to persist rotated refresh token');
    });
  } finally {
    await db().update({ lease_id: null, lease_until: new Date(0).toISOString() }).eq('seller_id', seller).eq('lease_id', lease);
  }
}
