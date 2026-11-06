-- Owner notifications about the Mercado Libre integration (docs/mercado-libre-connection-diagnostics.md,
-- "Owner notifications"). Plain rerunnable DDL, without embedded semicolons.

-- One row per health check, holding its current or latest incident. An incident is emailed when it
-- opens, again only as a reminder while it stays open, and once more when it resolves. A check
-- that fails again after resolving opens a new incident (a new incident_id).
-- `details` holds only fixed reason codes, counts, timestamps and allowlisted failure codes: never
-- tokens, provider messages or payloads.
CREATE TABLE IF NOT EXISTS public.integration_alerts (
  check_name text PRIMARY KEY CHECK (check_name IN ('credential', 'catalog_sync', 'sync_queue')),
  incident_id uuid NOT NULL,
  details jsonb NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  -- Emails accepted for this incident while open (the opening one, then reminders). Also part of
  -- the provider idempotency key, so a retried send can never become a second copy.
  notifications integer NOT NULL DEFAULT 0,
  notified_at timestamptz,
  resolution_notified_at timestamptz
);

REVOKE ALL ON public.integration_alerts FROM PUBLIC;
