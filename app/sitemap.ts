import type { MetadataRoute } from 'next';

import { mockVehicles } from '@/features/vehicles/data/mock-vehicles';
import { getSiteUrl } from '@/lib/site-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: new URL('/', siteUrl).toString(), priority: 1, changeFrequency: 'weekly' },
    { url: new URL('/vehiculos', siteUrl).toString(), priority: 0.9, changeFrequency: 'daily' },
    { url: new URL('/vender', siteUrl).toString(), priority: 0.8, changeFrequency: 'monthly' },
  ];
  const vehicleRoutes: MetadataRoute.Sitemap = mockVehicles.map((vehicle) => ({
    url: new URL(`/vehiculos/${vehicle.slug}`, siteUrl).toString(),
    ...(vehicle.updatedAt ? { lastModified: new Date(vehicle.updatedAt) } : {}),
    priority: 0.8,
    changeFrequency: 'daily',
  }));

  return [...staticRoutes, ...vehicleRoutes];
}
