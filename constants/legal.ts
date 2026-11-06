import { BUSINESS_AREA, BUSINESS_SCHEDULE } from '@/constants/contact';

// Person responsible for the site and its data (Ley 25.326), as published on the legal pages.
export const LEGAL_OWNER_NAME = 'Gonzalo Barreiro';
export const LEGAL_OWNER_CUIT = '20-40244857-2';
export const BUSINESS_LOCATION = `${BUSINESS_AREA.locality}, ${BUSINESS_AREA.regionName}`;
// Running text for the terms, e.g. "de lunes a viernes de 10 a 18 y los sábados de 10 a 13".
export const LEGAL_BUSINESS_HOURS_TEXT = new Intl.ListFormat('es').format(
  BUSINESS_SCHEDULE.map(
    ({ days, opens, closes }) =>
      `${days.length > 1 ? `de ${days.join(' a ')}` : `los ${days[0]}`} de ${opens} a ${closes}`,
  ),
);

/** `updatedAt` is shown on each page and is its sitemap freshness: change it with every revision. */
export const LEGAL_PAGES = {
  privacy: { path: '/privacidad', updatedAt: '2026-11-05' },
  terms: { path: '/terminos', updatedAt: '2026-11-05' },
} as const;
