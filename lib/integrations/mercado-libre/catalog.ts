import 'server-only';
import { cache } from 'react';
import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import {
  findCatalogPublication as findStoredPublication,
  listActiveCatalogVehicles,
  type CatalogPublication,
} from '@/lib/catalog/store';
import { fullSizeMercadoLibreImageUrl } from './pictures';

/**
 * A server with MERCADO_LIBRE_BACKEND_URL (local development) reads the synced catalog through
 * the deployed backend. Otherwise the server reads its own synced copy from the database.
 * Neither path calls Mercado Libre during a page request.
 */
function readsRemoteBackend() {
  return Boolean(process.env.MERCADO_LIBRE_BACKEND_URL?.trim());
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
    redirect: 'error', signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Remote catalog unavailable');
  return response.json() as Promise<T>;
}

function withFullSizeImage(vehicle: Vehicle): Vehicle {
  return { ...vehicle, image: fullSizeMercadoLibreImageUrl(vehicle.image) ?? vehicle.image };
}

export const listCatalogVehicles = cache(async () => {
  if (!readsRemoteBackend()) return (await listActiveCatalogVehicles()).map(withFullSizeImage);
  const result = await remoteCatalog<{ vehicles: Vehicle[] }>();
  if (!result) throw new Error('Missing catalog');
  return result.vehicles.map(withFullSizeImage);
});

/**
 * Looks the publication up by the Mercado Libre ID at the end of the slug, in any status. The
 * returned vehicle carries the canonical slug, which can differ from the requested one.
 */
export const findCatalogPublication = cache(async (slug: string): Promise<CatalogPublication | null> => {
  const id = slug.match(/-(mla\d+)$/i)?.[1]?.toUpperCase();
  if (!id) return null;
  const result = readsRemoteBackend() ? await remoteCatalog<CatalogPublication>(id) : await findStoredPublication(id);
  return result ? { ...result, vehicle: withFullSizeImage(result.vehicle) } : null;
});

/** Only an exact canonical slug resolves to a vehicle. */
export const findCatalogVehicle = cache(async (slug: string) => {
  const vehicle = (await findCatalogPublication(slug))?.vehicle;
  return vehicle?.slug === slug ? vehicle : undefined;
});
