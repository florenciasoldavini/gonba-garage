-- Double opt-in for both alert types. New signups start as 'pending' and only an emailed,
-- signed confirmation link makes them 'active'. Every delivery query selects status = 'active',
-- so pending rows never receive alerts. Existing rows keep their status: subscriptions created
-- before this migration are grandfathered as confirmed, with confirmed_at left NULL because no
-- confirmation was recorded for them. Status defaults stay 'active': the application always sets
-- 'pending' explicitly, and code deployed before this change must keep working against the new
-- schema. Apply this migration first, then deploy. Plain rerunnable DDL, without embedded semicolons.
ALTER TABLE public.vehicle_price_alerts DROP CONSTRAINT IF EXISTS vehicle_price_alerts_status_check;
ALTER TABLE public.vehicle_price_alerts ADD CONSTRAINT vehicle_price_alerts_status_check
  CHECK (status IN ('pending', 'active', 'notified', 'cancelled'));
ALTER TABLE public.vehicle_price_alerts ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE public.vehicle_inventory_alerts DROP CONSTRAINT IF EXISTS vehicle_inventory_alerts_status_check;
ALTER TABLE public.vehicle_inventory_alerts ADD CONSTRAINT vehicle_inventory_alerts_status_check
  CHECK (status IN ('pending', 'active', 'cancelled'));
ALTER TABLE public.vehicle_inventory_alerts ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
-- Scopes confirmation links, as price alerts already do for cancellation links.
ALTER TABLE public.vehicle_inventory_alerts ADD COLUMN IF NOT EXISTS generation uuid NOT NULL DEFAULT gen_random_uuid();
-- price_alert_signup_windows now holds every alert rate-limit bucket. Expired windows are pruned.
CREATE INDEX IF NOT EXISTS price_alert_signup_windows_started_idx
  ON public.price_alert_signup_windows (started_at);
