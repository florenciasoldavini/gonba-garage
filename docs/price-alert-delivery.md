# Recurring price-drop emails

## Scope and behavior

This flow sends **price-drop alerts only**. Inventory-search alerts still have storage only,
and their email delivery remains separate work. No catalog, photos or vehicle history are stored.
The subscription stores the stable Mercado Libre publication ID, display slug/title, original
price/currency and the last price accepted for delivery. Existing live slugs are backfilled to IDs.

Creating an alert stores it as `pending` and sends a confirmation email (double opt-in). Pending
alerts are never watched and receive no price emails. The link opens `/api/alerts/confirm`. Its
GET changes nothing, but in a browser the page immediately posts itself, so after one click the
person lands on `/alertas/confirmacion` ("Te avisaremos si baja.", with a link back to the vehicle). Link scanners that only fetch the URL never send that POST.
The POST activates the alert and queues the activation email with a cancellation link, exactly
once even if confirmed repeatedly. Links expire after 72 hours.
Repeated signups for an active alert preserve the baseline and send nothing. Repeated signups for a
pending alert refresh its price reference and may resend the confirmation (see limits below).
Cancellation followed by a new signup gets a new generation, needs a new confirmation, and starts a
new price reference. A cancellation or confirmation link from an old generation cannot affect the
new alert. Alerts that existed before double opt-in are grandfathered as confirmed.
The live price-alert UI is shown only when `PRICE_ALERT_DELIVERY_ENABLED=true` on the frontend.

Drops are compared in the **same original currency**, in nominal amounts, with the last notified
price (or the initial price before any drop). USD 20,000 → 19,000 → 18,500 produces two emails.
A rebound to 19,500 followed by 19,000 produces none. A currency switch is not treated as a drop
and needs review rather than silently applying an exchange rate. Inactive publications send no
new price email. Reopened publications with the same ID can be followed again. A new listing ID
is a different alert even if it represents the same car.

## Notification processing

Subscribe the Mercado Libre app to `items` and, when available for the account, `items_prices`.
Keep the existing HTTPS callback `/api/mercado-libre/webhook`. Confirm a real change to one of
Gonba's subscribed publications is delivered after deploying. No seller listing is edited by tests.

The callback validates the seller, application, topic and resource shape, then coalesces work in
`price_alert_item_jobs` **before** acknowledging it. Only subscribed IDs create jobs. Persistence
failure returns 503 so Mercado Libre can retry. It aims for the provider's <500 ms acknowledgment
requirement, but database cold starts can exceed that and must be measured during activation.
The notification is not trusted as proof of price or ownership. The worker reads the actual API
resource, verifies seller ownership, and reads its price, currency and active state.

`after()` starts bounded background processing without waiting to send emails in the HTTP response.
The database job survives an interrupted function. Revisions preserve notifications arriving during
processing. Expiring leases allow another worker to recover after interruption. Transient retries within the function budget use bounded waits. Remaining pending work is
retried by subsequent notifications, signups, or the daily invocation. This is best-effort prompt
processing, not a guaranteed instantaneous or sub-minute retry service.

`vercel.json` schedules `/api/alerts/daily` daily at 12:00 UTC (09:00 Argentina). Vercel may run it
within the schedule window on Hobby. It requires `Authorization: Bearer <CRON_SECRET>`, queues
all active subscribed IDs and drains pending jobs/emails. The worker is bounded to 200 seconds,
50 item jobs and up to 150 deliveries per invocation. Monitor backlog before increasing volume.
No fake sold/cancelled status is inferred from a network or API failure.

## Reliable sending and cancellation

`price_alert_deliveries` is a durable outbox. Unique keys, one pending drop per alert generation,
and leased claims prevent duplicate parallel processing. Each provider request is frozen before
sending and uses a stable Resend idempotency key. Transient provider/network failures retain work
with exponential eligibility delay. Permanent HTTP failures are marked `failed`, without logging
addresses, tokens, raw responses or payloads. Provider acceptance plus price-reference update are
recorded atomically in PostgreSQL. Acceptance is not proof of inbox delivery.

Every email carries the GG logo as an inline attachment referenced with `cid:` (about 2 KB,
`lib/alerts/email-logo.ts`, generated from `public/brand/gonba-garage-email-logo.png`). Emails load
nothing from the site, and the logo is part of the frozen request. Resend's batch endpoint does not
accept attachments, so keep sending one email per request.

If acceptance was ambiguous, the same request can be retried within 23 hours. After that it becomes
`blocked` for manual reconciliation against the provider, because Resend's idempotency lasts 24h.
Do not reset that state or create a fresh key without checking whether the original mail was sent.
A blocked drop blocks later drops for that subscription until reviewed. No exactly-once guarantee
is claimed across an unbounded provider outage. Already accepted emails are never automatically resent.
An unsent drop is rechecked against the current listing before first sending to avoid mailing an
inactive or no-longer-available price. Once a request might have been accepted, retry bytes remain fixed.

Cancellation URLs contain signed subscription/generation IDs, never an email. GET is read-only and
shows a confirmation form so scanners cannot unsubscribe users. POST performs cancellation; this
also supports the RFC 8058 one-click headers. It needs no account. A send already in progress may
finish during cancellation.

Both signup endpoints (price and inventory) have shared, fixed-window limits with separate keys
per endpoint: 20/hour per client IP (first `X-Forwarded-For` hop or `X-Real-IP`; IPv6 grouped by
/64), 5/hour per address and 100/hour in total. Confirmation emails are capped at one per
subscription every 10 minutes and five per recipient per day across both endpoints; a suppressed
send still returns the same success response. IPs and addresses are HMAC'd with
`ALERTS_SIGNING_SECRET` and never stored raw. Limits also apply in demo mode whenever the database
is configured; without a signing secret (demo only) only the total bucket applies. The existing
honeypot stays in place.
Resend applies provider-level suppression of hard bounces/complaints. A full local delivery-events
history or operator email alerts are not included in this PR.

## Activation after PR review

1. Apply `npm run db:migrate` to the development branch, test, and then production. It applies all
   migrations and is rerunnable. The new tables and columns are not applied to production by this PR.
   Apply the signup-confirmation migration **before** deploying the code that uses it: the new code
   writes `pending`, which the old schema rejects. The migration keeps status defaults unchanged,
   so code that is already deployed keeps working against the migrated schema.
2. Verify a Gonba sending domain in Resend, including its sending DNS records. Do not use a domain
   belonging to a different project. Create a sending-only API key for the verified domain.
3. Set server-only variables on the backend:
   - `RESEND_API_KEY`
   - `ALERTS_EMAIL_FROM` (e.g. `Gonba's Garage <avisos@your-verified-domain>`)
   - `ALERTS_PUBLIC_URL` (fixed HTTPS origin serving the vehicle pages, confirmation and cancellation endpoints)
   - `ALERTS_SIGNING_SECRET` (at least 32 random characters, keep stable)
   - `CRON_SECRET` (at least 32 random characters)
   - existing database and Mercado Libre credentials, seller ID and client ID
   - `PRICE_ALERT_DELIVERY_ENABLED=true` only after configuration and migration
4. Use `ALERTS_TEST_RECIPIENT` in preview/local runs to permit only an explicit test address.
   Other recipients are **blocked**, never redirected to that address. Leave it empty for real sending.
   Keep previews disabled by default and never point a preview worker at production subscriptions.
5. Configure the same enable flag on the public frontend. It uses its local database for signup
   storage, so the worker and signup route must use the same intended database/environment. A frontend
   in live mode can use the deployed catalog backend as before. Alert activation on the backend
   resolves the real publication directly, even if that deployment's public frontend is in demo mode.
6. Test a signup, confirmation mail and link, activation mail, cancellation, repeated price reductions with synthetic observations
   against development, provider acceptance, then an authenticated daily invocation. Do not edit
   Mercado Libre prices or expose the cron secret in a URL. Inspect the pending/failed/blocked counts.
7. Verify actual `items` notification delivery and acknowledgment latency on the production callback.

The connected Resend account had no Gonba domain when this was prepared. Two explicitly labeled
sample emails were sent with the Resend test sender to the user-authorized test address. They use
illustrative prices and non-functional preview cancellation links, not real subscriptions.

## Verification

`npm run test:price-alert-delivery` applies the schema twice to real local PostgreSQL (PGlite),
exercises recurring price baselines, parallel claims, immutable retries, provider acceptance followed
by DB failure, expired idempotency windows, signed cancellation generations, HTML escaping, notification
persistence and cron authorization. It never calls real Mercado Libre or sends email.

`npm run test:alerts`, `npm run test:integration`, lint, type checking and the metadata contract remain
part of the regression checks. Private alert endpoints are no-store/noindex in both indexing modes.
