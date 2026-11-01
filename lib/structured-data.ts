import 'server-only';

import { BUSINESS_AREA, INSTAGRAM_URL, WHATSAPP_NUMBER } from '@/constants/contact';
import { SITE_NAME } from '@/lib/metadata';
import { getSiteUrl } from '@/lib/site-url';

export const ORGANIZATION_SCHEMA_ID = '#organization';
export const WEBSITE_SCHEMA_ID = '#website';

export function getSiteStructuredData() {
  const siteUrl = getSiteUrl();
  const homeUrl = new URL('/', siteUrl).toString();

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': new URL(WEBSITE_SCHEMA_ID, siteUrl).toString(),
        url: homeUrl,
        name: SITE_NAME,
        inLanguage: 'es-AR',
        publisher: { '@id': new URL(ORGANIZATION_SCHEMA_ID, siteUrl).toString() },
      },
      {
        '@type': 'AutoDealer',
        '@id': new URL(ORGANIZATION_SCHEMA_ID, siteUrl).toString(),
        url: homeUrl,
        name: SITE_NAME,
        description: 'Compra y venta de autos usados seleccionados con atención personalizada.',
        logo: new URL('/brand/gonba-garage-logo-512.png', siteUrl).toString(),
        telephone: `+${WHATSAPP_NUMBER}`,
        // Locality only: there is no public street address. Opening hours are omitted on purpose
        // because visits are by appointment and schema hours would read as walk-in hours.
        address: {
          '@type': 'PostalAddress',
          addressLocality: BUSINESS_AREA.locality,
          addressRegion: BUSINESS_AREA.region,
          addressCountry: BUSINESS_AREA.country,
        },
        areaServed: {
          '@type': 'AdministrativeArea',
          name: 'Buenos Aires, Argentina',
        },
        sameAs: [INSTAGRAM_URL],
      },
    ],
  };
}
