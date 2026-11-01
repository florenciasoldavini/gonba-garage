import 'server-only';
import type { Vehicle, VehicleStatus } from '@/features/vehicles/domain/vehicle';
import type { MercadoLibreItem, MercadoLibrePublication } from '@/lib/integrations/mercado-libre/types';
import { getAlertsSql } from '@/lib/alerts/database';

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

type Row = Record<string, unknown>;

const PUBLICATION_ID = /^MLA\d+$/;
const MAX_JOB_ATTEMPTS = 8;
const NEW_LISTING_DAYS = 7;

function toVehicle(row: Row): Vehicle {
  return {
    ...(row.vehicle as Omit<Vehicle, 'slug' | 'status' | 'updatedAt'>),
    slug: String(row.slug),
    status: row.status as VehicleStatus,
    // A real content or availability change, never a provider-side touch or the sync time.
    updatedAt: new Date(row.content_changed_at as string).toISOString(),
  };
}

function toTimestamp(value: unknown) {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export async function listActiveCatalogVehicles() {
  const rows = await getAlertsSql()`SELECT slug, status, vehicle, content_changed_at FROM public.catalog_publications
    WHERE status = 'active' ORDER BY listed_at DESC NULLS LAST, publication_id DESC`;
  return rows.map(toVehicle);
}

/** Any synced publication, including paused or closed ones, so their pages keep a stable URL. */
export async function findCatalogPublication(id: string): Promise<CatalogPublication | null> {
  if (!PUBLICATION_ID.test(id)) return null;
  const rows = await getAlertsSql()`SELECT slug, status, vehicle, source, description, content_changed_at
    FROM public.catalog_publications WHERE publication_id = ${id}`;
  if (!rows.length) return null;
  return {
    vehicle: toVehicle(rows[0]),
    description: (rows[0].description ?? null) as CatalogPublication['description'],
    source: rows[0].source as CatalogPublication['source'],
  };
}

/**
 * Saves an authoritative read while the caller still holds the item's job lease, so a worker whose
 * lease expired cannot overwrite a newer read. The slug is kept from the first sync. Returns
 * whether the row was written, whether a new price was recorded and whether the car became
 * available.
 *
 * Becoming available (a new active listing, or a paused, closed or sold one turning active) is
 * recorded for search alerts in the same statement, so it can never be lost between the save and
 * the alert work. A listing first seen more than NEW_LISTING_DAYS after it was published (a
 * backfill or a fresh database) is old stock, not news, and records nothing.
 */
export async function savePublication(publication: MercadoLibrePublication, lease: string) {
  const { source, description } = publication;
  // Slug, status and updatedAt live in their own columns. updatedAt is ours, not the provider's.
  const { slug, status, ...vehicle } = publication.vehicle;
  const storedVehicle = JSON.stringify({ ...vehicle, updatedAt: undefined });
  const publicSource = { id: source.id, title: source.title, pictures: source.pictures ?? [],
    attributes: source.attributes ?? [], permalink: source.permalink ?? null };
  const rows = await getAlertsSql()`WITH lease AS (
      SELECT 1 FROM public.catalog_sync_jobs WHERE publication_id = ${source.id}::text AND lease_id = ${lease}::uuid
    ), previous AS (
      SELECT price, currency, status FROM public.catalog_publications WHERE publication_id = ${source.id}::text
    ), saved AS (
      INSERT INTO public.catalog_publications (publication_id, slug, status, price, currency, vehicle, source, description,
        listed_at, source_updated_at, published_at, closed_at)
      SELECT ${source.id}::text, ${slug}::text, ${status}::text, ${vehicle.price}::numeric, ${vehicle.currency}::text,
        ${storedVehicle}::jsonb, ${JSON.stringify(publicSource)}::jsonb, ${description ? JSON.stringify(description) : null}::jsonb,
        ${toTimestamp(source.start_time ?? source.date_created)}::timestamptz, ${toTimestamp(source.last_updated)}::timestamptz,
        CASE WHEN ${status}::text = 'active' THEN now() END,
        CASE WHEN ${status}::text IN ('closed', 'sold') THEN now() END
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
        synced_at = now()
      RETURNING publication_id, price, currency, status, listed_at
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
      (SELECT count(*) FROM available)::int AS available`;
  return { saved: rows[0].saved === 1, priceChanged: rows[0].price_changes === 1, becameAvailable: rows[0].available === 1 };
}

/** The item no longer exists on Mercado Libre. Its page stays, marked as no longer available. */
export async function markPublicationRemoved(id: string, lease: string) {
  await getAlertsSql()`UPDATE public.catalog_publications SET status = 'closed',
      closed_at = COALESCE(closed_at, now()),
      content_changed_at = CASE WHEN status = 'closed' THEN content_changed_at ELSE now() END,
      synced_at = now()
    WHERE publication_id = ${id} AND EXISTS (SELECT 1 FROM public.catalog_sync_jobs
      WHERE publication_id = ${id} AND lease_id = ${lease}::uuid)`;
}

/** Idempotent: a repeated notification bumps the revision so the item is read once more. */
export async function enqueueCatalogJobs(ids: string[]) {
  const valid = [...new Set(ids)].filter(id => PUBLICATION_ID.test(id));
  if (!valid.length) return;
  await getAlertsSql()`INSERT INTO public.catalog_sync_jobs (publication_id)
    SELECT unnest(${valid}::text[])
    ON CONFLICT (publication_id) DO UPDATE SET revision = catalog_sync_jobs.revision + 1,
      next_attempt_at = now(), updated_at = now()`;
}

export async function leaseCatalogJob(lease: string) {
  const rows = await getAlertsSql()`UPDATE public.catalog_sync_jobs SET lease_id = ${lease}::uuid,
      lease_until = now() + interval '90 seconds', attempts = attempts + 1
    WHERE publication_id = (SELECT publication_id FROM public.catalog_sync_jobs
      WHERE revision > processed_revision AND next_attempt_at <= now() AND (lease_until IS NULL OR lease_until < now())
      ORDER BY next_attempt_at LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING publication_id, revision, attempts`;
  if (!rows.length) return null;
  return { id: String(rows[0].publication_id), revision: Number(rows[0].revision), attempts: Number(rows[0].attempts) };
}

export async function completeCatalogJob(id: string, lease: string, revision: number) {
  await getAlertsSql()`UPDATE public.catalog_sync_jobs SET processed_revision = GREATEST(processed_revision, ${revision}),
      lease_id = NULL, lease_until = NULL, attempts = 0, last_error = NULL, updated_at = now()
    WHERE publication_id = ${id} AND lease_id = ${lease}::uuid`;
}

/**
 * Exponential backoff up to an hour. After MAX_JOB_ATTEMPTS the revision is given up, keeping the
 * error for diagnostics: the next notification or reconciliation enqueues the item again.
 */
export async function failCatalogJob(id: string, lease: string, revision: number, attempts: number, error: string) {
  const delaySeconds = Math.min(3600, 30 * 2 ** Math.min(attempts, 7));
  await getAlertsSql()`UPDATE public.catalog_sync_jobs SET lease_id = NULL, lease_until = NULL, last_error = ${error},
      processed_revision = CASE WHEN ${attempts}::int >= ${MAX_JOB_ATTEMPTS}::int
        THEN GREATEST(processed_revision, ${revision}) ELSE processed_revision END,
      attempts = CASE WHEN ${attempts}::int >= ${MAX_JOB_ATTEMPTS}::int THEN 0 ELSE attempts END,
      next_attempt_at = now() + ${delaySeconds}::int * interval '1 second', updated_at = now()
    WHERE publication_id = ${id} AND lease_id = ${lease}::uuid`;
}

export async function readStoredSyncState() {
  const rows = await getAlertsSql()`SELECT publication_id, status, source_updated_at, synced_at FROM public.catalog_publications`;
  return new Map(rows.map(row => [String(row.publication_id), {
    status: row.status as VehicleStatus,
    sourceUpdatedAt: row.source_updated_at ? new Date(row.source_updated_at as string).getTime() : null,
    syncedAt: new Date(row.synced_at as string).getTime(),
  }]));
}

/** Only one reconciliation runs at a time. An interrupted run's lease expires after five minutes. */
export async function acquireReconciliation(lease: string) {
  const sql = getAlertsSql();
  await sql`INSERT INTO public.catalog_sync_runs (id) VALUES ('reconciliation') ON CONFLICT (id) DO NOTHING`;
  const rows = await sql`UPDATE public.catalog_sync_runs SET lease_id = ${lease}::uuid,
      lease_until = now() + interval '5 minutes', last_started_at = now()
    WHERE id = 'reconciliation' AND (lease_until IS NULL OR lease_until < now()) RETURNING id`;
  return rows.length === 1;
}

export async function finishReconciliation(lease: string, result: { listed: number } | { failure: string }) {
  const sql = getAlertsSql();
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
  const sql = getAlertsSql();
  const [runs, jobs, publications] = await Promise.all([
    sql`SELECT last_started_at, last_completed_at, last_failed_at, last_failure, last_listed
      FROM public.catalog_sync_runs WHERE id = 'reconciliation'`,
    sql`SELECT count(*) FILTER (WHERE revision > processed_revision)::int AS pending,
        count(*) FILTER (WHERE revision > processed_revision AND attempts > 0)::int AS retrying,
        min(updated_at) FILTER (WHERE revision > processed_revision) AS oldest_pending_at,
        count(*) FILTER (WHERE revision <= processed_revision AND last_error IS NOT NULL)::int AS abandoned
      FROM public.catalog_sync_jobs`,
    sql`SELECT status, count(*)::int AS count, max(synced_at) AS last_synced_at
      FROM public.catalog_publications GROUP BY status`,
  ]);
  const iso = (value: unknown) => value ? new Date(value as string).toISOString() : null;
  const run = runs[0];
  return {
    reconciliation: {
      lastStartedAt: iso(run?.last_started_at), lastCompletedAt: iso(run?.last_completed_at),
      lastFailedAt: iso(run?.last_failed_at), lastFailure: run?.last_failure ?? null,
      lastListed: run?.last_listed ?? null,
    },
    jobs: { pending: jobs[0].pending, retrying: jobs[0].retrying, abandoned: jobs[0].abandoned,
      oldestPendingAt: iso(jobs[0].oldest_pending_at) },
    publications: Object.fromEntries(publications.map(row => [String(row.status), row.count])),
    lastSyncedAt: iso(publications.reduce<unknown>((latest, row) =>
      !latest || new Date(row.last_synced_at as string) > new Date(latest as string) ? row.last_synced_at : latest, null)),
  };
}
