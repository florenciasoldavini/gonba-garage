export type VehicleStatus = 'active' | 'paused' | 'sold';

export type Vehicle = {
  id: string;
  mercadoLibreId: string;
  slug: string;
  make: string;
  model: string;
  version?: string;
  year: number;
  mileageKm: number;
  price: {
    amount: number;
    currency: 'ARS' | 'USD';
  };
  transmission?: string;
  fuel?: string;
  status: VehicleStatus;
  images: Array<{
    src: string;
    alt: string;
  }>;
  mercadoLibreUrl: string;
  updatedAt: string;
};

export type VehicleRepository = {
  listActive(): Promise<Vehicle[]>;
  findBySlug(slug: string): Promise<Vehicle | null>;
  syncFromMercadoLibre(itemId: string): Promise<void>;
};
