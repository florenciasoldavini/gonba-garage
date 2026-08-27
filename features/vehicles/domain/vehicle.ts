export type VehicleStatus = 'active' | 'paused' | 'sold';

/**
 * Canonical vehicle shape used by pages and data-source adapters.
 * External APIs should normalize their payloads into this type.
 */
export type Vehicle = {
  slug: string;
  make: string;
  model: string;
  version: string;
  year: number;
  price: number;
  currency: 'ARS' | 'USD';
  mileageKm: number;
  transmission: string;
  fuel: string;
  engine: string;
  color: string;
  body: string;
  traction: string;
  location: string;
  stockCode: string;
  image: string;
  imageAlt: string;
  description: string;
  highlights: string[];
  status: VehicleStatus;
  mercadoLibreId?: string;
  mercadoLibreUrl?: string;
  updatedAt: string;
};
