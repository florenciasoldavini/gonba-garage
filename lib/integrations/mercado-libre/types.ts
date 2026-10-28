export type MercadoLibreValueStruct = {
  number?: number | string | null;
  unit?: string | null;
};

export type MercadoLibreAttributeValue = {
  id?: string | null;
  name?: string | null;
  struct?: MercadoLibreValueStruct | null;
};

export type MercadoLibreAttribute = {
  id: string;
  name: string;
  value_id?: string | null;
  value_name?: string | null;
  value_struct?: MercadoLibreValueStruct | null;
  values?: MercadoLibreAttributeValue[];
  attribute_group_id?: string | null;
  attribute_group_name?: string | null;
  value_type?: string | null;
};

export type MercadoLibrePicture = {
  id?: string;
  url?: string;
  secure_url?: string;
  size?: string;
  max_size?: string;
  quality?: string;
};

export type MercadoLibreLocationPart = {
  id?: string | null;
  name?: string | null;
};

export type MercadoLibreSellerAddress = {
  city?: MercadoLibreLocationPart;
  state?: MercadoLibreLocationPart;
  country?: MercadoLibreLocationPart;
  search_location?: {
    city?: MercadoLibreLocationPart;
    state?: MercadoLibreLocationPart;
  };
};

/**
 * Complete item payload returned by Mercado Libre.
 *
 * The intersection with Record<string, unknown> is intentional: Mercado Libre can
 * add domain-specific fields without making us discard them. Known fields remain
 * typed for the UI adapter while the original payload stays complete in memory.
 */
export type MercadoLibreItem = Record<string, unknown> & {
  id: string;
  site_id?: string;
  title: string;
  subtitle?: string | null;
  seller_id?: number;
  category_id?: string;
  user_product_id?: string | null;
  catalog_product_id?: string | null;
  domain_id?: string | null;
  official_store_id?: number | null;
  price?: number;
  base_price?: number;
  original_price?: number | null;
  currency_id?: string;
  initial_quantity?: number;
  available_quantity?: number;
  sold_quantity?: number;
  condition?: string;
  permalink?: string;
  thumbnail?: string;
  secure_thumbnail?: string;
  pictures?: MercadoLibrePicture[];
  video_id?: string | null;
  listing_type_id?: string;
  buying_mode?: string;
  start_time?: string;
  stop_time?: string;
  end_time?: string;
  expiration_time?: string;
  date_created?: string;
  last_updated?: string;
  status?: string;
  sub_status?: string[];
  tags?: string[];
  warranty?: string | null;
  seller_custom_field?: string | null;
  attributes?: MercadoLibreAttribute[];
  sale_terms?: MercadoLibreAttribute[];
  seller_address?: MercadoLibreSellerAddress;
  shipping?: Record<string, unknown>;
};

export type MercadoLibreDescription = Record<string, unknown> & {
  text?: string;
  plain_text?: string;
  date_created?: string;
  last_updated?: string;
};

export type MercadoLibreBulkItem = {
  id?: string;
  status_code: number;
  body: MercadoLibreItem;
};

export type MercadoLibrePublication = {
  /** Normalized fields used by the Gonba Garage UI. */
  vehicle: import('@/features/vehicles/domain/vehicle').Vehicle;
  /** Untouched item payload so no Mercado Libre field is lost. */
  source: MercadoLibreItem;
  /** Loaded on demand for a vehicle detail page. */
  description: MercadoLibreDescription | null;
};
