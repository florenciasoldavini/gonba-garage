import type { Json } from '@/lib/supabase/generated/database.types';
import type {
  DatabaseId,
  DateTimeString,
  MarketplaceProvider,
  TableInsert,
  TableUpdate,
} from './shared';

export type MarketplaceConnectionStatus = 'active' | 'expired' | 'revoked' | 'error';

/**
 * Intended for a private schema. OAuth tokens belong in a secrets facility;
 * this row stores only the reference needed to retrieve them.
 */
export type MarketplaceConnectionRow = {
  id: DatabaseId;
  provider: MarketplaceProvider;
  external_account_id: string;
  seller_id: string;
  status: MarketplaceConnectionStatus;
  token_secret_reference: string | null;
  access_token_expires_at: DateTimeString | null;
  scopes: string[];
  metadata: Json;
  last_synced_at: DateTimeString | null;
  created_at: DateTimeString;
  updated_at: DateTimeString;
};

export type MarketplaceConnectionInsert = TableInsert<
  MarketplaceConnectionRow,
  | 'id'
  | 'status'
  | 'token_secret_reference'
  | 'access_token_expires_at'
  | 'scopes'
  | 'metadata'
  | 'last_synced_at'
  | 'created_at'
  | 'updated_at'
>;

export type MarketplaceConnectionUpdate = TableUpdate<
  MarketplaceConnectionRow,
  'id' | 'provider' | 'external_account_id' | 'created_at'
>;

export type MarketplaceConnectionTable = {
  Row: MarketplaceConnectionRow;
  Insert: MarketplaceConnectionInsert;
  Update: MarketplaceConnectionUpdate;
};
