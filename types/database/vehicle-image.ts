import type { DatabaseId, DateTimeString, TableInsert, TableUpdate } from './shared';

export type VehicleImageRow = {
  id: DatabaseId;
  vehicle_id: DatabaseId;
  storage_path: string;
  alt_text: string;
  position: number;
  is_primary: boolean;
  width: number | null;
  height: number | null;
  created_at: DateTimeString;
  updated_at: DateTimeString;
};

export type VehicleImageInsert = TableInsert<
  VehicleImageRow,
  'id' | 'position' | 'is_primary' | 'width' | 'height' | 'created_at' | 'updated_at'
>;

export type VehicleImageUpdate = TableUpdate<
  VehicleImageRow,
  'id' | 'vehicle_id' | 'created_at'
>;

export type VehicleImageTable = {
  Row: VehicleImageRow;
  Insert: VehicleImageInsert;
  Update: VehicleImageUpdate;
};
