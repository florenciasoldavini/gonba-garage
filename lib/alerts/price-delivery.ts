import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import { catalogAccessToken } from '@/lib/integrations/mercado-libre/access-token';
import { readMercadoLibrePublication } from '@/lib/integrations/mercado-libre/oauth';
import { getAlertsSql } from './database';
import { alertDeliveryEnabled, requireAlertConfig } from './config';
import { buildAlertEmail, EmailFailure, sendAlertEmail } from './email';

type Delivery = {
  id: string; alert_id: string; generation: string; kind: 'welcome' | 'drop';
  price: number; previous_price: number; currency: string; title: string; vehicle_slug: string;
  email: string; attempts: number; first_attempt_at: string; request_payload: ReturnType<typeof buildAlertEmail> | null;
};

/**
 * Signup stores a pending subscription; nothing is delivered until `confirmPriceAlert`. Active
 * alerts stay active and keep their low watermark. A pending alert keeps its generation, so an
 * earlier confirmation link still works, while a cancelled one restarts with a new generation.
 */
export async function requestPriceAlert(email: string, vehicle: Vehicle) {
  requireAlertConfig();
  if (!vehicle.mercadoLibreId || !/^MLA\d+$/.test(vehicle.mercadoLibreId)) throw new Error('Missing publication ID');
  if (!Number.isFinite(vehicle.price) || vehicle.price <= 0 || !['ARS', 'USD'].includes(vehicle.currency)) throw new Error('Invalid publication price');
  const sql = getAlertsSql();
  const title = [vehicle.make, vehicle.model, vehicle.version, vehicle.year].filter(Boolean).join(' ');
  const rows = await sql`INSERT INTO public.vehicle_price_alerts (email, vehicle_slug, publication_id, vehicle_title, current_price, currency, source, status)
    VALUES (${email}, ${vehicle.slug}, ${vehicle.mercadoLibreId}, ${title}, ${vehicle.price}, ${vehicle.currency}, 'mercado_libre', 'pending')
    ON CONFLICT (publication_id, email) WHERE publication_id IS NOT NULL DO UPDATE SET
      vehicle_slug = EXCLUDED.vehicle_slug, vehicle_title = EXCLUDED.vehicle_title,
      current_price = CASE WHEN vehicle_price_alerts.status = 'active' THEN vehicle_price_alerts.current_price ELSE EXCLUDED.current_price END,
      currency = CASE WHEN vehicle_price_alerts.status = 'active' THEN vehicle_price_alerts.currency ELSE EXCLUDED.currency END,
      last_notified_price = CASE WHEN vehicle_price_alerts.status = 'active' THEN vehicle_price_alerts.last_notified_price ELSE NULL END,
      generation = CASE WHEN vehicle_price_alerts.status IN ('active', 'pending') THEN vehicle_price_alerts.generation ELSE gen_random_uuid() END,
      status = CASE WHEN vehicle_price_alerts.status = 'active' THEN 'active' ELSE 'pending' END,
      updated_at = now()
    RETURNING id, generation, status, vehicle_title`;
  return rows[0] as { id: string; generation: string; status: 'pending' | 'active'; vehicle_title: string };
}

/**
 * Activation and the welcome email are queued atomically, as signup did before confirmation existed.
 * Idempotent: repeated or concurrent confirmations update and queue at most once.
 * Returns the vehicle slug when that generation is active now, otherwise null.
 */
export async function confirmPriceAlert(id: string, generation: string) {
  const sql = getAlertsSql();
  await sql`WITH confirmed AS (
    UPDATE public.vehicle_price_alerts SET status = 'active', confirmed_at = now(), updated_at = now()
    WHERE id = ${id} AND generation = ${generation} AND status = 'pending'
    RETURNING *
  ) INSERT INTO public.price_alert_deliveries (alert_id, generation, kind, price, previous_price, currency, title, vehicle_slug)
    SELECT id, generation, 'welcome', current_price, current_price, currency, vehicle_title, vehicle_slug FROM confirmed
    ON CONFLICT DO NOTHING`;
  const rows = await sql`SELECT vehicle_slug FROM public.vehicle_price_alerts WHERE id = ${id} AND generation = ${generation} AND status = 'active'`;
  return rows.length ? String(rows[0].vehicle_slug) : null;
}

export async function enqueuePriceItem(id: string) {
  const sql = getAlertsSql();
  await sql`INSERT INTO public.price_alert_item_jobs (publication_id)
    SELECT ${id} WHERE EXISTS (SELECT 1 FROM public.vehicle_price_alerts WHERE publication_id = ${id} AND status = 'active')
    ON CONFLICT (publication_id) DO UPDATE SET revision = price_alert_item_jobs.revision + 1,
      next_attempt_at = now(), updated_at = now()`;
}

export async function enqueueDailyPriceReview() {
  const sql = getAlertsSql();
  await sql`INSERT INTO public.price_alert_item_jobs (publication_id)
    SELECT DISTINCT publication_id FROM public.vehicle_price_alerts WHERE status = 'active' AND publication_id IS NOT NULL
    ON CONFLICT (publication_id) DO UPDATE SET revision = price_alert_item_jobs.revision + 1,
      next_attempt_at = now(), updated_at = now()`;
}

/** Price and currency from an authoritative, seller-checked publication only. */
export async function recordPriceObservation(id: string, vehicle: Vehicle) {
  const sql = getAlertsSql();
  if (vehicle.status !== 'active' || !Number.isFinite(vehicle.price) || vehicle.price <= 0) return;
  await sql`INSERT INTO public.price_alert_deliveries (alert_id, generation, kind, price, previous_price, currency, title, vehicle_slug)
    SELECT id, generation, 'drop', ${vehicle.price}, COALESCE(last_notified_price, current_price), currency,
      ${[vehicle.make, vehicle.model, vehicle.version, vehicle.year].filter(Boolean).join(' ')}, ${vehicle.slug}
    FROM public.vehicle_price_alerts
    WHERE publication_id = ${id} AND status = 'active' AND currency = ${vehicle.currency}
      AND COALESCE(last_notified_price, current_price) > ${vehicle.price}
      AND NOT EXISTS (SELECT 1 FROM public.price_alert_deliveries d WHERE d.alert_id = vehicle_price_alerts.id
        AND d.generation = vehicle_price_alerts.generation AND d.kind = 'drop' AND d.state IN ('pending','sending','blocked'))
    ON CONFLICT DO NOTHING`;
  await sql`UPDATE public.vehicle_price_alerts SET vehicle_slug = ${vehicle.slug}, last_checked_at = now()
    WHERE publication_id = ${id} AND status = 'active'`;
}

async function processItem() {
  const sql = getAlertsSql(), lease = randomUUID();
  const jobs = await sql`UPDATE public.price_alert_item_jobs SET lease_id = ${lease}, lease_until = now() + interval '90 seconds', attempts = attempts + 1
    WHERE publication_id = (SELECT publication_id FROM public.price_alert_item_jobs
      WHERE revision > processed_revision AND next_attempt_at <= now() AND (lease_until IS NULL OR lease_until < now())
      ORDER BY updated_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING publication_id, revision, attempts`;
  if (!jobs.length) return false;
  const job = jobs[0];
  try {
    const subscriptions = await sql`SELECT id FROM public.vehicle_price_alerts WHERE publication_id = ${job.publication_id} AND status = 'active' LIMIT 1`;
    if (subscriptions.length) {
      const publication = await readMercadoLibrePublication(job.publication_id, await catalogAccessToken());
      if (String(publication.source.seller_id) !== process.env.MERCADO_LIBRE_SELLER_ID || publication.source.id !== job.publication_id) {
        throw new Error('Publication ownership mismatch');
      }
      await recordPriceObservation(job.publication_id, publication.vehicle);
    }
    await sql`UPDATE public.price_alert_item_jobs SET processed_revision = ${job.revision}, lease_id = NULL, lease_until = NULL, attempts = 0
      WHERE publication_id = ${job.publication_id} AND lease_id = ${lease}`;
  } catch {
    await sql`UPDATE public.price_alert_item_jobs SET lease_id = NULL, lease_until = NULL,
      next_attempt_at = now() + ${Math.min(3600, 30 * 2 ** Math.min(Number(job.attempts), 7))} * interval '1 second'
      WHERE publication_id = ${job.publication_id} AND lease_id = ${lease}`;
    console.error('price_alert_item_retry', { publicationId: job.publication_id });
  }
  return true;
}

export async function processPriceDelivery() {
  const sql = getAlertsSql(), lease = randomUUID();
  // A stable idempotency key protects only 24h at the provider. Never blind-retry an ambiguous send beyond 23h.
  await sql`UPDATE public.price_alert_deliveries SET state = 'blocked', failure_code = 'ambiguous_send_window_expired'
    WHERE state IN ('pending','sending') AND first_attempt_at < now() - interval '23 hours'
      AND (lease_until IS NULL OR lease_until < now())`;
  await sql`UPDATE public.price_alert_deliveries d SET state = 'cancelled'
    WHERE state = 'pending' AND NOT EXISTS (SELECT 1 FROM public.vehicle_price_alerts a
      WHERE a.id = d.alert_id AND a.generation = d.generation AND a.status = 'active')`;
  const rows = await sql`UPDATE public.price_alert_deliveries SET state = 'sending', lease_id = ${lease},
      lease_until = now() + interval '2 minutes', attempts = attempts + 1
    WHERE id = (SELECT d.id FROM public.price_alert_deliveries d JOIN public.vehicle_price_alerts a ON a.id = d.alert_id
      WHERE d.state IN ('pending','sending') AND d.next_attempt_at <= now() AND (d.lease_until IS NULL OR d.lease_until < now())
      AND a.status = 'active' AND a.generation = d.generation
      ORDER BY d.created_at LIMIT 1 FOR UPDATE OF d SKIP LOCKED) RETURNING *`;
  if (!rows.length) return false;
  const row = rows[0] as Delivery;
  try {
    const alerts = await sql`SELECT email FROM public.vehicle_price_alerts WHERE id = ${row.alert_id} AND status = 'active' AND generation = ${row.generation}`;
    if (!alerts.length) {
      await sql`UPDATE public.price_alert_deliveries SET state = 'cancelled' WHERE id = ${row.id} AND lease_id = ${lease}`;
      return true;
    }
    if (row.kind === 'drop' && !row.request_payload) {
      const subscription = await sql`SELECT publication_id FROM public.vehicle_price_alerts WHERE id = ${row.alert_id}`;
      const publication = await readMercadoLibrePublication(subscription[0].publication_id, await catalogAccessToken());
      if (String(publication.source.seller_id) !== process.env.MERCADO_LIBRE_SELLER_ID || publication.source.id !== subscription[0].publication_id) throw new Error('Publication ownership mismatch');
      const current = publication.vehicle;
      if (current.status !== 'active' || current.currency !== row.currency || current.price > Number(row.price)) {
        await sql`UPDATE public.price_alert_deliveries SET state = 'cancelled', failure_code = 'price_no_longer_available'
          WHERE id = ${row.id} AND lease_id = ${lease}`;
        return true;
      }
    }
    const payload = row.request_payload || buildAlertEmail({ ...row, id: row.alert_id, email: alerts[0].email });
    // Persist immutable bytes before the first send. Retries use the same payload and key.
    const frozen = await sql`UPDATE public.price_alert_deliveries SET request_payload = ${JSON.stringify(payload)}::jsonb, first_attempt_at = COALESCE(first_attempt_at, now())
      WHERE id = ${row.id} AND lease_id = ${lease} RETURNING request_payload`;
    if (!frozen.length) return true;
    const providerId = await sendAlertEmail(frozen[0].request_payload, `gonba-price-${row.id}`);
    await sql.transaction([
      sql`UPDATE public.price_alert_deliveries SET state = 'accepted', provider_id = ${providerId}, lease_until = NULL, failure_code = NULL
        WHERE id = ${row.id} AND lease_id = ${lease}`,
      sql`UPDATE public.vehicle_price_alerts SET last_notified_price = LEAST(COALESCE(last_notified_price, current_price), ${row.price}), updated_at = now()
        WHERE id = ${row.alert_id} AND generation = ${row.generation} AND status = 'active' AND ${row.kind} = 'drop'
          AND EXISTS (SELECT 1 FROM public.price_alert_deliveries WHERE id = ${row.id} AND state = 'accepted' AND provider_id = ${providerId})`,
    ]);
  } catch (error) {
    if (error instanceof EmailFailure) {
      await sql`UPDATE public.price_alert_deliveries SET state = ${error.retryable ? 'pending' : 'failed'},
        failure_code = ${error.code}, lease_until = NULL,
        next_attempt_at = now() + ${Math.min(3600, 30 * 2 ** Math.min(Number(row.attempts), 7))} * interval '1 second'
        WHERE id = ${row.id} AND lease_id = ${lease}`;
    }
    // Unknown/DB failures retain the lease, so acceptance is recoverable with the same provider key.
    console.error('price_alert_delivery_failure', { deliveryId: row.id, code: error instanceof EmailFailure ? error.code : 'processing_failure' });
  }
  return true;
}

export async function runPriceAlertWork() {
  if (!alertDeliveryEnabled()) return;
  requireAlertConfig();
  const deadline = Date.now() + 200_000;
  let items = 0, deliveries = 0;
  while (Date.now() < deadline && items < 50 && deliveries < 150) {
    // Clear durable outbox work before observing fresh prices.
    if (await processPriceDelivery()) { deliveries++; continue; }
    if (await processItem()) { items++; continue; }
    const sql = getAlertsSql();
    const due = await sql`SELECT min(next_attempt_at) AS next FROM (
      SELECT next_attempt_at FROM public.price_alert_deliveries WHERE state = 'pending'
      UNION ALL SELECT next_attempt_at FROM public.price_alert_item_jobs WHERE revision > processed_revision
        AND (lease_until IS NULL OR lease_until < now())
    ) pending`;
    const next = due[0]?.next ? new Date(due[0].next).getTime() : Infinity;
    if (next <= Date.now() || next >= deadline) break;
    // Short, bounded waits allow prompt transient retries within this function's lifetime.
    await new Promise(resolve => setTimeout(resolve, Math.min(30_000, next - Date.now() + 50)));
  }
}

export async function runPriceAlertWorkSafely() {
  try { await runPriceAlertWork(); }
  catch { console.error('price_alert_worker_failure'); }
}
