import type { Json } from '@/lib/supabase/generated/database.types';
import type {
  DatabaseId,
  DateTimeString,
  MarketplaceProvider,
  TableInsert,
  TableUpdate,
} from './shared';

export type InventorySyncStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type InventorySyncEventRow = {
  id: DatabaseId;
  provider: MarketplaceProvider;
  external_item_id: string;
  event_type: string;
  resource_url: string | null;
  payload: Json | null;
  status: InventorySyncStatus;
  attempts: number;
  last_error: string | null;
  received_at: DateTimeString;
  processing_started_at: DateTimeString | null;
  processed_at: DateTimeString | null;
  next_attempt_at: DateTimeString | null;
};

export type InventorySyncEventInsert = TableInsert<
  InventorySyncEventRow,
  | 'id'
  | 'resource_url'
  | 'payload'
  | 'status'
  | 'attempts'
  | 'last_error'
  | 'received_at'
  | 'processing_started_at'
  | 'processed_at'
  | 'next_attempt_at'
>;

export type InventorySyncEventUpdate = TableUpdate<
  InventorySyncEventRow,
  'id' | 'provider' | 'external_item_id' | 'received_at'
>;

export type InventorySyncEventTable = {
  Row: InventorySyncEventRow;
  Insert: InventorySyncEventInsert;
  Update: InventorySyncEventUpdate;
};
