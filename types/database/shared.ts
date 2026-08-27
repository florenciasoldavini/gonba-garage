import type { Vehicle } from '@/features/vehicles/domain/vehicle';

/** Shared primitives for provisional database models. */
export type DatabaseId = string;
export type DateTimeString = string;
export type VehicleCurrency = Vehicle['currency'];
export type MarketplaceProvider = 'mercado_libre';

export type TableInsert<Row, OptionalKeys extends keyof Row> =
  Omit<Row, OptionalKeys> & Partial<Pick<Row, OptionalKeys>>;

export type TableUpdate<Row, ImmutableKeys extends keyof Row = never> =
  Partial<Omit<Row, ImmutableKeys>>;
