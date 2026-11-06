import 'server-only';
import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import type { MercadoLibreItem, MercadoLibrePublication } from '@/lib/integrations/mercado-libre/types';
import type { VehicleCategory } from '@/lib/integrations/mercado-libre/vehicle-categories';
import { getSql } from '@/lib/database';
import { parseJobLease, parseRow, parseRows } from '@/lib/database-rows';
import {
  NO_RECONCILIATION,
  parseCatalogPublication,
  parseCatalogVehicle,
  parseDueCheck,
  parseJobHealth,
  parsePublicationHealth,
  parseQueuedNotification,
  parseReconciliationHealth,
  parseRemovalResult,
  parseSaveResult,
  parseStoredSyncState,
} from './rows';

/**
 * Local copy of the seller's Mercado Libre publications. Pages read only from here and only the
 * sync worker writes, from seller-checked item reads. Mercado Libre stays the source of truth.
 */

/** Public presentation data only. The full seller payload is never stored or returned. */
export type CatalogPublication = {
  vehicle: Vehicle;
  description: MercadoLibrePublication['description'];
  source: Pick<MercadoLibreItem, 'id' | 'title' | 'pictures' | 'attributes' | 'permalink'>;
};

const PUBLICATION_ID = /^MLA\d+$/;
const MAX_JOB_ATTEMPTS = 8;
/** A due job no worker has picked up for this long gets a new drain from the next notification. */
const OVERDUE_JOB = '2 minutes';
/** Given-up jobs of items never stored stay this long for diagnostics, then are deleted. */
const GIVEN_UP_RETENTION_DAYS = 14;
const NEW_LISTING_DAYS = 7;

function toTimestamp(value: unknown) {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export async function listActiveCatalogVehicles() {
  const rows =
    await getSql()`SELECT publication_id, slug, status, vehicle, content_changed_at FROM public.catalog_publications
    WHERE status = 'active' ORDER BY listed_at DESC NULLS LAST, publication_id DESC`;
  return parseRows('catalog_publications', rows, parseCatalogVehicle);
}

/** Any synced publication, including paused or closed ones, so their pages keep a stable URL. */
export async function findCatalogPublication(id: string): Promise<CatalogPublication | null> {
  if (!PUBLICATION_ID.test(id)) return null;
  const rows = await getSql()`SELECT publication_id, slug, status, vehicle, source, description, content_changed_at
    FROM public.catalog_publications WHERE publication_id = ${id}`;
  if (!rows.length) return null;
  return parseRow('catalog_publications', rows[0], parseCatalogPublication);
}

/**
 * Saves an authoritative read while the caller still holds the item's job lease, so a worker whose
 * lease expired cannot overwrite a newer read. The slug is kept from the first sync. Returns
 * whether the row was written, whether it changed anything pages read (content, status or listing
 * order), whether a new price was recorded and whether the car became available.
 *
 * Becoming available (a new active listing, or a paused, closed or sold one turning active) is
 * recorded for search alerts in the same statement, so it can never be lost between the save and
 * the alert work. A listing first seen more than NEW_LISTING_DAYS after it was published (a
 * backfill or a fresh database) is old stock, not news, and records nothing.
 */
export async function savePublication(
  publication: MercadoLibrePublication,
  vehicleCategory: VehicleCategory,
  lease: string,
) {
  const { source, description } = publication;
  // Slug, status and updatedAt live in their own columns. updatedAt is ours, not the provider's.
  const { slug, status, ...vehicle } = publication.vehicle;
  const storedVehicle = JSON.stringify({ ...vehicle, updatedAt: undefined });
  const publicSource = {
    id: source.id,
    title: source.title,
    pictures: source.pictures ?? [],
    attributes: source.attributes ?? [],
    permalink: source.permalink ?? null,
  };
  const rows = await getSql()`WITH lease AS (
      SELECT 1 FROM public.catalog_sync_jobs WHERE publication_id = ${source.id}::text AND lease_id = ${lease}::uuid
    ), previous AS (
      SELECT price, currency, status, listed_at FROM public.catalog_publications WHERE publication_id = ${source.id}::text
    ), saved AS (
      INSERT INTO public.catalog_publications (publication_id, slug, status, price, currency, vehicle, source, description,
        listed_at, source_updated_at, published_at, closed_at, vehicle_category)
      SELECT ${source.id}::text, ${slug}::text, ${status}::text, ${vehicle.price}::numeric, ${vehicle.currency}::text,
        ${storedVehicle}::jsonb, ${JSON.stringify(publicSource)}::jsonb, ${description ? JSON.stringify(description) : null}::jsonb,
        ${toTimestamp(source.start_time ?? source.date_created)}::timestamptz, ${toTimestamp(source.last_updated)}::timestamptz,
        CASE WHEN ${status}::text = 'active' THEN now() END,
        CASE WHEN ${status}::text IN ('closed', 'sold') THEN now() END, ${vehicleCategory}::text
      FROM lease
      ON CONFLICT (publication_id) DO UPDATE SET
        status = EXCLUDED.status, price = EXCLUDED.price, currency = EXCLUDED.currency,
        vehicle = EXCLUDED.vehicle, source = EXCLUDED.source, description = EXCLUDED.description,
        listed_at = EXCLUDED.listed_at, source_updated_at = EXCLUDED.source_updated_at,
        content_changed_at = CASE
          WHEN (catalog_publications.status, catalog_publications.vehicle, catalog_publications.source, catalog_publications.description)
            IS DISTINCT FROM (EXCLUDED.status, EXCLUDED.vehicle, EXCLUDED.source, EXCLUDED.description)
          THEN now() ELSE catalog_publications.content_changed_at END,
        published_at = COALESCE(catalog_publications.published_at, EXCLUDED.published_at),
        closed_at = CASE WHEN EXCLUDED.status IN ('closed', 'sold') THEN COALESCE(catalog_publications.closed_at, now()) END,
        vehicle_category = EXCLUDED.vehicle_category, synced_at = now()
      RETURNING publication_id, price, currency, status, listed_at, content_changed_at
    ), history AS (
      INSERT INTO public.catalog_price_history (publication_id, price, currency)
      SELECT publication_id, price, currency FROM saved
      WHERE NOT EXISTS (SELECT 1 FROM previous WHERE previous.price = saved.price AND previous.currency = saved.currency)
      RETURNING 1
    ), available AS (
      INSERT INTO public.inventory_alert_events (publication_id, previous_status)
      SELECT saved.publication_id, (SELECT status FROM previous) FROM saved
      WHERE saved.status = 'active' AND NOT EXISTS (SELECT 1 FROM previous WHERE previous.status = 'active')
        AND (EXISTS (SELECT 1 FROM previous) OR saved.listed_at IS NULL
          OR saved.listed_at > now() - ${NEW_LISTING_DAYS}::int * interval '1 day')
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM saved)::int AS saved, (SELECT count(*) FROM history)::int AS price_changes,
      (SELECT count(*) FROM available)::int AS available,
      -- content_changed_at is now() only when this statement inserted the row or changed its content.
      (SELECT count(*) FROM saved WHERE saved.content_changed_at = now()
        OR saved.listed_at IS DISTINCT FROM (SELECT listed_at FROM previous))::int AS changed`;
  return parseRow('catalog_publications', rows[0], parseSaveResult);
}

/**
 * The item no longer exists on Mercado Libre. Its page stays, marked as no longer available.
 * Returns null when there is no stored row (or the lease was lost), and whether the row was still
 * open, so pages showed it as available or reserved.
 */
export async function markPublicationRemoved(id: string, lease: string) {
  const rows = await getSql()`UPDATE public.catalog_publications SET status = 'closed',
      closed_at = COALESCE(closed_at, now()),
      content_changed_at = CASE WHEN status = 'closed' THEN content_changed_at ELSE now() END,
      synced_at = now()
    WHERE publication_id = ${id} AND EXISTS (SELECT 1 FROM public.catalog_sync_jobs
      WHERE publication_id = ${id} AND lease_id = ${lease}::uuid)
    RETURNING content_changed_at = now() AS changed`;
  return rows.length === 1 ? parseRow('catalog_publications', rows[0], parseRemovalResult) : null;
}

/**
 * Reconciliation (and tests): always makes each item due, even a skipped or deferred one, since the
 * seller's own listing vouches for it.
 */
export async function enqueueCatalogJobs(ids: string[]) {
  const valid = [...new Set(ids)].filter(id => PUBLICATION_ID.test(id));
  if (!valid.length) return;
  await getSql()`INSERT INTO public.catalog_sync_jobs (publication_id)
    SELECT unnest(${valid}::text[])
    ON CONFLICT (publication_id) DO UPDATE SET revision = catalog_sync_jobs.revision + 1,
      next_attempt_at = now(), deferred = false, skip_until = NULL, updated_at = now()`;
}

/**
 * Queues a notification and returns whether it needs a drain. Duplicates cost one statement:
 * - a finished job is made due again, unless a recent read found an item never stored missing or of
 *   another seller (skip_until);
 * - a job being read gets a new revision, so the item is read again afterwards;
 * - a job already due is left alone (and keeps its backoff); it only asks for a drain when it
 *   leaves the deferred state or no worker has picked it up for OVERDUE_JOB.
 * `deferred` marks a source outside MERCADO_LIBRE_WEBHOOK_IPS: queued, never drained here.
 */
export async function enqueueCatalogNotification(id: string, { deferred }: { deferred: boolean }) {
  if (!PUBLICATION_ID.test(id)) return false;
  const rows = await getSql()`INSERT INTO public.catalog_sync_jobs AS job (publication_id, deferred)
    VALUES (${id}, ${deferred}::boolean)
    ON CONFLICT (publication_id) DO UPDATE SET
      revision = CASE WHEN job.revision > job.processed_revision AND NOT COALESCE(job.lease_until >= now(), false)
        THEN job.revision ELSE job.revision + 1 END,
      next_attempt_at = CASE WHEN job.revision > job.processed_revision AND NOT COALESCE(job.lease_until >= now(), false)
        THEN job.next_attempt_at ELSE now() END,
      deferred = CASE WHEN job.revision > job.processed_revision THEN job.deferred AND EXCLUDED.deferred ELSE EXCLUDED.deferred END,
      skip_until = NULL, updated_at = now()
    WHERE CASE WHEN job.revision <= job.processed_revision
      THEN job.skip_until IS NULL OR job.skip_until <= now()
        OR EXISTS (SELECT 1 FROM public.catalog_publications WHERE publication_id = job.publication_id)
      ELSE COALESCE(job.lease_until >= now(), false)
        OR (NOT EXCLUDED.deferred AND (job.deferred OR job.next_attempt_at < now() - ${OVERDUE_JOB}::interval))
      END
    RETURNING deferred`;
  return !deferred && rows.length === 1 && !parseRow('catalog_sync_jobs', rows[0], parseQueuedNotification).deferred;
}

/** Deferred jobs come last, and only when `includeDeferred` (the daily cron). */
export async function leaseCatalogJob(lease: string, { includeDeferred = true } = {}) {
  const rows = await getSql()`UPDATE public.catalog_sync_jobs SET lease_id = ${lease}::uuid,
      lease_until = now() + interval '90 seconds', attempts = attempts + 1
    WHERE publication_id = (SELECT publication_id FROM public.catalog_sync_jobs
      WHERE revision > processed_revision AND next_attempt_at <= now() AND (lease_until IS NULL OR lease_until < now())
        AND (${includeDeferred}::boolean OR NOT deferred)
      ORDER BY deferred, next_attempt_at LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING publication_id, revision, attempts`;
  if (!rows.length) return null;
  const { publication_id: id, revision, attempts } = parseRow('catalog_sync_jobs', rows[0], parseJobLease);
  return { id, revision, attempts };
}

/** `skipSeconds` ignores notifications for the item that long (see enqueueCatalogNotification). */
export async function completeCatalogJob(id: string, lease: string, revision: number, skipSeconds = 0) {
  await getSql()`UPDATE public.catalog_sync_jobs SET processed_revision = GREATEST(processed_revision, ${revision}),
      lease_id = NULL, lease_until = NULL, attempts = 0, last_error = NULL, updated_at = now(),
      skip_until = CASE WHEN ${skipSeconds}::int > 0 THEN now() + ${skipSeconds}::int * interval '1 second' END
    WHERE publication_id = ${id} AND lease_id = ${lease}::uuid`;
}

/**
 * Exponential backoff up to an hour. After MAX_JOB_ATTEMPTS the revision is given up, keeping the
 * error for diagnostics: the next notification or reconciliation enqueues the item again.
 */
export async function failCatalogJob(id: string, lease: string, revision: number, attempts: number, error: string) {
  const delaySeconds = Math.min(3600, 30 * 2 ** Math.min(attempts, 7));
  await getSql()`UPDATE public.catalog_sync_jobs SET lease_id = NULL, lease_until = NULL, last_error = ${error},
      processed_revision = CASE WHEN ${attempts}::int >= ${MAX_JOB_ATTEMPTS}::int
        THEN GREATEST(processed_revision, ${revision}) ELSE processed_revision END,
      attempts = CASE WHEN ${attempts}::int >= ${MAX_JOB_ATTEMPTS}::int THEN 0 ELSE attempts END,
      next_attempt_at = now() + ${delaySeconds}::int * interval '1 second', updated_at = now()
    WHERE publication_id = ${id} AND lease_id = ${lease}::uuid`;
}

export async function readStoredSyncState() {
  const rows = await getSql()`SELECT publication_id, status, source_updated_at, synced_at, vehicle_category
    FROM public.catalog_publications`;
  // A skipped row looks missing from the copy, so a listed item is queued and its row rewritten.
  return new Map(parseRows('catalog_publications', rows, parseStoredSyncState));
}

/** Only one reconciliation runs at a time. An interrupted run's lease expires after five minutes. */
export async function acquireReconciliation(lease: string) {
  const sql = getSql();
  await sql`INSERT INTO public.catalog_sync_runs (id) VALUES ('reconciliation') ON CONFLICT (id) DO NOTHING`;
  const rows = await sql`UPDATE public.catalog_sync_runs SET lease_id = ${lease}::uuid,
      lease_until = now() + interval '5 minutes', last_started_at = now()
    WHERE id = 'reconciliation' AND (lease_until IS NULL OR lease_until < now()) RETURNING id`;
  return rows.length === 1;
}

/**
 * Deletes jobs nothing needs any more, during a reconciliation that holds `lease`, and returns how
 * many. Only jobs of items never stored, not leased, and untouched since this reconciliation started:
 * - finished, once any skip has expired;
 * - given up, after GIVEN_UP_RETENTION_DAYS;
 * - still deferred, when the listing was complete: a genuine one is a vehicle of the seller, which
 *   this reconciliation found missing from the copy and queued again, clearing the deferral.
 * Jobs of stored items are never deleted: their revisions and leases guard every write.
 */
export async function pruneCatalogJobs(lease: string, { listingComplete }: { listingComplete: boolean }) {
  const rows = await getSql()`DELETE FROM public.catalog_sync_jobs job USING public.catalog_sync_runs run
    WHERE run.id = 'reconciliation' AND run.lease_id = ${lease}::uuid AND job.updated_at < run.last_started_at
      AND (job.lease_until IS NULL OR job.lease_until < now())
      AND NOT EXISTS (SELECT 1 FROM public.catalog_publications WHERE publication_id = job.publication_id)
      AND CASE WHEN job.revision <= job.processed_revision
        THEN (job.skip_until IS NULL OR job.skip_until <= now())
          AND (job.last_error IS NULL OR job.updated_at < now() - ${GIVEN_UP_RETENTION_DAYS}::int * interval '1 day')
        ELSE job.deferred AND ${listingComplete}::boolean
        END
    RETURNING 1`;
  return rows.length;
}

/**
 * One webhook drain at a time: concurrent notifications would otherwise each read the queue in
 * parallel. The lease is short and renewed per item, so an interrupted drain blocks others briefly.
 */
export async function acquireNotificationDrain(lease: string) {
  const rows = await getSql()`INSERT INTO public.catalog_sync_runs AS run (id, lease_id, lease_until, last_started_at)
    VALUES ('notification_drain', ${lease}::uuid, now() + interval '90 seconds', now())
    ON CONFLICT (id) DO UPDATE SET lease_id = EXCLUDED.lease_id, lease_until = EXCLUDED.lease_until,
      last_started_at = EXCLUDED.last_started_at
    WHERE run.lease_until IS NULL OR run.lease_until < now()
    RETURNING id`;
  return rows.length === 1;
}

export async function renewNotificationDrain(lease: string) {
  const rows = await getSql()`UPDATE public.catalog_sync_runs SET lease_until = now() + interval '90 seconds'
    WHERE id = 'notification_drain' AND lease_id = ${lease}::uuid RETURNING id`;
  return rows.length === 1;
}

export async function releaseNotificationDrain(lease: string) {
  await getSql()`UPDATE public.catalog_sync_runs SET lease_id = NULL, lease_until = NULL, last_completed_at = now()
    WHERE id = 'notification_drain' AND lease_id = ${lease}::uuid`;
}

/** Whether a webhook drain would find a job now. */
export async function hasDueNotificationJobs() {
  const rows = await getSql()`SELECT EXISTS (SELECT 1 FROM public.catalog_sync_jobs
    WHERE revision > processed_revision AND next_attempt_at <= now() AND NOT deferred
      AND (lease_until IS NULL OR lease_until < now())) AS due`;
  return parseRow('catalog_sync_jobs', rows[0], parseDueCheck).due;
}

export async function finishReconciliation(lease: string, result: { listed: number } | { failure: string }) {
  const sql = getSql();
  if ('listed' in result) {
    await sql`UPDATE public.catalog_sync_runs SET lease_id = NULL, lease_until = NULL, last_completed_at = now(),
      last_listed = ${result.listed}::int WHERE id = 'reconciliation' AND lease_id = ${lease}::uuid`;
  } else {
    await sql`UPDATE public.catalog_sync_runs SET lease_id = NULL, lease_until = NULL, last_failed_at = now(),
      last_failure = ${result.failure} WHERE id = 'reconciliation' AND lease_id = ${lease}::uuid`;
  }
}

/** Private health view for the diagnostics endpoint. No publication content. */
export async function readSyncHealth() {
  const sql = getSql();
  const [runs, jobs, publications] = await Promise.all([
    sql`SELECT last_started_at, last_completed_at, last_failed_at, last_failure, last_listed
      FROM public.catalog_sync_runs WHERE id = 'reconciliation'`,
    sql`SELECT count(*) FILTER (WHERE revision > processed_revision)::int AS pending,
        count(*) FILTER (WHERE revision > processed_revision AND attempts > 0)::int AS retrying,
        count(*) FILTER (WHERE revision > processed_revision AND deferred)::int AS deferred,
        min(updated_at) FILTER (WHERE revision > processed_revision) AS oldest_pending_at,
        count(*) FILTER (WHERE revision <= processed_revision AND last_error IS NOT NULL)::int AS abandoned,
        count(*) FILTER (WHERE revision <= processed_revision AND last_error IS NOT NULL
          AND updated_at > now() - interval '1 day')::int AS abandoned_last_day
      FROM public.catalog_sync_jobs`,
    sql`SELECT status, count(*)::int AS count, max(synced_at) AS last_synced_at, min(synced_at) AS oldest_synced_at
      FROM public.catalog_publications GROUP BY status`,
  ]);
  const groups = publications.map(row => parseRow('catalog_publications', row, parsePublicationHealth));
  return {
    reconciliation: runs.length ? parseRow('catalog_sync_runs', runs[0], parseReconciliationHealth) : NO_RECONCILIATION,
    jobs: parseRow('catalog_sync_jobs', jobs[0], parseJobHealth),
    publications: Object.fromEntries(groups.map(({ status, count }) => [status, count])),
    lastSyncedAt: groups.reduce<string | null>(
      (latest, group) => (!latest || group.lastSyncedAt > latest ? group.lastSyncedAt : latest),
      null,
    ),
    // Active and paused rows are read again daily (closed and sold ones are not), so this shows how
    // out of date the oldest page that still offers a car can be.
    oldestOpenSyncedAt: groups
      .filter(({ status }) => status === 'active' || status === 'paused')
      .reduce<string | null>(
        (oldest, group) => (!oldest || group.oldestSyncedAt < oldest ? group.oldestSyncedAt : oldest),
        null,
      ),
  };
}
