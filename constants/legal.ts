// Person responsible for the site and its data (Ley 25.326), as published on the legal pages.
export const LEGAL_OWNER_NAME = 'Gonzalo Barreiro';
export const LEGAL_OWNER_CUIT = '20-40244857-2';
export const BUSINESS_LOCATION = 'Villa Pueyrredón, Ciudad Autónoma de Buenos Aires';
export const BUSINESS_HOURS = 'de lunes a viernes de 10 a 18 y los sábados de 10 a 13';

/** `updatedAt` is shown on each page and becomes its sitemap freshness at the indexing launch: change it with every revision. */
export const LEGAL_PAGES = {
  privacy: { path: '/privacidad', updatedAt: '2026-11-01' },
  terms: { path: '/terminos', updatedAt: '2026-11-01' },
} as const;
