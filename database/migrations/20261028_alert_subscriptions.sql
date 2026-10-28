-- Standalone PostgreSQL: no Supabase roles, extensions or auth schema required.
-- Rerunnable on the new empty Neon database. The application connects server-side.
CREATE TABLE IF NOT EXISTS public.vehicle_price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_slug text NOT NULL CHECK (char_length(vehicle_slug) BETWEEN 1 AND 160),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 320 AND email = lower(email)),
  current_price numeric(12, 2) NOT NULL CHECK (current_price >= 0),
  currency text NOT NULL CHECK (currency IN ('USD', 'ARS')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'notified', 'cancelled')),
  source text NOT NULL DEFAULT 'website' CHECK (source IN ('website', 'mercado_libre')),
  last_notified_price numeric(12, 2) CHECK (last_notified_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_slug, email)
);

CREATE INDEX IF NOT EXISTS vehicle_price_alerts_active_vehicle_idx
  ON public.vehicle_price_alerts (vehicle_slug) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.vehicle_inventory_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 320 AND email = lower(email)),
  search_query text NOT NULL DEFAULT '' CHECK (char_length(search_query) <= 120),
  make text NOT NULL DEFAULT '' CHECK (char_length(make) <= 80),
  transmission text NOT NULL DEFAULT '' CHECK (transmission IN ('', 'automatic', 'manual')),
  body_type text NOT NULL DEFAULT '' CHECK (char_length(body_type) <= 80),
  fuel text NOT NULL DEFAULT '' CHECK (char_length(fuel) <= 80),
  -- Match the catalog: limits are USD, converted for comparisons using MEP venta.
  min_price numeric(12, 2) NOT NULL DEFAULT 0 CHECK (min_price >= 0),
  max_price numeric(12, 2) NOT NULL DEFAULT 0 CHECK (max_price = 0 OR max_price >= min_price),
  min_mileage integer NOT NULL DEFAULT 0 CHECK (min_mileage >= 0),
  max_mileage integer NOT NULL DEFAULT 0 CHECK (max_mileage = 0 OR max_mileage >= min_mileage),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  source text NOT NULL DEFAULT 'website' CHECK (source IN ('website', 'mercado_libre')),
  last_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, search_query, make, transmission, body_type, fuel,
    min_price, max_price, min_mileage, max_mileage)
);

CREATE INDEX IF NOT EXISTS vehicle_inventory_alerts_active_idx
  ON public.vehicle_inventory_alerts (created_at) WHERE status = 'active';

REVOKE ALL ON public.vehicle_price_alerts FROM PUBLIC;
REVOKE ALL ON public.vehicle_inventory_alerts FROM PUBLIC;
