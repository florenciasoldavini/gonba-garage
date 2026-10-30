-- Local copy of the seller's Mercado Libre publications. Mercado Libre stays the source of truth:
-- rows are written only by the sync worker, from seller-checked item reads, and pages read only
-- from here. Plain rerunnable DDL, without embedded semicolons.

-- Public presentation data only (the same fields the vehicle page shows). The slug is assigned
-- once and never rewritten, so a vehicle keeps its URL when the seller edits the listing title.
CREATE TABLE IF NOT EXISTS public.catalog_publications (
  publication_id text PRIMARY KEY CHECK (publication_id ~ '^MLA[0-9]+$'),
  slug text NOT NULL UNIQUE CHECK (char_length(slug) BETWEEN 1 AND 160),
  status text NOT NULL CHECK (status IN ('active', 'paused', 'closed', 'sold')),
  price numeric(14, 2) NOT NULL CHECK (price >= 0),
  currency text NOT NULL CHECK (currency IN ('ARS', 'USD')),
  vehicle jsonb NOT NULL,
  source jsonb NOT NULL,
  description jsonb,
  listed_at timestamptz,
  source_updated_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  content_changed_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  closed_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_publications_active_idx
  ON public.catalog_publications (listed_at DESC) WHERE status = 'active';

-- One row per observed price, including the first. Mercado Libre keeps only the current price.
CREATE TABLE IF NOT EXISTS public.catalog_price_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  publication_id text NOT NULL REFERENCES public.catalog_publications(publication_id),
  price numeric(14, 2) NOT NULL CHECK (price >= 0),
  currency text NOT NULL CHECK (currency IN ('ARS', 'USD')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_price_history_publication_idx
  ON public.catalog_price_history (publication_id, recorded_at);

-- Durable "go check this item" queue fed by webhooks and reconciliation. A notification arriving
-- while an item is processed bumps the revision, so the item is read again afterwards.
CREATE TABLE IF NOT EXISTS public.catalog_sync_jobs (
  publication_id text PRIMARY KEY CHECK (publication_id ~ '^MLA[0-9]+$'),
  revision bigint NOT NULL DEFAULT 1,
  processed_revision bigint NOT NULL DEFAULT 0,
  lease_id uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_sync_jobs_due_idx
  ON public.catalog_sync_jobs (next_attempt_at) WHERE revision > processed_revision;

-- Single-row lease and health record for the scheduled reconciliation.
CREATE TABLE IF NOT EXISTS public.catalog_sync_runs (
  id text PRIMARY KEY CHECK (id = 'reconciliation'),
  lease_id uuid,
  lease_until timestamptz,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_failed_at timestamptz,
  last_failure text,
  last_listed integer
);

REVOKE ALL ON public.catalog_publications, public.catalog_price_history,
  public.catalog_sync_jobs, public.catalog_sync_runs FROM PUBLIC;
