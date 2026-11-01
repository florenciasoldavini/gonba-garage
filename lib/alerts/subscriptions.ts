import 'server-only';
import { getAlertsSql } from './database';

export type InventorySubscription = {
  email: string;
  query: string;
  make: string;
  transmission: string;
  bodyType: string;
  fuel: string;
  minPrice: number;
  maxPrice: number;
  minMileage: number;
  maxMileage: number;
};

/**
 * All amounts in inventory filters are USD comparison values, as in the catalog.
 * New and cancelled searches become pending until confirmed by email; active ones stay active.
 */
export async function saveInventorySubscription(input: InventorySubscription) {
  const sql = getAlertsSql();
  const rows = await sql`
    INSERT INTO public.vehicle_inventory_alerts
      (email, search_query, make, transmission, body_type, fuel,
       min_price, max_price, min_mileage, max_mileage, status)
    VALUES (${input.email}, ${input.query}, ${input.make}, ${input.transmission},
      ${input.bodyType}, ${input.fuel}, ${input.minPrice}, ${input.maxPrice},
      ${input.minMileage}, ${input.maxMileage}, 'pending')
    ON CONFLICT (email, search_query, make, transmission, body_type, fuel,
      min_price, max_price, min_mileage, max_mileage)
    DO UPDATE SET
      generation = CASE WHEN vehicle_inventory_alerts.status = 'cancelled'
        THEN gen_random_uuid() ELSE vehicle_inventory_alerts.generation END,
      status = CASE WHEN vehicle_inventory_alerts.status = 'active' THEN 'active' ELSE 'pending' END,
      updated_at = now()
    RETURNING id, generation, status
  `;
  return rows[0] as { id: string; generation: string; status: 'pending' | 'active' };
}

/** Idempotent. Returns whether that generation is active now. */
export async function confirmInventorySubscription(id: string, generation: string) {
  const sql = getAlertsSql();
  await sql`UPDATE public.vehicle_inventory_alerts SET status = 'active', confirmed_at = now(), updated_at = now()
    WHERE id = ${id} AND generation = ${generation} AND status = 'pending'`;
  const rows = await sql`SELECT 1 FROM public.vehicle_inventory_alerts
    WHERE id = ${id} AND generation = ${generation} AND status = 'active'`;
  return rows.length > 0;
}

export type PriceSubscription = {
  email: string;
  vehicleSlug: string;
  price: number;
  currency: string;
};

/** Storage where alert emails are not configured: stored as pending, no email is sent. */
export async function savePriceSubscription(input: PriceSubscription) {
  const sql = getAlertsSql();
  await sql`
    INSERT INTO public.vehicle_price_alerts (email, vehicle_slug, current_price, currency, status)
    VALUES (${input.email}, ${input.vehicleSlug}, ${input.price}, ${input.currency}, 'pending')
    ON CONFLICT (vehicle_slug, email) DO UPDATE SET
      current_price = CASE WHEN vehicle_price_alerts.status = 'active'
        THEN vehicle_price_alerts.current_price ELSE EXCLUDED.current_price END,
      currency = CASE WHEN vehicle_price_alerts.status = 'active'
        THEN vehicle_price_alerts.currency ELSE EXCLUDED.currency END,
      generation = CASE WHEN vehicle_price_alerts.status IN ('active', 'pending')
        THEN vehicle_price_alerts.generation ELSE gen_random_uuid() END,
      status = CASE WHEN vehicle_price_alerts.status = 'active' THEN 'active' ELSE 'pending' END,
      updated_at = now()
  `;
}
