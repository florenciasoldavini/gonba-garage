import 'server-only';
import { unstable_cache } from 'next/cache';
import { catalogAccessToken } from './access-token';
import { required } from './credentials';
import { failure } from './failures';
import { readMercadoLibrePublication, readMercadoLibrePublications } from './oauth';

// Server-side data cache shared by every public page view, so Mercado Libre load follows this
// window instead of traffic. Only public presentation data is stored: the access token is read
// inside each entry and is never part of a key or value. Failures are not cached.
const options = { revalidate: 300, tags: ['mercado-libre-catalog'] };

const activeVehicles = unstable_cache(async (seller: string) => {
  const catalog = await readMercadoLibrePublications(await catalogAccessToken());
  if (String(catalog.seller.id) !== seller) throw failure('catalog_query', 'unexpected_seller');
  return catalog.publications.items.map(({ vehicle }) => vehicle);
}, ['mercado-libre-active-vehicles'], options);

const activePublication = unstable_cache(async (seller: string, id: string) => {
  const publication = await readMercadoLibrePublication(id, await catalogAccessToken());
  if (String(publication.source.seller_id) !== seller || publication.vehicle.status !== 'active') return null;
  // Keep only public listing presentation data. Never cache or proxy private seller/account fields.
  const { title, pictures, attributes, permalink } = publication.source;
  return { vehicle: publication.vehicle, description: publication.description,
    source: { id: publication.source.id, title, pictures, attributes, permalink } };
}, ['mercado-libre-active-publication'], options);

export function listActiveCatalogVehicles() {
  return activeVehicles(required('MERCADO_LIBRE_SELLER_ID'));
}

export async function findActiveCatalogPublication(id: string) {
  const seller = required('MERCADO_LIBRE_SELLER_ID');
  // Unknown IDs are answered from the cached active set and never reach Mercado Libre.
  if (!(await activeVehicles(seller)).some(({ mercadoLibreId }) => mercadoLibreId === id)) return null;
  return activePublication(seller, id);
}
