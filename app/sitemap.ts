import type { MetadataRoute } from 'next';

// Indexing stays off until the final version of the site, so the sitemap lists nothing yet, whatever
// SITE_INDEXING_ENABLED says. Filling it is part of the indexing launch (docs/seo-and-social-metadata.md).
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
