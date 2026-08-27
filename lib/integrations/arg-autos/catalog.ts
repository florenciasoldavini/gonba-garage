import 'server-only';

export type CatalogResource = 'brands' | 'models' | 'versions';

export type CatalogOption = {
  id: string;
  name: string;
  availableYears?: number[];
};

type ArgAutosItem = {
  id: number | string;
  name: string | null;
  available_years?: number[] | null;
};

type ArgAutosPage = {
  data?: ArgAutosItem[];
  links?: { next?: string | null };
};

const API_BASE_URL = 'https://argautos.com/api/v1';
const MAX_PAGES = 20;

export const ARG_AUTOS_CACHE_SECONDS = 24 * 60 * 60;

function getResourcePath(resource: CatalogResource, parentId?: string) {
  if (resource === 'brands') return '/brands';
  if (resource === 'models' && parentId) return `/brands/${parentId}/models`;
  if (resource === 'versions' && parentId) return `/models/${parentId}/versions`;

  throw new Error(`A parent ID is required for the ${resource} catalog`);
}

export async function fetchVehicleCatalog(resource: CatalogResource, parentId?: string) {
  const path = getResourcePath(resource, parentId);
  const options: CatalogOption[] = [];
  const headers: HeadersInit = { Accept: 'application/json' };
  const apiKey = process.env.ARGAUTOS_API_KEY?.trim();

  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(`${API_BASE_URL}${path}`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', '100');

    if (resource === 'versions') url.searchParams.append('relations[]', 'years');

    const response = await fetch(url, {
      headers,
      next: { revalidate: ARG_AUTOS_CACHE_SECONDS },
    });

    if (!response.ok) throw new Error(`Arg Autos responded with ${response.status}`);

    const payload = (await response.json()) as ArgAutosPage;
    if (!Array.isArray(payload.data)) throw new Error('Unexpected Arg Autos response');

    for (const item of payload.data) {
      const hasValidId = typeof item.id === 'number' || typeof item.id === 'string';

      if (hasValidId && typeof item.name === 'string') {
        options.push({
          id: String(item.id),
          name: item.name,
          ...(Array.isArray(item.available_years) ? { availableYears: item.available_years } : {}),
        });
      }
    }

    if (!payload.links?.next) break;
  }

  return options;
}
