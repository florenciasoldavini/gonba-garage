import type {
  DatabaseId,
  DateTimeString,
  TableInsert,
  TableUpdate,
  VehicleCurrency,
} from './shared';

export type VehiclePriceAlertStatus = 'active' | 'notified' | 'cancelled';
export type VehiclePriceAlertSource = 'website' | 'mercado_libre';

/** Target shape for the existing table once vehicle_slug becomes a foreign key. */
export type VehiclePriceAlertRow = {
  id: DatabaseId;
  vehicle_id: DatabaseId;
  email: string;
  current_price: number;
  currency: VehicleCurrency;
  status: VehiclePriceAlertStatus;
  source: VehiclePriceAlertSource;
  last_notified_price: number | null;
  created_at: DateTimeString;
  updated_at: DateTimeString;
};

export type VehiclePriceAlertInsert = TableInsert<
  VehiclePriceAlertRow,
  'id' | 'status' | 'source' | 'last_notified_price' | 'created_at' | 'updated_at'
>;

export type VehiclePriceAlertUpdate = TableUpdate<
  VehiclePriceAlertRow,
  'id' | 'vehicle_id' | 'email' | 'created_at'
>;

export type VehiclePriceAlertTable = {
  Row: VehiclePriceAlertRow;
  Insert: VehiclePriceAlertInsert;
  Update: VehiclePriceAlertUpdate;
};
