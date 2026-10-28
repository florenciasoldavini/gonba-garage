import type { MetadataRoute } from 'next';

import { activeMockVehicles } from '@/features/vehicles/data/mock-vehicles';
import { isSiteIndexingEnabled } from '@/lib/site-indexing';
import { getSiteUrl } from '@/lib/site-url';
import { isLiveCatalog } from '@/lib/integrations/mercado-libre/catalog';

export default function sitemap(): MetadataRoute.Sitemap {
  if (isLiveCatalog()) return [];
  if (!isSiteIndexingEnabled()) return [];

  const siteUrl = getSiteUrl();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: new URL('/', siteUrl).toString(), priority: 1, changeFrequency: 'weekly' },
    { url: new URL('/vehiculos', siteUrl).toString(), priority: 0.9, changeFrequency: 'daily' },
    { url: new URL('/vender', siteUrl).toString(), priority: 0.8, changeFrequency: 'monthly' },
  ];
  const vehicleRoutes: MetadataRoute.Sitemap = activeMockVehicles.map((vehicle) => ({
    url: new URL(`/vehiculos/${vehicle.slug}`, siteUrl).toString(),
    lastModified: new Date(vehicle.updatedAt),
    priority: 0.8,
    changeFrequency: 'daily',
  }));

  return [...staticRoutes, ...vehicleRoutes];
}
