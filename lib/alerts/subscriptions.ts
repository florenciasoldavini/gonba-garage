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

/** All amounts in inventory filters are USD comparison values, as in the catalog. */
export async function saveInventorySubscription(input: InventorySubscription) {
  const sql = getAlertsSql();
  await sql`
    INSERT INTO public.vehicle_inventory_alerts
      (email, search_query, make, transmission, body_type, fuel,
       min_price, max_price, min_mileage, max_mileage)
    VALUES (${input.email}, ${input.query}, ${input.make}, ${input.transmission},
      ${input.bodyType}, ${input.fuel}, ${input.minPrice}, ${input.maxPrice},
      ${input.minMileage}, ${input.maxMileage})
    ON CONFLICT (email, search_query, make, transmission, body_type, fuel,
      min_price, max_price, min_mileage, max_mileage)
    DO UPDATE SET status = 'active', updated_at = now()
  `;
}

export type PriceSubscription = {
  email: string;
  vehicleSlug: string;
  price: number;
  currency: string;
};

export async function savePriceSubscription(input: PriceSubscription) {
  const sql = getAlertsSql();
  await sql`
    INSERT INTO public.vehicle_price_alerts (email, vehicle_slug, current_price, currency)
    VALUES (${input.email}, ${input.vehicleSlug}, ${input.price}, ${input.currency})
    ON CONFLICT (vehicle_slug, email) DO UPDATE SET
      current_price = CASE WHEN vehicle_price_alerts.status = 'active'
        THEN vehicle_price_alerts.current_price ELSE EXCLUDED.current_price END,
      currency = CASE WHEN vehicle_price_alerts.status = 'active'
        THEN vehicle_price_alerts.currency ELSE EXCLUDED.currency END,
      status = 'active', updated_at = now()
  `;
}
