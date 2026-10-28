import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const AUTHORIZATION_URL = 'https://auth.mercadolibre.com.ar/authorization';
const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const API_URL = 'https://api.mercadolibre.com';

type MercadoLibreTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token?: string;
};

type MercadoLibreUser = {
  id: number;
  nickname?: string;
  site_id?: string;
  user_type?: string;
};

type MercadoLibreItemSearch = {
  seller_id: number;
  paging: {
    total: number;
    offset: number;
    limit: number;
  };
  results: string[];
};

type MercadoLibreItem = {
  id: string;
  title: string;
  category_id?: string;
  price?: number;
  currency_id?: string;
  available_quantity?: number;
  status?: string;
  permalink?: string;
  thumbnail?: string;
  attributes?: Array<{
    id: string;
    name: string;
    value_name?: string | null;
  }>;
};

type MercadoLibreMultiGetItem = {
  code: number;
  body: MercadoLibreItem;
};

export type MercadoLibreReadTest = {
  seller: {
    id: number;
    nickname: string | null;
    siteId: string | null;
    userType: string | null;
  };
  publications: {
    total: number;
    sampled: number;
    items: Array<{
      id: string;
      title: string;
      categoryId: string | null;
      price: number | null;
      currencyId: string | null;
      availableQuantity: number | null;
      status: string | null;
      permalink: string | null;
      thumbnail: string | null;
      attributes: Array<{
        id: string;
        name: string;
        value: string | null;
      }>;
    }>;
  };
};

function requiredEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function toBase64Url(value: Buffer) {
  return value.toString('base64url');
}

async function parseMercadoLibreResponse<T>(response: Response, operation: string) {
  if (!response.ok) {
    const requestId = response.headers.get('x-request-id');
    throw new Error(
      `${operation} failed with status ${response.status}${requestId ? ` (request ${requestId})` : ''}`,
    );
  }

  return response.json() as Promise<T>;
}

async function fetchMercadoLibre<T>(path: string, accessToken: string) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  return parseMercadoLibreResponse<T>(response, `Mercado Libre GET ${path}`);
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
  const clientId = requiredEnvironmentVariable('MERCADO_LIBRE_CLIENT_ID');
  const redirectUri = requiredEnvironmentVariable('MERCADO_LIBRE_REDIRECT_URI');
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
  const clientId = requiredEnvironmentVariable('MERCADO_LIBRE_CLIENT_ID');
  const clientSecret = requiredEnvironmentVariable('MERCADO_LIBRE_CLIENT_SECRET');
  const redirectUri = requiredEnvironmentVariable('MERCADO_LIBRE_REDIRECT_URI');
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
    cache: 'no-store',
  });

  return parseMercadoLibreResponse<MercadoLibreTokenResponse>(
    response,
    'Mercado Libre authorization-code exchange',
  );
}

export async function readMercadoLibrePublications(accessToken: string) {
  const user = await fetchMercadoLibre<MercadoLibreUser>('/users/me', accessToken);
  const search = await fetchMercadoLibre<MercadoLibreItemSearch>(
    `/users/${encodeURIComponent(user.id)}/items/search?limit=10&offset=0`,
    accessToken,
  );
  const itemIds = search.results.slice(0, 10);
  const multiGet = itemIds.length > 0
    ? await fetchMercadoLibre<MercadoLibreMultiGetItem[]>(
        `/items?ids=${itemIds.map(encodeURIComponent).join(',')}`,
        accessToken,
      )
    : [];

  const items = multiGet
    .filter(({ code }) => code === 200)
    .map(({ body }) => ({
      id: body.id,
      title: body.title,
      categoryId: body.category_id ?? null,
      price: body.price ?? null,
      currencyId: body.currency_id ?? null,
      availableQuantity: body.available_quantity ?? null,
      status: body.status ?? null,
      permalink: body.permalink ?? null,
      thumbnail: body.thumbnail ?? null,
      attributes: (body.attributes ?? []).map((attribute) => ({
        id: attribute.id,
        name: attribute.name,
        value: attribute.value_name ?? null,
      })),
    }));

  return {
    seller: {
      id: user.id,
      nickname: user.nickname ?? null,
      siteId: user.site_id ?? null,
      userType: user.user_type ?? null,
    },
    publications: {
      total: search.paging.total,
      sampled: items.length,
      items,
    },
  } satisfies MercadoLibreReadTest;
}
