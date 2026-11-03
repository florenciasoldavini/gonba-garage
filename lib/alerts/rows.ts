import type { InventorySearchCriteria } from '@/features/vehicles/domain/inventory-search';
import { parseStoredVehicle } from '@/lib/catalog/rows';
import {
  boolean,
  decimal,
  integer,
  oneOf,
  optionalText,
  optionalTimestamp,
  publicationId,
  record,
  text,
  textList,
  uuid,
  type Row,
} from '@/lib/database-rows';

/** Row parsers for the alert tables (database/migrations/20261028_alert_subscriptions.sql and later). */

const SIGNUP_STATUSES = ['pending', 'active'] as const;
const CURRENCIES = ['ARS', 'USD'] as const;
const TRANSMISSIONS = ['', 'automatic', 'manual'] as const;
const RELEASED_STATUSES = ['paused', 'closed', 'sold'] as const;

/** An email request frozen before its first send. Retries send these exact bytes. */
export type EmailPayload = Row & { to: string[] };

function payload(value: unknown, field: string): EmailPayload {
  const frozen = record(value, field);
  textList(frozen.to, `${field}.to`);
  return frozen as EmailPayload;
}

const optionalPayload = (value: unknown, field: string) => (value === null ? null : payload(value, field));

/** `id, generation, status` returned by a signup upsert of either alert table. */
export function parseSignup(row: Row) {
  return {
    id: uuid(row.id, 'id'),
    generation: uuid(row.generation, 'generation'),
    status: oneOf(SIGNUP_STATUSES, row.status, 'status'),
  };
}

export function parsePriceSignup(row: Row) {
  return { ...parseSignup(row), vehicle_title: text(row.vehicle_title, 'vehicle_title') };
}

export function parseAlertEmail(row: Row) {
  return text(row.email, 'email');
}

export function parseAlertSlug(row: Row) {
  return text(row.vehicle_slug, 'vehicle_slug');
}

export function parseAlertPublication(row: Row) {
  return publicationId(row.publication_id, 'publication_id');
}

/** A claimed row of price_alert_deliveries (`RETURNING *`). */
export function parsePriceDelivery(row: Row) {
  return {
    id: uuid(row.id, 'id'),
    alert_id: uuid(row.alert_id, 'alert_id'),
    generation: uuid(row.generation, 'generation'),
    kind: oneOf(['welcome', 'drop'] as const, row.kind, 'kind'),
    price: decimal(row.price, 'price'),
    previous_price: decimal(row.previous_price, 'previous_price'),
    currency: oneOf(CURRENCIES, row.currency, 'currency'),
    title: text(row.title, 'title'),
    vehicle_slug: text(row.vehicle_slug, 'vehicle_slug'),
    attempts: integer(row.attempts, 'attempts'),
    first_attempt_at: optionalTimestamp(row.first_attempt_at, 'first_attempt_at')?.toISOString() ?? null,
    request_payload: optionalPayload(row.request_payload, 'request_payload'),
  };
}

export function parseFrozenPriceDelivery(row: Row) {
  return { request_payload: payload(row.request_payload, 'request_payload') };
}

/** The earliest `next_attempt_at` of the price-alert queues, null when nothing waits. */
export function parseNextPriceAttempt(row: Row) {
  return optionalTimestamp(row.next, 'next');
}

/** An active row of vehicle_inventory_alerts, with its criteria as the catalog search reads them. */
export function parseInventoryAlert(row: Row): { id: string; generation: string; criteria: InventorySearchCriteria } {
  // Stored zeros mean "no bound", as in the signup route.
  const bound = (field: string) => {
    const value = decimal(row[field], field);
    return value > 0 ? value : null;
  };
  return {
    id: uuid(row.id, 'id'),
    generation: uuid(row.generation, 'generation'),
    criteria: {
      query: text(row.search_query, 'search_query'),
      make: text(row.make, 'make'),
      transmission: oneOf(TRANSMISSIONS, row.transmission, 'transmission'),
      bodyType: text(row.body_type, 'body_type'),
      fuel: text(row.fuel, 'fuel'),
      minPrice: bound('min_price'),
      maxPrice: bound('max_price'),
      minMileage: bound('min_mileage'),
      maxMileage: bound('max_mileage'),
    },
  };
}

/** A claimed row of inventory_alert_events. previous_status is null for a new listing. */
export function parseInventoryEvent(row: Row) {
  return {
    id: uuid(row.id, 'id'),
    publication_id: publicationId(row.publication_id, 'publication_id'),
    previous_status:
      row.previous_status === null ? null : oneOf(RELEASED_STATUSES, row.previous_status, 'previous_status'),
    attempts: integer(row.attempts, 'attempts'),
  };
}

/** A claimed row of inventory_alert_deliveries. */
export function parseInventoryDelivery(row: Row) {
  return {
    id: uuid(row.id, 'id'),
    alert_id: uuid(row.alert_id, 'alert_id'),
    generation: uuid(row.generation, 'generation'),
    attempts: integer(row.attempts, 'attempts'),
    uncertain: boolean(row.uncertain, 'uncertain'),
    request_payload: optionalPayload(row.request_payload, 'request_payload'),
  };
}

export function parseFrozenInventoryDelivery(row: Row) {
  return {
    request_payload: payload(row.request_payload, 'request_payload'),
    key_series: integer(row.key_series, 'key_series'),
  };
}

/** A matched car of an email: its publication's slug and vehicle, and the match's previous status. */
export function parseMatchedPublication(row: Row) {
  return {
    slug: text(row.slug, 'slug'),
    vehicle: parseStoredVehicle(row.vehicle),
    previous_status: optionalText(row.previous_status, 'previous_status'),
  };
}
