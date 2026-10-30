import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  acquireReconciliation, completeCatalogJob, enqueueCatalogJobs, failCatalogJob, finishReconciliation,
  leaseCatalogJob, markPublicationRemoved, readStoredSyncState, savePublication,
} from '@/lib/catalog/store';
import { catalogAccessToken } from './access-token';
import { failure, IntegrationFailure, safeFailure, type IntegrationIncident } from './failures';
import { readMercadoLibrePublication, readMercadoLibrePublications } from './oauth';

/** Rows not refreshed for a day are read again, which also picks up description-only edits. */
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

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
 */
export async function enqueueCatalogSync(id: string) {
  await enqueueCatalogJobs([id]);
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
export async function processNextCatalogJob() {
  const lease = randomUUID();
  const job = await leaseCatalogJob(lease);
  if (!job) return false;
  try {
    const seller = sellerId();
    const publication = await readCurrentPublication(job.id);
    if (!publication) {
      await markPublicationRemoved(job.id, lease);
    } else if (String(publication.source.seller_id) === seller && publication.source.id === job.id) {
      await savePublication(publication, lease);
    }
    // Items of other sellers are never stored. The job is done either way.
    await completeCatalogJob(job.id, lease, job.revision);
  } catch (error) {
    const incident = safeFailure(error, 'catalog_sync').incident;
    await failCatalogJob(job.id, lease, job.revision, job.attempts, incidentCode(incident));
    console.error(JSON.stringify({ event: 'catalog_sync_retry', publicationId: job.id, ...incident }));
  }
  return true;
}

/** Drains due items within a time budget. Items in backoff wait for the next run. */
export async function runCatalogSyncWork({ budgetMs = 200_000, maxItems = 200 } = {}) {
  const deadline = Date.now() + budgetMs;
  let processed = 0;
  while (Date.now() < deadline && processed < maxItems && await processNextCatalogJob()) processed++;
  return processed;
}

export async function runCatalogSyncWorkSafely() {
  try { await runCatalogSyncWork(); }
  catch { console.error(JSON.stringify({ event: 'catalog_sync_worker_failure' })); }
}

/**
 * Repairs missed notifications. Compares the seller's active listing with the local copy and
 * queues every item that is new, changed, no longer listed as active, or not refreshed for a day.
 * It never closes or edits rows itself: each queued item is read again on its own, so a partial
 * or empty listing response cannot remove vehicles from the site.
 */
export async function reconcileCatalog() {
  const lease = randomUUID();
  if (!(await acquireReconciliation(lease))) return { skipped: true as const };
  try {
    const seller = sellerId();
    const catalog = await readMercadoLibrePublications(await catalogAccessToken());
    if (String(catalog.seller.id) !== seller) throw failure('catalog_sync', 'unexpected_seller');
    const listed = new Map(catalog.publications.items
      .filter(({ source }) => String(source.seller_id) === seller)
      .map(({ source }) => [source.id, lastUpdatedTime(source.last_updated)]));
    const stored = await readStoredSyncState();
    const due = new Set<string>();
    for (const [id, lastUpdated] of listed) {
      const row = stored.get(id);
      if (!row || row.status !== 'active' || row.sourceUpdatedAt !== lastUpdated) due.add(id);
    }
    const staleBefore = Date.now() - REFRESH_AFTER_MS;
    for (const [id, row] of stored) {
      if (row.status === 'active' && !listed.has(id)) due.add(id);
      if (row.status !== 'closed' && row.status !== 'sold' && row.syncedAt < staleBefore) due.add(id);
    }
    await enqueueCatalogJobs([...due]);
    await finishReconciliation(lease, { listed: listed.size });
    return { skipped: false as const, listed: listed.size, enqueued: due.size };
  } catch (error) {
    const incident = safeFailure(error, 'catalog_sync').incident;
    await finishReconciliation(lease, { failure: incidentCode(incident) }).catch(() => {});
    throw new IntegrationFailure(incident);
  }
}
