-- Safeguards against forged and repeated Mercado Libre notifications. The design is in
-- docs/architecture.md, "Mercado Libre sync".

-- Set when a read found that an item never stored does not exist or belongs to another seller:
-- notifications for it are ignored until then. Stored items and the reconciliation ignore it.
ALTER TABLE public.catalog_sync_jobs ADD COLUMN skip_until timestamptz;

-- A second single-row lease: one webhook drain of the queue at a time.
ALTER TABLE public.catalog_sync_runs DROP CONSTRAINT catalog_sync_runs_id_check,
  ADD CONSTRAINT catalog_sync_runs_id_check CHECK (id IN ('reconciliation', 'notification_drain'));
