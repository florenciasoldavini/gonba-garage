import 'server-only';
import { revalidateTag, unstable_cache } from 'next/cache';
import { findCatalogPublication, listActiveCatalogVehicles } from './store';

/**
 * Page reads of the catalog copy, cached across requests and instances (on Vercel, the Runtime
 * Cache). The copy changes only when the sync worker writes it, so the worker expires the entries
 * of a publication right after a write that changed what pages show (expireCatalogPublication).
 * A failed read throws and is never stored.
 */

/** Every cached catalog read, to purge them all at once (`vercel cache invalidate --tag catalog`). */
const CATALOG_TAG = 'catalog';
/** The available cars: the home page, the catalog and the similar cars under each car. */
export const ACTIVE_VEHICLES_TAG = 'catalog:active';
/** One publication, any status: its car page. */
export const publicationTag = (id: string) => `catalog:publication:${id}`;

/**
 * Entries outlive a deploy, and a new deploy may read rows differently, so each deploy starts its
 * own. Outside Vercel there is no deployment ID and entries are keyed by the code alone.
 */
const deployment = process.env.VERCEL_DEPLOYMENT_ID ?? '';

/**
 * Invalidation is the way entries change. This only bounds an invalidation that never went
 * through: past it, the next read is served the entry while it is read again.
 */
const BACKSTOP_SECONDS = 24 * 60 * 60;

export const readActiveCatalogVehicles = unstable_cache(
  () => listActiveCatalogVehicles(),
  ['catalog-active-vehicles', deployment],
  { tags: [CATALOG_TAG, ACTIVE_VEHICLES_TAG], revalidate: BACKSTOP_SECONDS },
);

/** A missing publication is cached too (null): storing it later expires the entry. */
export function readCatalogPublication(id: string) {
  return unstable_cache(() => findCatalogPublication(id), ['catalog-publication', deployment, id], {
    tags: [CATALOG_TAG, publicationTag(id)],
    revalidate: BACKSTOP_SECONDS,
  })();
}

/**
 * Call after a write that changed a publication. The list is expired too: the car may have entered
 * or left it, or changed in it. Entries expire at once (`expire: 0`), so the next read waits for
 * the database instead of being served the old entry. Next.js applies the expiry when the route
 * handler, or the `after()` work of the webhook, finishes.
 */
export function expireCatalogPublication(id: string) {
  revalidateTag(publicationTag(id), { expire: 0 });
  revalidateTag(ACTIVE_VEHICLES_TAG, { expire: 0 });
}
