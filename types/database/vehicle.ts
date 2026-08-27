import type { VehicleStatus } from '@/features/vehicles/domain/vehicle';
import type {
  DatabaseId,
  DateTimeString,
  TableInsert,
  TableUpdate,
  VehicleCurrency,
} from './shared';

export type VehicleRow = {
  id: DatabaseId;
  slug: string;
  stock_code: string;
  make: string;
  model: string;
  version: string;
  year: number;
  price: number;
  currency: VehicleCurrency;
  mileage_km: number;
  transmission: string;
  fuel: string;
  engine: string;
  color: string;
  body: string;
  traction: string;
  location: string;
  description: string;
  highlights: string[];
  status: VehicleStatus;
  mercado_libre_id: string | null;
  mercado_libre_url: string | null;
  published_at: DateTimeString | null;
  sold_at: DateTimeString | null;
  created_at: DateTimeString;
  updated_at: DateTimeString;
};

export type VehicleInsert = TableInsert<
  VehicleRow,
  | 'id'
  | 'highlights'
  | 'status'
  | 'mercado_libre_id'
  | 'mercado_libre_url'
  | 'published_at'
  | 'sold_at'
  | 'created_at'
  | 'updated_at'
>;

export type VehicleUpdate = TableUpdate<VehicleRow, 'id' | 'created_at'>;

export type VehicleTable = {
  Row: VehicleRow;
  Insert: VehicleInsert;
  Update: VehicleUpdate;
};
