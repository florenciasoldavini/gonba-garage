import type { Vehicle } from './vehicle';

export type MepQuote = { arsPerUsd: number; updatedAt: string };
/** The quote as the catalog receives it, with its update time already formatted on the server. */
export type CatalogMepQuote = MepQuote & { updatedAtLabel: string };
export const MAX_QUOTE_AGE_MS = 96 * 60 * 60 * 1000;

export function parseMepQuote(value: unknown, now = Date.now()): MepQuote | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (data.moneda !== 'USD' || data.casa !== 'bolsa' || typeof data.venta !== 'number' || !Number.isFinite(data.venta) || data.venta <= 0 || typeof data.fechaActualizacion !== 'string') return null;
  const timestamp = Date.parse(data.fechaActualizacion);
  if (!Number.isFinite(timestamp) || timestamp > now + 5 * 60 * 1000 || now - timestamp > MAX_QUOTE_AGE_MS) return null;
  return { arsPerUsd: data.venta, updatedAt: new Date(timestamp).toISOString() };
}

/**
 * Call on the server only. Node's and browsers' ICU data disagree on the space inside "p. m.",
 * so formatting this during a client render breaks hydration. No-break spaces become plain
 * spaces, which is what browsers render.
 */
export function formatMepQuoteUpdatedAt(updatedAt: string): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' })
    .format(new Date(updatedAt))
    .replace(/[\u00a0\u202f]/g, ' ');
}

/** Comparison value only; never mutate the original price/currency used by cards and metadata. */
export function comparableUsdPrice(vehicle: Pick<Vehicle, 'price' | 'currency'>, quote: MepQuote | null): number | null {
  if (vehicle.currency === 'USD') return vehicle.price;
  if (!quote || !Number.isFinite(quote.arsPerUsd) || quote.arsPerUsd <= 0) return null;
  return vehicle.price / quote.arsPerUsd;
}
