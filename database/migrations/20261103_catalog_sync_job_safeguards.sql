-- Safeguards against forged and repeated Mercado Libre notifications. The design is in
-- docs/architecture.md, "Mercado Libre sync".

-- Queued only by a notification from an address outside MERCADO_LIBRE_WEBHOOK_IPS. Such a job is
-- never drained by the webhook, only by the daily cron after every other job. A notification from a
-- listed address, or the reconciliation, clears it.
ALTER TABLE public.catalog_sync_jobs ADD COLUMN deferred boolean NOT NULL DEFAULT false;

-- Set when a read found that an item never stored does not exist or belongs to another seller:
-- notifications for it are ignored until then. Stored items and the reconciliation ignore it.
ALTER TABLE public.catalog_sync_jobs ADD COLUMN skip_until timestamptz;

-- A second single-row lease: one webhook drain of the queue at a time.
ALTER TABLE public.catalog_sync_runs DROP CONSTRAINT catalog_sync_runs_id_check,
  ADD CONSTRAINT catalog_sync_runs_id_check CHECK (id IN ('reconciliation', 'notification_drain'));
