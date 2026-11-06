import type { Vehicle, VehicleStatus } from '@/features/vehicles/domain/vehicle';
import type {
  MercadoLibreAttribute,
  MercadoLibreDescription,
  MercadoLibrePicture,
} from '@/lib/integrations/mercado-libre/types';
import { VEHICLE_CATEGORIES, type VehicleCategory } from '@/lib/integrations/mercado-libre/vehicle-categories';
import {
  boolean,
  integer,
  list,
  number,
  oneOf,
  optionalInteger,
  optionalText,
  optionalTimestamp,
  publicationId,
  record,
  text,
  timestamp,
  type Row,
} from '@/lib/database-rows';
import type { CatalogPublication } from './store';

/** Row parsers for the catalog tables (database/migrations/20261031_catalog_sync.sql and later). */

const STATUSES: readonly VehicleStatus[] = ['active', 'paused', 'closed', 'sold'];
const CURRENCIES: readonly Vehicle['currency'][] = ['ARS', 'USD'];
const CATEGORIES = Object.keys(VEHICLE_CATEGORIES) as VehicleCategory[];

/** Slug, status and updatedAt live in their own columns. */
export type StoredVehicle = Omit<Vehicle, 'slug' | 'status' | 'updatedAt'>;

/**
 * The `vehicle` column, as features/vehicles/data/mercado-libre-vehicle-mapper.ts built it. A row is
 * rewritten only when its item is read again, and closed publications never are, so every shape
 * ever saved stays readable. A field added to Vehicle must be read here with a default: rows saved
 * before it existed lack it. Older shapes:
 * - no `mercadoLibreUrl` when the listing had no permalink (JSON leaves out undefined);
 * - a decimal or negative year or mileage, from the mapper before whole-number parsing;
 * - the previous photo fallback as `image`, swapped by lib/integrations/mercado-libre/catalog.ts.
 */
export function parseStoredVehicle(value: unknown): StoredVehicle {
  const vehicle = record(value, 'vehicle');
  const string = (name: keyof StoredVehicle) => text(vehicle[name], `vehicle.${name}`);
  const optional = (name: 'mercadoLibreId' | 'mercadoLibreUrl') =>
    vehicle[name] === undefined ? {} : { [name]: string(name) };
  return {
    make: string('make'),
    model: string('model'),
    version: string('version'),
    year: number(vehicle.year, 'vehicle.year'),
    price: number(vehicle.price, 'vehicle.price'),
    currency: oneOf(CURRENCIES, vehicle.currency, 'vehicle.currency'),
    mileageKm: number(vehicle.mileageKm, 'vehicle.mileageKm'),
    transmission: string('transmission'),
    fuel: string('fuel'),
    engine: string('engine'),
    color: string('color'),
    body: string('body'),
    traction: string('traction'),
    location: string('location'),
    stockCode: string('stockCode'),
    image: string('image'),
    imageAlt: string('imageAlt'),
    description: string('description'),
    // Attribute names copied from Mercado Libre. A missing one is left out rather than hiding the car.
    highlights: list(vehicle.highlights, 'vehicle.highlights').filter(highlight => typeof highlight === 'string'),
    ...optional('mercadoLibreId'),
    ...optional('mercadoLibreUrl'),
  };
}

/** `slug, status, vehicle, content_changed_at` of catalog_publications. */
export function parseCatalogVehicle(row: Row): Vehicle {
  return {
    ...parseStoredVehicle(row.vehicle),
    slug: text(row.slug, 'slug'),
    status: oneOf(STATUSES, row.status, 'status'),
    // A real content or availability change, never a provider-side touch or the sync time.
    updatedAt: timestamp(row.content_changed_at, 'content_changed_at').toISOString(),
  };
}

/** The public subset of the item that savePublication stores, returned as stored. */
function parseSource(value: unknown): CatalogPublication['source'] {
  const source = record(value, 'source');
  publicationId(source.id, 'source.id');
  text(source.title, 'source.title');
  if (source.permalink != null) text(source.permalink, 'source.permalink');
  return {
    ...source,
    pictures: list(source.pictures ?? [], 'source.pictures').map(
      picture => record(picture, 'source.pictures') as MercadoLibrePicture,
    ),
    attributes: list(source.attributes ?? [], 'source.attributes').map(entry => {
      const attribute = record(entry, 'source.attributes');
      text(attribute.id, 'source.attributes.id');
      return attribute as MercadoLibreAttribute;
    }),
  } as CatalogPublication['source'];
}

/** Mercado Libre's description payload, returned as stored. Null when the item had none. */
function parseDescription(value: unknown): MercadoLibreDescription | null {
  if (value === null) return null;
  const description = record(value, 'description');
  for (const name of ['text', 'plain_text']) {
    if (description[name] !== undefined) text(description[name], `description.${name}`);
  }
  return description as MercadoLibreDescription;
}

/** `slug, status, vehicle, source, description, content_changed_at` of catalog_publications. */
export function parseCatalogPublication(row: Row): CatalogPublication {
  return {
    vehicle: parseCatalogVehicle(row),
    description: parseDescription(row.description),
    source: parseSource(row.source),
  };
}

/** The counts returned by savePublication's statement. */
export function parseSaveResult(row: Row) {
  return {
    saved: integer(row.saved, 'saved') === 1,
    priceChanged: integer(row.price_changes, 'price_changes') === 1,
    becameAvailable: integer(row.available, 'available') === 1,
    changed: integer(row.changed, 'changed') === 1,
  };
}

/** The result of markPublicationRemoved's statement. */
export function parseRemovalResult(row: Row) {
  return { changed: boolean(row.changed, 'changed') };
}

export function parseQueuedNotification(row: Row) {
  return { deferred: boolean(row.deferred, 'deferred') };
}

export function parseDueCheck(row: Row) {
  return { due: boolean(row.due, 'due') };
}

/** `publication_id, status, source_updated_at, synced_at, vehicle_category` of catalog_publications. */
export function parseStoredSyncState(row: Row) {
  return [
    publicationId(row.publication_id, 'publication_id'),
    {
      status: oneOf(STATUSES, row.status, 'status'),
      // Null only for rows saved before categories were recorded, until they are read again.
      vehicleCategory:
        row.vehicle_category === null ? null : oneOf(CATEGORIES, row.vehicle_category, 'vehicle_category'),
      sourceUpdatedAt: optionalTimestamp(row.source_updated_at, 'source_updated_at')?.getTime() ?? null,
      syncedAt: timestamp(row.synced_at, 'synced_at').getTime(),
    },
  ] as const;
}

const iso = (value: unknown, field: string) => optionalTimestamp(value, field)?.toISOString() ?? null;

/** The reconciliation row of catalog_sync_runs. */
export function parseReconciliationHealth(row: Row) {
  return {
    lastStartedAt: iso(row.last_started_at, 'last_started_at'),
    lastCompletedAt: iso(row.last_completed_at, 'last_completed_at'),
    lastFailedAt: iso(row.last_failed_at, 'last_failed_at'),
    lastFailure: optionalText(row.last_failure, 'last_failure'),
    lastListed: optionalInteger(row.last_listed, 'last_listed'),
  };
}

/** Before the first reconciliation there is no row. */
export const NO_RECONCILIATION: ReturnType<typeof parseReconciliationHealth> = {
  lastStartedAt: null,
  lastCompletedAt: null,
  lastFailedAt: null,
  lastFailure: null,
  lastListed: null,
};

/** The job counts of readSyncHealth. */
export function parseJobHealth(row: Row) {
  return {
    pending: integer(row.pending, 'pending'),
    retrying: integer(row.retrying, 'retrying'),
    deferred: integer(row.deferred, 'deferred'),
    abandoned: integer(row.abandoned, 'abandoned'),
    abandonedLastDay: integer(row.abandoned_last_day, 'abandoned_last_day'),
    oldestPendingAt: iso(row.oldest_pending_at, 'oldest_pending_at'),
  };
}

/** One status group of readSyncHealth. */
export function parsePublicationHealth(row: Row) {
  return {
    status: oneOf(STATUSES, row.status, 'status'),
    count: integer(row.count, 'count'),
    lastSyncedAt: timestamp(row.last_synced_at, 'last_synced_at').toISOString(),
    oldestSyncedAt: timestamp(row.oldest_synced_at, 'oldest_synced_at').toISOString(),
  };
}
