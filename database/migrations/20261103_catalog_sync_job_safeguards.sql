-- Safeguards against forged and repeated Mercado Libre notifications. The design is in
-- docs/architecture.md, "Mercado Libre sync".

-- A second single-row lease: one webhook drain of the queue at a time.
ALTER TABLE public.catalog_sync_runs DROP CONSTRAINT catalog_sync_runs_id_check,
  ADD CONSTRAINT catalog_sync_runs_id_check CHECK (id IN ('reconciliation', 'notification_drain'));
