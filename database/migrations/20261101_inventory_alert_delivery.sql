-- Search-alert delivery (docs/price-alert-delivery.md, "Search alerts"). Plain rerunnable DDL,
-- without embedded semicolons. Apply after 20261031_catalog_sync.sql.

-- "This publication just became available": written by the catalog sync in the same statement that
-- saves the item, when a new listing or a paused (reserved), closed or sold one turns active.
-- previous_status is NULL for a new listing. Matching reads these rows later, under a lease.
CREATE TABLE IF NOT EXISTS public.inventory_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id text NOT NULL REFERENCES public.catalog_publications(publication_id),
  previous_status text CHECK (previous_status IN ('paused', 'closed', 'sold')),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'matched', 'skipped', 'expired')),
  lease_id uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS inventory_alert_events_pending_idx
  ON public.inventory_alert_events (next_attempt_at) WHERE state = 'pending';

-- Durable outbox: one email per row, covering every match batched into it. At most one open
-- (pending or sending) email per alert generation. Ambiguous sends end as 'expired', which never
-- blocks later emails for the same alert.
CREATE TABLE IF NOT EXISTS public.inventory_alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.vehicle_inventory_alerts(id) ON DELETE CASCADE,
  generation uuid NOT NULL,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'sending', 'accepted', 'cancelled', 'failed', 'expired')),
  lease_id uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  -- Part of the provider idempotency key. It only advances when no earlier request of the series
  -- can have been accepted, so a new key can never produce a second copy.
  key_series integer NOT NULL DEFAULT 0,
  series_started_at timestamptz,
  -- Set before every send, cleared only by a definite provider rejection.
  uncertain boolean NOT NULL DEFAULT false,
  request_payload jsonb,
  vehicle_count integer,
  provider_id text,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_alert_one_open_delivery
  ON public.inventory_alert_deliveries (alert_id, generation) WHERE state IN ('pending', 'sending');
CREATE INDEX IF NOT EXISTS inventory_alert_delivery_due_idx
  ON public.inventory_alert_deliveries (next_attempt_at) WHERE state IN ('pending', 'sending');
CREATE INDEX IF NOT EXISTS inventory_alert_delivery_recent_idx
  ON public.inventory_alert_deliveries (alert_id, created_at);

-- One row per car per alert generation, kept after sending: the primary key is what stops the
-- same car from being announced twice to the same alert, even if it is reserved and released again.
CREATE TABLE IF NOT EXISTS public.inventory_alert_matches (
  alert_id uuid NOT NULL REFERENCES public.vehicle_inventory_alerts(id) ON DELETE CASCADE,
  generation uuid NOT NULL,
  publication_id text NOT NULL REFERENCES public.catalog_publications(publication_id),
  previous_status text,
  delivery_id uuid REFERENCES public.inventory_alert_deliveries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alert_id, generation, publication_id)
);

CREATE INDEX IF NOT EXISTS inventory_alert_matches_unbatched_idx
  ON public.inventory_alert_matches (alert_id, generation) WHERE delivery_id IS NULL;
CREATE INDEX IF NOT EXISTS inventory_alert_matches_delivery_idx
  ON public.inventory_alert_matches (delivery_id);

REVOKE ALL ON public.inventory_alert_events, public.inventory_alert_deliveries,
  public.inventory_alert_matches FROM PUBLIC;
