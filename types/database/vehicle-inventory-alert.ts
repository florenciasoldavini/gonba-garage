import type { DatabaseId, DateTimeString, TableInsert, TableUpdate } from './shared';

export type VehicleInventoryAlertStatus = 'active' | 'cancelled';
export type VehicleInventoryAlertSource = 'website' | 'mercado_libre';

export type VehicleInventoryAlertRow = {
  id: DatabaseId;
  email: string;
  search_query: string;
  make: string;
  transmission: '' | 'automatic' | 'manual';
  body_type: string;
  fuel: string;
  min_price: number;
  max_price: number;
  min_mileage: number;
  max_mileage: number;
  status: VehicleInventoryAlertStatus;
  source: VehicleInventoryAlertSource;
  last_notified_at: DateTimeString | null;
  created_at: DateTimeString;
  updated_at: DateTimeString;
};

export type VehicleInventoryAlertInsert = TableInsert<
  VehicleInventoryAlertRow,
  | 'id'
  | 'search_query'
  | 'make'
  | 'transmission'
  | 'body_type'
  | 'fuel'
  | 'min_price'
  | 'max_price'
  | 'min_mileage'
  | 'max_mileage'
  | 'status'
  | 'source'
  | 'last_notified_at'
  | 'created_at'
  | 'updated_at'
>;

export type VehicleInventoryAlertUpdate = TableUpdate<
  VehicleInventoryAlertRow,
  'id' | 'email' | 'created_at'
>;

export type VehicleInventoryAlertTable = {
  Row: VehicleInventoryAlertRow;
  Insert: VehicleInventoryAlertInsert;
  Update: VehicleInventoryAlertUpdate;
};
