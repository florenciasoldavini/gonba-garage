import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mapMercadoLibreItemToVehicle } from '@/features/vehicles/data/mercado-libre-vehicle-mapper';
import type {
  MercadoLibreBulkItem,
  MercadoLibreDescription,
  MercadoLibreItem,
  MercadoLibrePublication,
} from './types';

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
    items: MercadoLibrePublication[];
  };
};

const ITEMS_SEARCH_LIMIT = 100;
const ITEMS_BULK_LIMIT = 20;

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

async function fetchOptionalMercadoLibre<T>(path: string, accessToken: string) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (response.status === 404) return null;

  return parseMercadoLibreResponse<T>(response, `Mercado Libre GET ${path}`);
}

function chunks<T>(values: T[], size: number) {
  return Array.from(
    { length: Math.ceil(values.length / size) },
    (_, index) => values.slice(index * size, (index + 1) * size),
  );
}

async function readAllActiveItemIds(userId: number, accessToken: string) {
  const itemIds: string[] = [];
  let total = 0;
  let offset = 0;

  do {
    const search = await fetchMercadoLibre<MercadoLibreItemSearch>(
      `/users/${encodeURIComponent(userId)}/items/search?status=active&orders=start_time_desc&limit=${ITEMS_SEARCH_LIMIT}&offset=${offset}`,
      accessToken,
    );

    total = search.paging.total;
    itemIds.push(...search.results);
    if (search.results.length === 0) break;
    offset += search.results.length;
  } while (itemIds.length < total);

  return { itemIds, total };
}

async function readItems(itemIds: string[], accessToken: string) {
  const batches = await Promise.all(
    chunks(itemIds, ITEMS_BULK_LIMIT).map((batch) =>
      fetchMercadoLibre<MercadoLibreBulkItem[]>(
        `/items/bulk?ids=${batch.map(encodeURIComponent).join(',')}&include_internal_attributes=true`,
        accessToken,
      ),
    ),
  );

  return batches
    .flat()
    .filter(({ status_code }) => status_code === 200)
    .map(({ body }) => body);
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
  const { itemIds, total } = await readAllActiveItemIds(user.id, accessToken);
  const items = await readItems(itemIds, accessToken);
  const publications = items.map((item) => mapMercadoLibreItemToVehicle(item));

  return {
    seller: {
      id: user.id,
      nickname: user.nickname ?? null,
      siteId: user.site_id ?? null,
      userType: user.user_type ?? null,
    },
    publications: {
      total,
      sampled: publications.length,
      items: publications,
    },
  } satisfies MercadoLibreReadTest;
}

export async function readMercadoLibrePublication(
  itemId: string,
  accessToken: string,
): Promise<MercadoLibrePublication> {
  const [item, description] = await Promise.all([
    fetchMercadoLibre<MercadoLibreItem>(
      `/items/${encodeURIComponent(itemId)}?include_internal_attributes=true`,
      accessToken,
    ),
    fetchOptionalMercadoLibre<MercadoLibreDescription>(
      `/items/${encodeURIComponent(itemId)}/description`,
      accessToken,
    ),
  ]);

  return mapMercadoLibreItemToVehicle(item, description);
}
