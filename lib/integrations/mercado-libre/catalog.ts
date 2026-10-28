import 'server-only';
import { cache } from 'react';
import { activeMockVehicles, findMockVehicle } from '@/features/vehicles/data/mock-vehicles';
import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import type { MercadoLibrePublication } from './types';

export function isLiveCatalog() {
  return process.env.VEHICLE_DATA_SOURCE === 'mercado-libre';
}

async function remoteCatalog<T>(item?: string): Promise<T | null> {
  const base = process.env.MERCADO_LIBRE_BACKEND_URL;
  const key = process.env.MERCADO_LIBRE_CATALOG_API_KEY;
  if (!base || !key) throw new Error('Missing remote catalog configuration');
  const url = new URL('/api/mercado-libre/catalog', base);
  if (url.protocol !== 'https:') throw new Error('Catalog backend requires HTTPS');
  if (item) url.searchParams.set('item', item);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` }, cache: 'no-store',
    redirect: 'error', signal: AbortSignal.timeout(90_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Remote catalog unavailable');
  return response.json() as Promise<T>;
}

export const listCatalogVehicles = cache(async () => {
  if (!isLiveCatalog()) return activeMockVehicles;
  const result = await remoteCatalog<{ vehicles: Vehicle[] }>();
  if (!result) throw new Error('Missing catalog');
  return result.vehicles;
});

export const findCatalogPublication = cache(async (slug: string): Promise<MercadoLibrePublication | null> => {
  if (!isLiveCatalog()) return null;
  const id = slug.match(/-(mla\d+)$/i)?.[1]?.toUpperCase();
  if (!id) return null;
  const result = await remoteCatalog<MercadoLibrePublication>(id);
  return result?.vehicle.slug === slug ? result : null;
});

export const findCatalogVehicle = cache(async (slug: string) => {
  if (!isLiveCatalog()) return findMockVehicle(slug);
  return (await findCatalogPublication(slug))?.vehicle;
});
