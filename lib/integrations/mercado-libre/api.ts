import 'server-only';

import { failure, safeFailure, type IntegrationIncident } from './failures';
import { parseMercadoLibreResponse } from './response';
import { mapMercadoLibreItemToVehicle } from '@/features/vehicles/data/mercado-libre-vehicle-mapper';
import type { MercadoLibreBulkItem, MercadoLibreDescription, MercadoLibreItem, MercadoLibrePublication } from './types';

// The Mercado Libre read API: the seller, its items, bulk item reads and categories. OAuth (authorization,
// code exchange and token refresh) is in oauth.ts.
const API_URL = 'https://api.mercadolibre.com';

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
  results: string[] | null;
  scroll_id?: string;
};

type MercadoLibreCategory = {
  id: string;
  path_from_root?: Array<{ id: string; name?: string }>;
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
    /** Items the scan listed that the bulk read did not return, each with a safe incident. */
    unread: Array<{ id: string; incident: IntegrationIncident }>;
  };
};

const ITEMS_SEARCH_LIMIT = 100;
const ITEMS_BULK_LIMIT = 20;
/** Bulk requests in flight at once, so a large catalog is not one burst that invites HTTP 429. */
export const ITEMS_BULK_CONCURRENCY = 4;

async function fetchMercadoLibre<T>(path: string, accessToken: string) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  }).catch(error => {
    throw safeFailure(error, 'catalog_query');
  });

  return parseMercadoLibreResponse<T>(response, 'catalog_query');
}

async function fetchOptionalMercadoLibre<T>(path: string, accessToken: string) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  }).catch(error => {
    throw safeFailure(error, 'catalog_query');
  });

  if (response.status === 404) return null;

  return parseMercadoLibreResponse<T>(response, 'catalog_query');
}

function chunks<T>(values: T[], size: number) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  );
}

/** Maps every value, at most `limit` at a time, in order. No new work starts after a failure. */
async function mapConcurrently<T, R>(values: T[], limit: number, map: (value: T) => Promise<R>) {
  const results: R[] = [];
  let next = 0;
  const worker = async () => {
    while (next < values.length) {
      const index = next++;
      try {
        results[index] = await map(values[index]);
      } catch (error) {
        next = values.length;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

/**
 * Every publication of the seller, in any status (active, paused, closed and so on). Scan mode has no
 * offset ceiling. A short scan only leaves items out, which reconciliation treats as "read again".
 */
async function readAllItemIds(userId: number, accessToken: string) {
  const itemIds = new Set<string>();
  let total = 0;
  let scrollId: string | undefined;

  for (;;) {
    const query = new URLSearchParams({ search_type: 'scan', limit: String(ITEMS_SEARCH_LIMIT) });
    if (scrollId) query.set('scroll_id', scrollId);
    const search = await fetchMercadoLibre<MercadoLibreItemSearch>(
      `/users/${encodeURIComponent(userId)}/items/search?${query}`,
      accessToken,
    );

    total = search.paging.total;
    const previousSize = itemIds.size;
    for (const id of search.results ?? []) itemIds.add(id);
    if (itemIds.size >= total || itemIds.size === previousSize || !search.scroll_id) break;
    scrollId = search.scroll_id;
  }

  return { itemIds: [...itemIds], total };
}

/** Why the bulk read did not return an item. Only the per-item HTTP status is kept. */
function unreadIncident(statusCode: unknown) {
  const httpError =
    typeof statusCode === 'number' && Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599;
  return failure(
    'catalog_query',
    httpError ? 'http_error' : 'invalid_response',
    httpError ? { httpStatus: statusCode } : {},
  ).incident;
}

/**
 * An item deleted since the scan, or a per-item error, is returned as unread rather than failing the
 * whole read, so the caller can read it again on its own. A failed bulk request still fails it.
 */
async function readItems(itemIds: string[], accessToken: string) {
  const batches = await mapConcurrently(chunks(itemIds, ITEMS_BULK_LIMIT), ITEMS_BULK_CONCURRENCY, async batch => {
    const entries = await fetchMercadoLibre<MercadoLibreBulkItem[]>(
      `/items/bulk?ids=${batch.map(encodeURIComponent).join(',')}&include_internal_attributes=true`,
      accessToken,
    );
    const byId = new Map(entries.map(entry => [entry.body?.id ?? entry.id, entry]));
    return batch.map(id => ({ id, entry: byId.get(id) }));
  });
  const items: MercadoLibreItem[] = [];
  const unread: MercadoLibreReadTest['publications']['unread'] = [];
  for (const { id, entry } of batches.flat()) {
    if (entry?.status_code === 200 && entry.body?.id === id) items.push(entry.body);
    else unread.push({ id, incident: unreadIncident(entry?.status_code) });
  }
  return { items, unread };
}

export async function readMercadoLibrePublications(accessToken: string) {
  const user = await fetchMercadoLibre<MercadoLibreUser>('/users/me', accessToken);
  const { itemIds, total } = await readAllItemIds(user.id, accessToken);
  const { items, unread } = await readItems(itemIds, accessToken);
  const publications = items.map(item => mapMercadoLibreItemToVehicle(item));

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
      unread,
    },
  } satisfies MercadoLibreReadTest;
}

/** The category's ancestry, root first and ending with the category itself. */
export async function readMercadoLibreCategoryPath(categoryId: string, accessToken: string) {
  const category = await fetchMercadoLibre<MercadoLibreCategory>(
    `/categories/${encodeURIComponent(categoryId)}`,
    accessToken,
  );
  if (!Array.isArray(category.path_from_root) || !category.path_from_root.length)
    throw failure('catalog_query', 'invalid_response');
  return category.path_from_root.map(({ id }) => id);
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
    fetchOptionalMercadoLibre<MercadoLibreDescription>(`/items/${encodeURIComponent(itemId)}/description`, accessToken),
  ]);

  return mapMercadoLibreItemToVehicle(item, description);
}
