import 'server-only';
import { cache } from 'react';
import { activeMockVehicles, findMockVehicle } from '@/features/vehicles/data/mock-vehicles';
import { readMercadoLibrePublications, readMercadoLibrePublication } from './oauth';
import type { MercadoLibrePublication } from './types';

const session = globalThis as typeof globalThis & {
  mercadoLibreLocalSession?: { accessToken: string; expiresAt: number };
};

export function isLiveCatalog() {
  return process.env.VEHICLE_DATA_SOURCE === 'mercado-libre';
}

export function setLocalCatalogSession(accessToken: string, expiresIn: number) {
  if (process.env.NODE_ENV !== 'development') return;
  session.mercadoLibreLocalSession = { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
}

function accessToken() {
  const current = session.mercadoLibreLocalSession;
  if (current && current.expiresAt > Date.now()) return current.accessToken;
  throw new Error('Conectá Mercado Libre para iniciar una sesión local de lectura.');
}

export const listCatalogVehicles = cache(async () => {
  if (!isLiveCatalog()) return activeMockVehicles;
  const result = await readMercadoLibrePublications(accessToken());
  return result.publications.items.map(({ vehicle }) => vehicle);
});

export const findCatalogPublication = cache(async (slug: string): Promise<MercadoLibrePublication | null> => {
  if (!isLiveCatalog()) return null;
  const id = slug.match(/-(mla\d+)$/i)?.[1]?.toUpperCase();
  if (!id) return null;
  const result = await readMercadoLibrePublication(id, accessToken());
  return result.vehicle.slug === slug && result.vehicle.status === 'active' ? result : null;
});

export const findCatalogVehicle = cache(async (slug: string) => {
  if (!isLiveCatalog()) return findMockVehicle(slug);
  return (await findCatalogPublication(slug))?.vehicle;
});
