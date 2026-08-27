import type { DatabaseId, DateTimeString, TableInsert, TableUpdate } from './shared';

export type ValuationLeadPhotoRow = {
  id: DatabaseId;
  valuation_lead_id: DatabaseId;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  position: number;
  created_at: DateTimeString;
};

export type ValuationLeadPhotoInsert = TableInsert<
  ValuationLeadPhotoRow,
  'id' | 'position' | 'created_at'
>;

export type ValuationLeadPhotoUpdate = TableUpdate<
  ValuationLeadPhotoRow,
  'id' | 'valuation_lead_id' | 'created_at'
>;

export type ValuationLeadPhotoTable = {
  Row: ValuationLeadPhotoRow;
  Insert: ValuationLeadPhotoInsert;
  Update: ValuationLeadPhotoUpdate;
};
