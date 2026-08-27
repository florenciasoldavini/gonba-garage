import type { Vehicle } from './vehicle';

export type VehicleRepository = {
  listActive(): Promise<Vehicle[]>;
  findBySlug(slug: string): Promise<Vehicle | null>;
  syncFromMercadoLibre(itemId: string): Promise<void>;
};
