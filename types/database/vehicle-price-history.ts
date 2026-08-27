import type {
  DatabaseId,
  DateTimeString,
  TableInsert,
  TableUpdate,
  VehicleCurrency,
} from './shared';

export type VehiclePriceSource = 'manual' | 'mercado_libre' | 'import';

export type VehiclePriceHistoryRow = {
  id: DatabaseId;
  vehicle_id: DatabaseId;
  price: number;
  currency: VehicleCurrency;
  source: VehiclePriceSource;
  recorded_at: DateTimeString;
};

export type VehiclePriceHistoryInsert = TableInsert<
  VehiclePriceHistoryRow,
  'id' | 'source' | 'recorded_at'
>;

export type VehiclePriceHistoryUpdate = TableUpdate<
  VehiclePriceHistoryRow,
  'id' | 'vehicle_id' | 'recorded_at'
>;

export type VehiclePriceHistoryTable = {
  Row: VehiclePriceHistoryRow;
  Insert: VehiclePriceHistoryInsert;
  Update: VehiclePriceHistoryUpdate;
};
