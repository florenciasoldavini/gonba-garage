-- Only cars, pickups and motorcycles are stored. Each row records the Mercado Libre category that
-- qualified it, and the database rejects any insert or update without one of the vehicle categories
-- in lib/integrations/mercado-libre/vehicle-categories.ts (change both together). Rows saved before
-- this column existed are not checked (NOT VALID) until reconciliation reads them again and fills
-- the category. Plain rerunnable DDL, without embedded semicolons.

ALTER TABLE public.catalog_publications ADD COLUMN IF NOT EXISTS vehicle_category text;

ALTER TABLE public.catalog_publications DROP CONSTRAINT IF EXISTS catalog_publications_vehicle_category_check,
  ADD CONSTRAINT catalog_publications_vehicle_category_check CHECK (vehicle_category IS NOT NULL
    AND vehicle_category IN ('MLA1744', 'MLA459682', 'MLA1745', 'MLA93412', 'MLA1763')) NOT VALID;
