import type { DatabaseId, DateTimeString, TableInsert, TableUpdate } from './shared';

export type ValuationVehicleCondition =
  | 'excellent'
  | 'very_good'
  | 'good'
  | 'needs_repairs';

export type ValuationLeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'inspection_scheduled'
  | 'offer_made'
  | 'won'
  | 'lost'
  | 'spam';

export type ValuationLeadSource = 'website' | 'manual' | 'referral';

export type ValuationLeadRow = {
  id: DatabaseId;
  catalog_brand_id: string | null;
  catalog_model_id: string | null;
  catalog_version_id: string | null;
  make: string;
  model: string;
  version: string | null;
  year: number;
  color: string | null;
  mileage_km: number;
  condition: ValuationVehicleCondition;
  condition_notes: string | null;
  contact_name: string;
  contact_phone: string;
  consent_version: string;
  consented_at: DateTimeString;
  status: ValuationLeadStatus;
  source: ValuationLeadSource;
  last_contacted_at: DateTimeString | null;
  created_at: DateTimeString;
  updated_at: DateTimeString;
};

export type ValuationLeadInsert = TableInsert<
  ValuationLeadRow,
  | 'id'
  | 'catalog_brand_id'
  | 'catalog_model_id'
  | 'catalog_version_id'
  | 'version'
  | 'color'
  | 'condition_notes'
  | 'status'
  | 'source'
  | 'last_contacted_at'
  | 'created_at'
  | 'updated_at'
>;

export type ValuationLeadUpdate = TableUpdate<
  ValuationLeadRow,
  'id' | 'consent_version' | 'consented_at' | 'created_at'
>;

export type ValuationLeadTable = {
  Row: ValuationLeadRow;
  Insert: ValuationLeadInsert;
  Update: ValuationLeadUpdate;
};
