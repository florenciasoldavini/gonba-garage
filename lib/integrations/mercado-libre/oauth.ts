import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { requireMercadoLibreEnv } from '@/lib/env';
import { safeFailure } from './failures';
import { parseMercadoLibreResponse } from './response';

// Mercado Libre OAuth: the authorization URL with PKCE, the code exchange and token refresh. The read
// API (items, bulk reads, categories, users) is in api.ts.
const AUTHORIZATION_URL = 'https://auth.mercadolibre.com.ar/authorization';
const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';

type MercadoLibreTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token?: string;
};

function toBase64Url(value: Buffer) {
  return value.toString('base64url');
}

export function createMercadoLibreOAuthAttempt() {
  const verifier = toBase64Url(randomBytes(48));
  const challenge = createHash('sha256').update(verifier).digest('base64url');

  return {
    state: toBase64Url(randomBytes(32)),
    verifier,
    challenge,
  };
}

export function buildMercadoLibreAuthorizationUrl(state: string, challenge: string) {
  const clientId = requireMercadoLibreEnv('clientId');
  const redirectUri = requireMercadoLibreEnv('redirectUri');
  const url = new URL(AUTHORIZATION_URL);

  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  return url;
}

export function securelyMatches(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function exchangeMercadoLibreAuthorizationCode(code: string, verifier: string) {
  const clientId = requireMercadoLibreEnv('clientId');
  const clientSecret = requireMercadoLibreEnv('clientSecret');
  const redirectUri = requireMercadoLibreEnv('redirectUri');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
    cache: 'no-store', signal: AbortSignal.timeout(20_000),
  }).catch(error => { throw safeFailure(error, 'authorization_exchange'); });

  return parseMercadoLibreResponse<MercadoLibreTokenResponse>(
    response,
    'Mercado Libre authorization-code exchange',
  );
}

export async function refreshMercadoLibreToken(refreshToken: string) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: requireMercadoLibreEnv('clientId'),
      client_secret: requireMercadoLibreEnv('clientSecret'),
      refresh_token: refreshToken,
    }),
    cache: 'no-store', signal: AbortSignal.timeout(20_000),
  }).catch(error => { throw safeFailure(error, 'token_refresh'); });
  return parseMercadoLibreResponse<MercadoLibreTokenResponse>(response, 'Mercado Libre token refresh');
}
