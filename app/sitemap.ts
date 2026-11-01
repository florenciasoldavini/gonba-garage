import type { MetadataRoute } from 'next';

import { LEGAL_PAGES } from '@/constants/legal';
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
  const legalRoutes: MetadataRoute.Sitemap = Object.values(LEGAL_PAGES).map((page) => ({
    url: new URL(page.path, siteUrl).toString(),
    lastModified: new Date(page.updatedAt),
    priority: 0.3,
    changeFrequency: 'yearly',
  }));
  const vehicleRoutes: MetadataRoute.Sitemap = activeMockVehicles.map((vehicle) => ({
    url: new URL(`/vehiculos/${vehicle.slug}`, siteUrl).toString(),
    lastModified: new Date(vehicle.updatedAt),
    priority: 0.8,
    changeFrequency: 'daily',
  }));

  return [...staticRoutes, ...legalRoutes, ...vehicleRoutes];
}
