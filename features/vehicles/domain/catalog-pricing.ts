import type { Vehicle } from './vehicle';

export type MepQuote = { arsPerUsd: number; updatedAt: string };
export const MAX_QUOTE_AGE_MS = 96 * 60 * 60 * 1000;

export function parseMepQuote(value: unknown, now = Date.now()): MepQuote | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (data.moneda !== 'USD' || data.casa !== 'bolsa' || typeof data.venta !== 'number' || !Number.isFinite(data.venta) || data.venta <= 0 || typeof data.fechaActualizacion !== 'string') return null;
  const timestamp = Date.parse(data.fechaActualizacion);
  if (!Number.isFinite(timestamp) || timestamp > now + 5 * 60 * 1000 || now - timestamp > MAX_QUOTE_AGE_MS) return null;
  return { arsPerUsd: data.venta, updatedAt: new Date(timestamp).toISOString() };
}

/** Comparison value only; never mutate the original price/currency used by cards and metadata. */
export function comparableUsdPrice(vehicle: Pick<Vehicle, 'price' | 'currency'>, quote: MepQuote | null): number | null {
  if (vehicle.currency === 'USD') return vehicle.price;
  if (!quote || !Number.isFinite(quote.arsPerUsd) || quote.arsPerUsd <= 0) return null;
  return vehicle.price / quote.arsPerUsd;
}
