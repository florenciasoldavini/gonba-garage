import type { MetadataRoute } from 'next';

import { isSiteIndexingEnabled } from '@/lib/site-indexing';
import { getSiteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  const indexingEnabled = isSiteIndexingEnabled();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
    },
    ...(indexingEnabled
      ? {
          sitemap: new URL('/sitemap.xml', siteUrl).toString(),
          host: siteUrl.origin,
        }
      : {}),
  };
}
