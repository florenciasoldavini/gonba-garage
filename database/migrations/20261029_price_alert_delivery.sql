-- Durable price-alert processing. No vehicle catalog is stored.
ALTER TABLE public.vehicle_price_alerts ADD COLUMN IF NOT EXISTS publication_id text;
ALTER TABLE public.vehicle_price_alerts ADD COLUMN IF NOT EXISTS generation uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.vehicle_price_alerts ADD COLUMN IF NOT EXISTS vehicle_title text NOT NULL DEFAULT '';
ALTER TABLE public.vehicle_price_alerts ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;
UPDATE public.vehicle_price_alerts SET publication_id = upper(substring(vehicle_slug from '(mla[0-9]+)$'))
  WHERE publication_id IS NULL AND vehicle_slug ~ 'mla[0-9]+$';
-- Keep the existing unique slug key for compatibility. New live subscriptions use this key.
CREATE UNIQUE INDEX IF NOT EXISTS price_alert_publication_email_unique
  ON public.vehicle_price_alerts (publication_id, email) WHERE publication_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.price_alert_item_jobs (
  publication_id text PRIMARY KEY CHECK (publication_id ~ '^MLA[0-9]+$'),
  revision bigint NOT NULL DEFAULT 1,
  processed_revision bigint NOT NULL DEFAULT 0,
  lease_id uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.price_alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.vehicle_price_alerts(id),
  generation uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('welcome', 'drop')),
  price numeric(12,2) NOT NULL,
  previous_price numeric(12,2) NOT NULL,
  currency text NOT NULL CHECK (currency IN ('ARS','USD')),
  title text NOT NULL,
  vehicle_slug text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','accepted','cancelled','failed','blocked')),
  lease_id uuid,
  lease_until timestamptz,
  first_attempt_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_id text,
  request_payload jsonb,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS price_alert_delivery_unique
  ON public.price_alert_deliveries (alert_id, generation, kind, price) WHERE state <> 'cancelled';
CREATE UNIQUE INDEX IF NOT EXISTS price_alert_one_pending_drop
  ON public.price_alert_deliveries (alert_id, generation)
  WHERE kind = 'drop' AND state IN ('pending','sending','blocked');
CREATE INDEX IF NOT EXISTS price_alert_pending_delivery_idx
  ON public.price_alert_deliveries(next_attempt_at) WHERE state IN ('pending','sending');
REVOKE ALL ON public.price_alert_item_jobs, public.price_alert_deliveries FROM PUBLIC;
CREATE TABLE IF NOT EXISTS public.price_alert_signup_windows (
  key text PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 1
);
REVOKE ALL ON public.price_alert_signup_windows FROM PUBLIC;
