import 'server-only';
import { randomUUID } from 'node:crypto';
import { comparableUsdPrice } from '@/features/vehicles/domain/catalog-pricing';
import { hasPriceBounds, matchesInventorySearch } from '@/features/vehicles/domain/inventory-search';
import { parseStoredVehicle, type StoredVehicle } from '@/lib/catalog/rows';
import { parseRow, parseRows } from '@/lib/database-rows';
import { getMepQuote } from '@/lib/integrations/mep-quote';
import { getSql } from '@/lib/database';
import { alertEmailsConfigured } from './config';
import { buildSearchMatchEmail, EmailFailure, sendAlertEmail, type SearchMatchVehicle } from './email';
import {
  parseAlertEmail, parseFrozenInventoryDelivery, parseInventoryAlert, parseInventoryDelivery, parseInventoryEvent,
  parseMatchedPublication,
} from './rows';

/**
 * Search-alert delivery, in three durable steps (docs/price-alert-delivery.md, "Search alerts"):
 * 1. The catalog sync records an event when a car becomes available (lib/catalog/store.ts).
 * 2. Each event is matched against the active alerts. A match row per car and alert generation is
 *    what keeps a car from being announced twice to the same alert.
 * 3. Unsent matches of one alert are batched into one email in an outbox, sent with frozen bytes and
 *    a stable idempotency key, like price alerts.
 */

/** At most one email per alert in this window. Matches found meanwhile wait and go out together. */
export const COOLDOWN_HOURS = 12;
/** Cars described in one email. Any others are counted ("y 2 más") and link to the catalog. */
export const MAX_VEHICLES_PER_EMAIL = 6;
/** Events not matched by then (emails not configured, or a long outage) are no longer news. */
const EVENT_LIFETIME_HOURS = 72;
/** A batch that could not be sent in a week is stale. Only applies when nothing can have been sent. */
const DELIVERY_LIFETIME_DAYS = 7;
/** Resend remembers idempotency keys for 24 hours. */
const IDEMPOTENCY_WINDOW_HOURS = 23;
const MAX_EVENTS_PER_RUN = 100;
const MAX_DELIVERIES_PER_RUN = 100;

const backoffSeconds = (attempts: number) => Math.min(3600, 30 * 2 ** Math.min(attempts, 7));

/** Returns the IDs and generations of the active alerts that match a car that just became available. */
export async function matchingAlerts(vehicle: StoredVehicle, eventId: string) {
  const sql = getSql();
  // Only alerts already active when the car became available: for a later one it is not news.
  const alerts = await sql`SELECT id, generation, search_query, make, transmission, body_type, fuel,
      min_price, max_price, min_mileage, max_mileage
    FROM public.vehicle_inventory_alerts
    WHERE status = 'active'
      AND COALESCE(confirmed_at, created_at) <= (SELECT created_at FROM public.inventory_alert_events WHERE id = ${eventId}::uuid)`;
  const candidates = parseRows('vehicle_inventory_alerts', alerts, parseInventoryAlert);
  const needsPrice = candidates.some(({ criteria }) => hasPriceBounds(criteria));
  // Price bounds are USD comparison amounts, so an ARS listing needs the MEP quote, as in the catalog.
  const usdPrice = comparableUsdPrice(vehicle, vehicle.currency === 'ARS' && needsPrice ? await getMepQuote() : null);
  if (needsPrice && usdPrice === null) throw new Error('mep_quote_unavailable');
  return candidates.filter(({ criteria }) => matchesInventorySearch(vehicle, criteria, usdPrice))
    .map(({ id, generation }) => ({ id, generation }));
}

/** Matches one due event. Returns false when nothing is due. */
export async function processNextEvent() {
  const sql = getSql();
  const lease = randomUUID();
  const events = await sql`UPDATE public.inventory_alert_events SET lease_id = ${lease}::uuid,
      lease_until = now() + interval '90 seconds', attempts = attempts + 1
    WHERE id = (SELECT id FROM public.inventory_alert_events
      WHERE state = 'pending' AND next_attempt_at <= now() AND (lease_until IS NULL OR lease_until < now())
      ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING id, publication_id, previous_status, attempts`;
  if (!events.length) return false;
  const event = parseRow('inventory_alert_events', events[0], parseInventoryEvent);
  try {
    const rows = await sql`SELECT publication_id, status, vehicle FROM public.catalog_publications WHERE publication_id = ${event.publication_id}`;
    // Reserved or sold again before matching: nothing to announce.
    const matched = rows[0]?.status === 'active'
      ? await matchingAlerts(parseRow('catalog_publications', rows[0], row => parseStoredVehicle(row.vehicle)), event.id) : null;
    // The insert and the completion happen only while this worker still holds the event's lease.
    await sql`WITH lease AS (
        SELECT 1 FROM public.inventory_alert_events WHERE id = ${event.id}::uuid AND lease_id = ${lease}::uuid
      ), inserted AS (
        INSERT INTO public.inventory_alert_matches (alert_id, generation, publication_id, previous_status)
        SELECT a.id, a.generation, ${event.publication_id}::text, ${event.previous_status}::text
        FROM unnest(${(matched ?? []).map(({ id }) => id)}::uuid[], ${(matched ?? []).map(({ generation }) => generation)}::uuid[]) AS m(id, generation)
        JOIN public.vehicle_inventory_alerts a ON a.id = m.id AND a.generation = m.generation AND a.status = 'active'
        WHERE EXISTS (SELECT 1 FROM lease)
        ON CONFLICT DO NOTHING
        RETURNING 1
      )
      UPDATE public.inventory_alert_events SET state = ${matched ? 'matched' : 'skipped'}::text, lease_id = NULL, lease_until = NULL,
        last_error = NULL, processed_at = now()
      WHERE id = ${event.id}::uuid AND lease_id = ${lease}::uuid`;
  } catch (error) {
    const code = error instanceof Error && error.message === 'mep_quote_unavailable' ? 'mep_quote_unavailable' : 'processing_failure';
    await sql`UPDATE public.inventory_alert_events SET lease_id = NULL, lease_until = NULL, last_error = ${code},
        next_attempt_at = now() + ${backoffSeconds(Number(event.attempts))}::int * interval '1 second'
      WHERE id = ${event.id}::uuid AND lease_id = ${lease}::uuid`;
    console.error('inventory_alert_match_retry', { eventId: event.id, code });
  }
  return true;
}

/**
 * Groups every unsent match of an alert into one new email, unless that alert already has one open
 * or was emailed within the cooldown. Concurrent runs cannot create two: the open-delivery index
 * turns the second insert into a no-op.
 */
export async function batchMatches() {
  const sql = getSql();
  await sql`WITH due AS (
      SELECT a.id, a.generation FROM public.vehicle_inventory_alerts a
      WHERE a.status = 'active'
        AND EXISTS (SELECT 1 FROM public.inventory_alert_matches m
          WHERE m.alert_id = a.id AND m.generation = a.generation AND m.delivery_id IS NULL)
        AND NOT EXISTS (SELECT 1 FROM public.inventory_alert_deliveries d
          WHERE d.alert_id = a.id AND d.generation = a.generation AND (d.state IN ('pending', 'sending')
            OR (d.state IN ('accepted', 'expired') AND COALESCE(d.accepted_at, d.created_at) > now() - ${COOLDOWN_HOURS}::int * interval '1 hour')))
      LIMIT ${MAX_DELIVERIES_PER_RUN}::int
    ), created AS (
      INSERT INTO public.inventory_alert_deliveries (alert_id, generation)
      SELECT id, generation FROM due
      ON CONFLICT DO NOTHING
      RETURNING id, alert_id, generation
    )
    UPDATE public.inventory_alert_matches m SET delivery_id = c.id FROM created c
    WHERE m.alert_id = c.alert_id AND m.generation = c.generation AND m.delivery_id IS NULL`;
}

/**
 * Housekeeping before claiming work. A series is every attempt sharing one idempotency key. Past
 * the provider's window a retry with that key could duplicate an accepted email, so:
 * - if any attempt may have been accepted (`uncertain`), the email is given up as 'expired' and
 *   never resent. Later matches still get new emails: one outage never silences an alert;
 * - if every attempt was definitely rejected, nothing was sent, so a new series starts with a new
 *   key and rebuilt content.
 */
async function maintainDeliveries() {
  const sql = getSql();
  await sql`UPDATE public.inventory_alert_deliveries SET state = 'expired', failure_code = 'ambiguous_send_window_expired'
    WHERE state IN ('pending', 'sending') AND uncertain
      AND series_started_at < now() - ${IDEMPOTENCY_WINDOW_HOURS}::int * interval '1 hour'
      AND (lease_until IS NULL OR lease_until < now())`;
  await sql`UPDATE public.inventory_alert_deliveries SET state = 'expired', failure_code = 'stale'
    WHERE state IN ('pending', 'sending') AND NOT uncertain
      AND created_at < now() - ${DELIVERY_LIFETIME_DAYS}::int * interval '1 day'
      AND (lease_until IS NULL OR lease_until < now())`;
  await sql`UPDATE public.inventory_alert_deliveries SET state = 'pending', key_series = key_series + 1,
      series_started_at = NULL, request_payload = NULL, vehicle_count = NULL
    WHERE state IN ('pending', 'sending') AND NOT uncertain
      AND series_started_at < now() - ${IDEMPOTENCY_WINDOW_HOURS}::int * interval '1 hour'
      AND (lease_until IS NULL OR lease_until < now())`;
  await sql`UPDATE public.inventory_alert_deliveries d SET state = 'cancelled'
    WHERE state = 'pending' AND NOT EXISTS (SELECT 1 FROM public.vehicle_inventory_alerts a
      WHERE a.id = d.alert_id AND a.generation = d.generation AND a.status = 'active')`;
}

function emailVehicle(row: ReturnType<typeof parseMatchedPublication>): SearchMatchVehicle {
  const { vehicle } = row;
  return {
    slug: String(row.slug), title: [vehicle.make, vehicle.model, vehicle.version, vehicle.year].filter(Boolean).join(' '),
    mileageKm: vehicle.mileageKm, transmission: vehicle.transmission, fuel: vehicle.fuel,
    price: vehicle.price, currency: vehicle.currency, released: row.previous_status === 'paused',
  };
}

/** Sends one due email. Returns false when nothing is due. */
export async function processNextDelivery() {
  const sql = getSql();
  const lease = randomUUID();
  await maintainDeliveries();
  const rows = await sql`UPDATE public.inventory_alert_deliveries SET state = 'sending', lease_id = ${lease}::uuid,
      lease_until = now() + interval '2 minutes', attempts = attempts + 1
    WHERE id = (SELECT d.id FROM public.inventory_alert_deliveries d JOIN public.vehicle_inventory_alerts a ON a.id = d.alert_id
      WHERE d.state IN ('pending', 'sending') AND d.next_attempt_at <= now() AND (d.lease_until IS NULL OR d.lease_until < now())
        AND a.status = 'active' AND a.generation = d.generation
      ORDER BY d.created_at LIMIT 1 FOR UPDATE OF d SKIP LOCKED)
    RETURNING id, alert_id, generation, attempts, uncertain, request_payload`;
  if (!rows.length) return false;
  const row = parseRow('inventory_alert_deliveries', rows[0], parseInventoryDelivery);
  try {
    const alerts = await sql`SELECT email FROM public.vehicle_inventory_alerts
      WHERE id = ${row.alert_id}::uuid AND generation = ${row.generation}::uuid AND status = 'active'`;
    if (!alerts.length) {
      await sql`UPDATE public.inventory_alert_deliveries SET state = 'cancelled' WHERE id = ${row.id}::uuid AND lease_id = ${lease}::uuid`;
      return true;
    }
    let payload = row.request_payload;
    let count = null as number | null;
    if (!payload) {
      // Before the first send of a series only: cars reserved or sold since they matched are dropped
      // and forgotten, so they can be announced if they come back.
      await sql`DELETE FROM public.inventory_alert_matches m
        WHERE m.delivery_id = ${row.id}::uuid
          AND EXISTS (SELECT 1 FROM public.inventory_alert_deliveries WHERE id = ${row.id}::uuid AND lease_id = ${lease}::uuid)
          AND NOT EXISTS (SELECT 1 FROM public.catalog_publications p WHERE p.publication_id = m.publication_id AND p.status = 'active')`;
      const matches = await sql`SELECT p.publication_id, p.slug, p.vehicle, m.previous_status FROM public.inventory_alert_matches m
        JOIN public.catalog_publications p ON p.publication_id = m.publication_id
        WHERE m.delivery_id = ${row.id}::uuid AND p.status = 'active'
        ORDER BY m.created_at, m.publication_id`;
      // A car whose stored row is invalid is left out of the email.
      const vehicles = parseRows('catalog_publications', matches, parseMatchedPublication).map(emailVehicle);
      if (!vehicles.length) {
        await sql`UPDATE public.inventory_alert_deliveries SET state = 'cancelled', failure_code = 'no_longer_available'
          WHERE id = ${row.id}::uuid AND lease_id = ${lease}::uuid`;
        return true;
      }
      count = vehicles.length;
      payload = buildSearchMatchEmail({ id: row.alert_id, generation: row.generation,
        email: parseRow('vehicle_inventory_alerts', alerts[0], parseAlertEmail),
        vehicles: vehicles.slice(0, MAX_VEHICLES_PER_EMAIL), more: Math.max(0, vehicles.length - MAX_VEHICLES_PER_EMAIL) });
    }
    // Immutable bytes before the first send of a series, and `uncertain` before every send: a crash
    // from here on leaves the outcome unknown, and only the same key may retry it.
    const frozen = await sql`UPDATE public.inventory_alert_deliveries SET
        request_payload = COALESCE(request_payload, ${JSON.stringify(payload)}::jsonb),
        vehicle_count = COALESCE(vehicle_count, ${count}::int),
        series_started_at = COALESCE(series_started_at, now()), uncertain = true
      WHERE id = ${row.id}::uuid AND lease_id = ${lease}::uuid RETURNING request_payload, key_series`;
    if (!frozen.length) return true;
    const { request_payload: frozenPayload, key_series: series } = parseRow('inventory_alert_deliveries', frozen[0], parseFrozenInventoryDelivery);
    const providerId = await sendAlertEmail(frozenPayload, `gonba-search-${row.id}-${series}`);
    await sql.transaction([
      sql`UPDATE public.inventory_alert_deliveries SET state = 'accepted', provider_id = ${providerId}, accepted_at = now(),
          lease_until = NULL, failure_code = NULL
        WHERE id = ${row.id}::uuid AND lease_id = ${lease}::uuid`,
      sql`UPDATE public.vehicle_inventory_alerts SET last_notified_at = now()
        WHERE id = ${row.alert_id}::uuid AND generation = ${row.generation}::uuid
          AND EXISTS (SELECT 1 FROM public.inventory_alert_deliveries WHERE id = ${row.id}::uuid AND state = 'accepted' AND provider_id = ${providerId})`,
    ]);
  } catch (error) {
    if (error instanceof EmailFailure) {
      // A definite rejection restores the previous certainty: this attempt cannot have been accepted.
      await sql`UPDATE public.inventory_alert_deliveries SET state = ${error.retryable ? 'pending' : 'failed'}::text,
          failure_code = ${error.code}, uncertain = ${error.ambiguous || Boolean(row.uncertain)}::boolean, lease_until = NULL,
          next_attempt_at = now() + ${backoffSeconds(Number(row.attempts))}::int * interval '1 second'
        WHERE id = ${row.id}::uuid AND lease_id = ${lease}::uuid`;
    }
    // Unknown or database failures keep the lease and `uncertain`, so the retry reuses the same key.
    console.error('inventory_alert_delivery_failure', { deliveryId: row.id, code: error instanceof EmailFailure ? error.code : 'processing_failure' });
  }
  return true;
}

async function expireEvents() {
  const sql = getSql();
  await sql`UPDATE public.inventory_alert_events SET state = 'expired', processed_at = now()
    WHERE state = 'pending' AND created_at < now() - ${EVENT_LIFETIME_HOURS}::int * interval '1 hour'
      AND (lease_until IS NULL OR lease_until < now())`;
  await sql`DELETE FROM public.inventory_alert_events WHERE state <> 'pending' AND created_at < now() - interval '30 days'`;
}

/**
 * Matches every due event before batching, so cars that arrive together share one email, then
 * sends due emails. Bounded by time and volume. Unlike the price-alert worker it never waits for a
 * retry: work in backoff is picked up by the next run (any item notification and both daily crons),
 * so a provider blip never keeps a webhook function alive.
 */
export async function runInventoryAlertWork({ budgetMs = 200_000 } = {}) {
  if (!alertEmailsConfigured()) return;
  const deadline = Date.now() + budgetMs;
  await expireEvents();
  let events = 0;
  let deliveries = 0;
  while (Date.now() < deadline && events < MAX_EVENTS_PER_RUN && await processNextEvent()) events++;
  await batchMatches();
  while (Date.now() < deadline && deliveries < MAX_DELIVERIES_PER_RUN && await processNextDelivery()) deliveries++;
}

export async function runInventoryAlertWorkSafely(options?: { budgetMs?: number }) {
  try { await runInventoryAlertWork(options); }
  catch { console.error('inventory_alert_worker_failure'); }
}

/** Cancels one alert generation. Unsent emails are dropped. A send already in progress may finish. */
export async function cancelInventoryAlert(id: string, generation: string) {
  const sql = getSql();
  await sql`UPDATE public.vehicle_inventory_alerts SET status = 'cancelled', updated_at = now()
    WHERE id = ${id}::uuid AND generation = ${generation}::uuid`;
  await sql`UPDATE public.inventory_alert_deliveries SET state = 'cancelled'
    WHERE alert_id = ${id}::uuid AND generation = ${generation}::uuid AND state = 'pending'`;
}
