# Alert subscriptions on Neon

Neon stores the website's alert subscriptions, the price reference needed for price-drop
alerts and the synced copy of the Mercado Libre catalog (see `docs/architecture.md`). It is the
project's only database.

## Environments

Use a dedicated personal Neon project, separate from any work organization. Keep the
project and branch identifiers in the hosting configuration, outside the repository.
Production and development must use separate branches and connection strings.

## Connection and migration

Set `DATABASE_URL` to the appropriate pooled Neon connection string with SSL enabled:

- Vercel Production uses the `production` branch.
- Local `.env.local` and Vercel Development/Preview use `development`.
- On Vercel, store Production and Preview values as secrets; never use a `NEXT_PUBLIC_` prefix.
- Do not include connection strings in commits, logs, screenshots or PR descriptions.

With the target `DATABASE_URL` set, run `npm run db:migrate`. The script loads `.env.local`
when present, but preserves an already set environment variable. It connects to the direct
(non-pooled) endpoint of the same branch and prints the host it uses. Apply to both branches; schema
changes on production do not automatically propagate to an existing development branch.

## Migrations

`scripts/migration-runner.mjs` is the only migration runner. `npm run db:migrate` uses it against
Neon, and every PGlite test (`test:migrations`, `test:alerts`, `test:integration`,
`test:price-alert-delivery`, `test:inventory-alert-delivery`) uses the same code, so what the tests
apply is what production applies.

- **Discovery.** Every `.sql` file in `database/migrations/`, applied in file-name order. There is
  no list to update.
- **History.** `public.schema_migrations` records each applied file with the SHA-256 of its content,
  when it was applied and whether it was adopted by the baseline. Applied files are skipped. The run
  stops, before applying anything, if an applied file changed, was renamed or deleted, or if a new
  file sorts before the latest applied one (it would run in an order the tests never checked).
- **Transactions.** Each file runs whole, as one batch, in its own transaction together with its
  history row. Nothing splits it into statements, so semicolons in comments, strings and function
  bodies are fine. A failing file is rolled back completely and not recorded; files before it stay
  applied. Concurrent runs wait for each other (advisory lock).
- **Driver.** The script uses the driver's WebSocket `Client` (Node 22's global `WebSocket`), not the
  HTTP `neon()` function: an HTTP query is a single prepared statement and cannot run a multi-statement
  file inside an explicit transaction.
- **Verification.** The history is the verification: there is no table count to keep in step. What
  each migration creates is checked by the PGlite tests, which apply the real files.

`npm run db:migrate -- --status` lists pending migrations without changing anything.

### Adding a migration

1. Create `database/migrations/YYYYMMDD_description.sql` (lowercase, underscores), dated after the
   latest file. Plain SQL; it may contain functions and any number of statements.
2. Do not write `BEGIN`/`COMMIT` (the runner opens the transaction) and avoid statements that cannot
   run in a transaction, such as `CREATE INDEX CONCURRENTLY`.
3. Never edit, rename or delete a migration that has been applied anywhere: the checksum check
   stops every later run. Put the change in a new file. `IF NOT EXISTS` guards are still welcome but
   no longer required, since each file runs once per database.
4. Run the tests above (they pick the file up automatically), then `npm run db:migrate -- --status`
   and `npm run db:migrate` on development, then on production. Apply before deploying code that
   needs the new schema.

### Baseline for databases migrated before the history existed

The earlier runner kept no history and re-executed every file on each run (which, among other
things, turned a validated `catalog_publications_vehicle_category_check` back into `NOT VALID`).
Databases it migrated already contain the first six migrations (`20261028` to `20261102`, listed in
`BASELINE` in the runner). A plain `npm run db:migrate` on such a database refuses to run: it finds
tables without a history. Adopt it once, per branch:

1. `npm run db:migrate -- --baseline --status` shows which migrations would be recorded. Each is
   recorded only if the tables, columns and constraints it creates are present; the earlier runner
   applied every known file at once, so a database holds the first N of them. If one in the middle is
   missing the command stops: inspect the schema by hand.
2. `npm run db:migrate -- --baseline` records them as applied (`baseline = true`) without running
   them. It only works while `schema_migrations` is empty.
3. `npm run db:migrate` applies anything newer (none yet), and from then on every run is the normal
   one.

A new, empty database needs no baseline: `npm run db:migrate` applies every file.

## Tables and behavior

`vehicle_inventory_alerts` stores email, search criteria, status and timestamps. Price limits
are USD comparison amounts, matching the catalog's MEP-based filters. Repeated or concurrent
requests for the same email and criteria update one subscription.

Both tables use double opt-in: new signups are `pending` until the owner confirms the emailed link
at `/api/alerts/confirm`, which sets `active` and `confirmed_at`. Only `active` rows may receive
alerts. Rows that existed before the confirmation migration stay active, with `confirmed_at` empty.
There is no delivery switch: alerts are offered and emailed wherever the alert email configuration
is complete (`alertEmailsConfigured()` in `lib/alerts/config.ts`). Where it is not (local runs and
previews), the site does not offer alerts, and a direct signup request is stored as pending with no
confirmation email. Signup rate limits are
described in `docs/price-alert-delivery.md`.

`vehicle_price_alerts` stores email, vehicle slug, original price/currency, status and
notification reference fields. The server resolves the vehicle using the current catalog,
including Mercado Libre, and accepts only active vehicles. It ignores prices supplied by
the browser. Repeated subscriptions preserve an active alert's price baseline; reactivating
a cancelled subscription establishes a new baseline.

All SQL inputs are parameters. PUBLIC receives no table privileges, and no browser/Data API
access is enabled. Database access stays in server-only modules. Invalid requests are
rejected, a missing connection returns 503, and storage errors return a generic message
without credentials or email data in logs. The existing form honeypot stays in place.

## Verification and remaining work

`npm run test:alerts` tests route behavior and runs the real schema and SQL against local
PostgreSQL (PGlite), including concurrent duplicates, original-price preservation, SQL
injection, constraints and migrating a database created before signup confirmation. It needs no
credentials. `npm run test:migrations` covers the runner itself, including the baseline.

`TEST_LIVE=1 npm run test:alerts` tests the same storage on the selected Neon database and
removes its own uniquely named synthetic test rows afterward. Run locally against development.

Search-alert delivery adds three tables (`20261101_inventory_alert_delivery.sql`):
`inventory_alert_events` (cars that became available, written by the catalog sync),
`inventory_alert_matches` (which car was announced to which alert generation, so none is announced
twice) and `inventory_alert_deliveries` (the email outbox). It only ever selects `active` alerts.
Matches and emails reference their alert with `ON DELETE CASCADE`, so deleting an alert on request
also deletes its email history. Apply this migration before deploying the code: the catalog sync
always writes events. Both deliveries are documented in
`docs/price-alert-delivery.md`.
