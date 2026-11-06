import type { MetadataRoute } from 'next';

import { LEGAL_PAGES } from '@/constants/legal';
import { listCatalogVehicles } from '@/lib/integrations/mercado-libre/catalog';
import { isSiteIndexingEnabled } from '@/lib/site-indexing';
import { getSiteUrl } from '@/lib/site-url';

// Rendered per request, like the catalog: the list follows the sync, and a build never needs the database.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isSiteIndexingEnabled()) return [];

  const siteUrl = getSiteUrl();
  const entry = (path: string, lastModified?: string) => ({ url: new URL(path, siteUrl).toString(), lastModified });

  // Reserved and sold cars stay out. A failed read fails the sitemap, so crawlers keep their last good copy.
  const vehicles = (await listCatalogVehicles()).filter(({ status }) => status === 'active');
  // The home page and the catalog change when a listed car does. There is no such date without cars.
  const catalogUpdatedAt = vehicles
    .map(({ updatedAt }) => updatedAt)
    .sort()
    .at(-1);

  return [
    entry('/', catalogUpdatedAt),
    entry('/vehiculos', catalogUpdatedAt),
    entry('/vender'),
    entry(LEGAL_PAGES.privacy.path, LEGAL_PAGES.privacy.updatedAt),
    entry(LEGAL_PAGES.terms.path, LEGAL_PAGES.terms.updatedAt),
    ...vehicles.map(({ slug, updatedAt }) => entry(`/vehiculos/${slug}`, updatedAt)),
  ];
}
