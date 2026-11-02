import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  acquireNotificationDrain, acquireReconciliation, completeCatalogJob, enqueueCatalogJobs, enqueueCatalogNotification,
  failCatalogJob, finishReconciliation, hasDueNotificationJobs, leaseCatalogJob, markPublicationRemoved, pruneCatalogJobs,
  readStoredSyncState, releaseNotificationDrain, renewNotificationDrain, savePublication,
} from '@/lib/catalog/store';
import { catalogAccessToken } from './access-token';
import { failure, IntegrationFailure, safeFailure, type IntegrationIncident } from './failures';
import { readMercadoLibreCategoryPath, readMercadoLibrePublication, readMercadoLibrePublications } from './oauth';
import type { MercadoLibreItem } from './types';
import { vehicleCategoryOf, type VehicleCategory } from './vehicle-categories';

/** Rows not refreshed for a day are read again, which also picks up description-only edits. */
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Notifications for an item never stored are ignored this long after a read found it missing, or
 * of another seller. Short for missing items, in case a new listing was read before it existed.
 */
const SKIP_NOT_FOUND_SECONDS = 60 * 60;
const SKIP_OTHER_SELLER_SECONDS = 24 * 60 * 60;

const vehicleCategories = new Map<string, Promise<VehicleCategory | null>>();

/**
 * The car, pickup or motorcycle category that qualifies the item (vehicle-categories.ts), or null
 * when it is anything else. Cached per category. An item without a category is an unexpected
 * response, retried later rather than guessed.
 */
async function vehicleCategory(item: MercadoLibreItem) {
  const categoryId = item.category_id;
  if (typeof categoryId !== 'string' || !/^MLA\d+$/.test(categoryId)) throw failure('catalog_query', 'invalid_response');
  let result = vehicleCategories.get(categoryId);
  if (!result) {
    result = catalogAccessToken()
      .then(token => readMercadoLibreCategoryPath(categoryId, token))
      .then(vehicleCategoryOf);
    vehicleCategories.set(categoryId, result);
    result.catch(() => vehicleCategories.delete(categoryId));
  }
  return result;
}

function sellerId() {
  const seller = process.env.MERCADO_LIBRE_SELLER_ID?.trim();
  if (!seller) throw failure('configuration', 'missing_configuration');
  return seller;
}

function lastUpdatedTime(value?: string) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : null;
}

function incidentCode({ stage, code, httpStatus }: IntegrationIncident) {
  return [stage, code, httpStatus].filter(Boolean).join(':');
}

/**
 * A notification only means "go check this item". It is queued durably before the webhook
 * acknowledges it, and its payload is never trusted: the worker always reads the item again.
 * Returns whether the webhook should start a drain; `verified: false` (a source outside
 * MERCADO_LIBRE_WEBHOOK_IPS) queues the item for the daily cron only.
 */
export async function enqueueCatalogSync(id: string, { verified = true } = {}) {
  return enqueueCatalogNotification(id, { deferred: !verified });
}

/** Null when Mercado Libre no longer has the item. Description 404s are already optional. */
async function readCurrentPublication(id: string) {
  try {
    return await readMercadoLibrePublication(id, await catalogAccessToken());
  } catch (error) {
    if (error instanceof IntegrationFailure && error.incident.stage === 'catalog_query' && error.incident.httpStatus === 404) return null;
    throw error;
  }
}

/** Processes one due item. Returns false when nothing is due. */
export async function processNextCatalogJob({ includeDeferred = true } = {}) {
  const lease = randomUUID();
  const job = await leaseCatalogJob(lease, { includeDeferred });
  if (!job) return false;
  try {
    const seller = sellerId();
    const publication = await readCurrentPublication(job.id);
    let skipSeconds = 0;
    if (!publication) {
      // A stored vehicle is closed, and never skipped. Only an item never stored is.
      if (!(await markPublicationRemoved(job.id, lease))) skipSeconds = SKIP_NOT_FOUND_SECONDS;
    } else if (String(publication.source.seller_id) === seller && publication.source.id === job.id) {
      const category = await vehicleCategory(publication.source);
      if (category) await savePublication(publication, category, lease);
    } else if (String(publication.source.seller_id) !== seller) {
      skipSeconds = SKIP_OTHER_SELLER_SECONDS;
    }
    // Items of other sellers and items that are not vehicles are never stored. The job is done either way.
    await completeCatalogJob(job.id, lease, job.revision, skipSeconds);
  } catch (error) {
    const incident = safeFailure(error, 'catalog_sync').incident;
    await failCatalogJob(job.id, lease, job.revision, job.attempts, incidentCode(incident));
    console.error(JSON.stringify({ event: 'catalog_sync_retry', publicationId: job.id, ...incident }));
  }
  return true;
}

/**
 * Drains due items within a time budget. Items in backoff wait for the next run. Deferred items
 * come last, and only with `includeDeferred`. `renew` is checked before each item.
 */
export async function runCatalogSyncWork({ budgetMs = 200_000, maxItems = 200, includeDeferred = true,
  renew = async () => true } = {}) {
  const deadline = Date.now() + budgetMs;
  let processed = 0;
  while (Date.now() < deadline && processed < maxItems && await renew()
    && await processNextCatalogJob({ includeDeferred })) processed++;
  return processed;
}

/**
 * The webhook's drain. Only one runs at a time (a lease), and it never reads deferred items. A
 * notification that finds the lease taken starts nothing, so after releasing it the drain checks
 * once more for work queued meanwhile.
 */
export async function runCatalogSyncWorkSafely({ budgetMs = 200_000, maxItems = 200 } = {}) {
  try {
    const deadline = Date.now() + budgetMs;
    let processed = 0;
    do {
      const lease = randomUUID();
      if (!(await acquireNotificationDrain(lease))) return;
      try {
        processed += await runCatalogSyncWork({ budgetMs: deadline - Date.now(), maxItems: maxItems - processed,
          includeDeferred: false, renew: () => renewNotificationDrain(lease) });
      } finally {
        await releaseNotificationDrain(lease);
      }
    } while (Date.now() < deadline && processed < maxItems && await hasDueNotificationJobs());
  } catch { console.error(JSON.stringify({ event: 'catalog_sync_worker_failure' })); }
}

/**
 * Repairs missed notifications and backfills the copy. Compares every vehicle the seller has on
 * Mercado Libre, in any status, with the local copy and queues each one that is missing, changed,
 * no longer listed, or not refreshed for a day, and each one the bulk read could not return. It never
 * closes or edits rows itself: each queued item is read again on its own, so a partial or empty
 * listing response cannot remove vehicles.
 */
export async function reconcileCatalog() {
  const lease = randomUUID();
  if (!(await acquireReconciliation(lease))) return { skipped: true as const };
  try {
    const seller = sellerId();
    const catalog = await readMercadoLibrePublications(await catalogAccessToken());
    if (String(catalog.seller.id) !== seller) throw failure('catalog_sync', 'unexpected_seller');
    const { items, total, unread } = catalog.publications;
    // A scan that stopped early (see readAllItemIds), or an item the bulk read did not return, must
    // not count as proof that an item is not listed.
    const listingComplete = !unread.length && items.length >= total;
    const listed = new Map<string, { status: string; lastUpdated: number | null }>();
    for (const { source, vehicle } of items) {
      if (String(source.seller_id) !== seller) continue;
      // An unresolved category is compared anyway: the item's own job decides, and retries.
      if (await vehicleCategory(source).catch(() => undefined) === null) continue;
      listed.set(source.id, { status: vehicle.status, lastUpdated: lastUpdatedTime(source.last_updated) });
    }
    const stored = await readStoredSyncState();
    const due = new Set<string>();
    // Its own job reads it again, and decides whether it is gone, of another seller or not a vehicle.
    for (const { id, incident } of unread) {
      due.add(id);
      console.error(JSON.stringify({ event: 'catalog_reconciliation_unread', publicationId: id, ...incident }));
    }
    for (const [id, { status, lastUpdated }] of listed) {
      const row = stored.get(id);
      // A row saved before categories were recorded is read again once to record its category.
      if (!row || row.status !== status || row.sourceUpdatedAt !== lastUpdated || !row.vehicleCategory) due.add(id);
    }
    const staleBefore = Date.now() - REFRESH_AFTER_MS;
    for (const [id, row] of stored) {
      const closed = row.status === 'closed' || row.status === 'sold';
      if (!closed && !listed.has(id)) due.add(id);
      if (!closed && row.syncedAt < staleBefore) due.add(id);
    }
    await enqueueCatalogJobs([...due]);
    const pruned = await pruneCatalogJobs(lease, { listingComplete });
    await finishReconciliation(lease, { listed: listed.size });
    return { skipped: false as const, listed: listed.size, unread: unread.length, enqueued: due.size, pruned };
  } catch (error) {
    const incident = safeFailure(error, 'catalog_sync').incident;
    await finishReconciliation(lease, { failure: incidentCode(incident) }).catch(() => {});
    throw new IntegrationFailure(incident);
  }
}
