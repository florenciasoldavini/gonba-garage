import 'server-only';
import { cache } from 'react';
import { VEHICLE_PHOTO_PLACEHOLDER, type Vehicle } from '@/features/vehicles/domain/vehicle';
import { orderFeaturedVehicles } from '@/features/vehicles/domain/featured-order';
import { cleanCatalogVehicle } from '@/features/vehicles/presentation/listing-cleanup';
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

// Publications saved before the placeholder existed store the home-page showroom photo as their
// image. A re-read replaces it, but closed publications are never read again, so reads swap it.
const PREVIOUS_PHOTO_FALLBACK = '/showroom-car.jpg';

function withFullSizeImage(vehicle: Vehicle): Vehicle {
  if (vehicle.image === PREVIOUS_PHOTO_FALLBACK) return { ...vehicle, image: VEHICLE_PHOTO_PLACEHOLDER };
  return { ...vehicle, image: fullSizeMercadoLibreImageUrl(vehicle.image) ?? vehicle.image };
}

/** The vehicle as every page shows it: full-size image and the automatic cleanup of the listing text. */
function presentVehicle(vehicle: Vehicle, attributes?: CatalogPublication['source']['attributes']): Vehicle {
  return cleanCatalogVehicle(withFullSizeImage(vehicle), attributes);
}

/** Available vehicles in the default ("Destacados") order, which the home page also uses. */
export const listCatalogVehicles = cache(async () => {
  if (!readsRemoteBackend()) return orderFeaturedVehicles((await listActiveCatalogVehicles()).map(vehicle => presentVehicle(vehicle)));
  const result = await remoteCatalog<{ vehicles: Vehicle[] }>();
  if (!result) throw new Error('Missing catalog');
  return orderFeaturedVehicles(result.vehicles.map(vehicle => presentVehicle(vehicle)));
});

/**
 * Looks the publication up by the Mercado Libre ID at the end of the slug, in any status. The
 * returned vehicle carries the canonical slug, which can differ from the requested one.
 */
export const findCatalogPublication = cache(async (slug: string): Promise<CatalogPublication | null> => {
  const id = slug.match(/-(mla\d+)$/i)?.[1]?.toUpperCase();
  if (!id) return null;
  const result = readsRemoteBackend() ? await remoteCatalog<CatalogPublication>(id) : await findStoredPublication(id);
  return result ? { ...result, vehicle: presentVehicle(result.vehicle, result.source.attributes) } : null;
});

/** Only an exact canonical slug resolves to a vehicle. */
export const findCatalogVehicle = cache(async (slug: string) => {
  const vehicle = (await findCatalogPublication(slug))?.vehicle;
  return vehicle?.slug === slug ? vehicle : undefined;
});
