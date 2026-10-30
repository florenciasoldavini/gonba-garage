# Alert subscriptions on Neon

The catalog still reads vehicles, pictures and attributes from Mercado Libre. Neon stores
only the website's alert subscriptions and the price reference needed for price-drop alerts.
The two alert endpoints no longer need a Supabase project.

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
when present, but preserves an already set environment variable. It applies the plain SQL
in `database/migrations/` (subscriptions, price delivery and signup confirmation) in one transaction. It is safe
to rerun on these new databases. For migrations, it resolves the direct (non-pooled)
endpoint of the same branch. Apply to both branches; schema changes on production do
not automatically propagate to an existing development branch.

## Tables and behavior

`vehicle_inventory_alerts` stores email, search criteria, status and timestamps. Price limits
are USD comparison amounts, matching the catalog's MEP-based filters. Repeated or concurrent
requests for the same email and criteria update one subscription.

Both tables use double opt-in: new signups are `pending` until the owner confirms the emailed link
at `/api/alerts/confirm`, which sets `active` and `confirmed_at`. Only `active` rows may receive
alerts. Rows that existed before the confirmation migration stay active, with `confirmed_at` empty.
With email delivery disabled (`PRICE_ALERT_DELIVERY_ENABLED=false`, the demo), signups are stored as
pending and no confirmation email is sent. Signup rate limits are described in
`docs/price-alert-delivery.md`.

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
injection, constraints and repeat migration. It needs no credentials.

`npm run test:alerts -- --live` tests the same storage on the selected Neon database and
removes its own uniquely named synthetic test rows afterward. Run locally against development.

Inventory-search email delivery is still separate work; when it is added it must select only
`active` rows. Price-alert delivery is documented in `docs/price-alert-delivery.md`.
