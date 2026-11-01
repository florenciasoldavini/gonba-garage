# Alert emails: price drops and search alerts

Price-drop alerts are described first. Search alerts (new and released cars) reuse the same
signup, confirmation, outbox and cancellation design and are described in
[Search alerts](#search-alerts).

## Scope and behavior

The price flow stores no catalog, photos or vehicle history of its own.
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
There is no on/off switch for alerts. Price and search alerts are offered, confirmed and delivered
wherever the alert email configuration is complete: `DATABASE_URL`, `RESEND_API_KEY`,
`ALERTS_EMAIL_FROM`, `ALERTS_PUBLIC_URL` and `ALERTS_SIGNING_SECRET` (`alertEmailsConfigured()` in
`lib/alerts/config.ts`). Production has it, so alerts are always on there. Previews and local runs
normally do not, so they show no alert and never email real people. The site therefore never says an
email was sent when it cannot send one. To stop all alert email in an emergency, remove
`RESEND_API_KEY` and redeploy: the site stops offering alerts by itself.
The success message says the link is sent "if the alert is new", because the response is the same for
an alert that is already active (no email) and must not reveal which case applied.

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

## Search alerts

Search alerts (`vehicle_inventory_alerts`) are created from the catalog (toolbar or empty results)
and from reserved or sold vehicle pages. They use the same double opt-in and signup limits as price
alerts, with confirmation emails sent only where alert emails are configured. Delivery
runs in three durable steps (`lib/alerts/inventory-delivery.ts`, migration
`20261101_inventory_alert_delivery.sql`).

1. **Availability events.** When the catalog sync saves an item that becomes active (a new listing,
   or a paused, closed or sold one turning active), the same SQL statement that saves the row inserts
   an `inventory_alert_events` row (`lib/catalog/store.ts`). The transition can therefore never be
   lost between the save and the alert work, and a webhook and the reconciliation reading the same
   item cannot both record it, because the second read sees the row already active. A listing first
   seen more than seven days after it was published (a backfill or a fresh database) is old stock and
   records nothing. Re-reads, price changes and edits of an available car record nothing.
2. **Matching.** Each event is leased and compared with every active alert using the catalog's own
   predicate (`features/vehicles/domain/inventory-search.ts`, also used by the catalog filters): the
   query text is a case-insensitive substring of make, model, version and year; make, transmission
   (automatic or manual), body type and fuel match exactly as the filter selects do; mileage and
   price bounds are inclusive, and stored zeros mean no bound. Price bounds are USD comparison amounts,
   so an ARS listing is converted with the MEP quote, as in the catalog. If a quote is needed and
   unavailable the event is retried with backoff instead of guessing. Only alerts confirmed before the
   car became available are matched, and the car must still be active when the event is processed.
   The reserved-car alert ("Avisame si se libera") saves the car's make and model, so it fires when
   that car comes back and when the same model is listed again (PR #48); the sold-car alert saves make
   and body type. Each match is a row in `inventory_alert_matches`, keyed by alert, generation and
   publication: a car is announced to an alert generation **once**, even if it is reserved and
   released again later. Events not matched within 72 hours (for example on a deployment without the email configuration)
   expire instead of mailing a backlog.
3. **Batching and sending.** Unsent matches of an alert are grouped into one `inventory_alert_deliveries`
   row. An alert has at most one open email, and at most one email per 12 hours: matches found during
   the cooldown wait and go out together. One email describes up to six cars and counts the rest
   ("Y 2 más en el inventario") with a link to the catalog. Right before the first send, cars that are
   no longer active are dropped from the email and their match is deleted, so a car that was reserved
   before its email went out is announced if it comes back. If nothing is left, the email is cancelled.
   Each run handles at most 100 events and 100 emails within its time budget.

Search emails contain only seller-verified listing data (title, kilometers, transmission, fuel,
original price and a link to the vehicle page). The saved criteria are free text typed by whoever
submitted the form, so they are never echoed in an email.

The work runs after the catalog sync in the webhook (`after()`, in the same function, so matching sees
what was just saved), after the 09:00 UTC reconciliation in `/api/mercado-libre/sync`, and in the
12:00 UTC `/api/alerts/daily` cron, side by side with price work. Unlike the price worker it never
waits inside a function for a retry: work in backoff is picked up by the next run.

### Reliable sending without silencing an alert

The outbox keeps the price-alert guarantees: leased claims, a unique open email per alert generation,
request bytes frozen before the first send, a stable Resend idempotency key per attempt series
(`gonba-search-<delivery>-<series>`), acceptance recorded in the same transaction as
`last_notified_at`, and unknown or database failures that keep the lease so the retry reuses the key.

It avoids the price flow's weakness, where one provider outage longer than 23 hours blocks a drop
and every later drop of that subscription. Each send attempt is classified (`EmailFailure.ambiguous`
in `lib/alerts/email.ts`):

- **Possibly accepted**: a timeout or dropped connection, a 5xx, a 409 (same key in flight), an
  invalid response, or a crash after the request. The row is marked `uncertain` *before* every send,
  so a crash leaves it set.
- **Definitely rejected**: a 429, another 4xx, or a connection that never reached the provider
  (DNS failure, refused). Only these restore the previous certainty.

When an attempt series is older than 23 hours:

- if it is `uncertain`, the email becomes `expired` (`ambiguous_send_window_expired`) and is never
  resent, because the provider no longer deduplicates its key. Its cars are not announced again, to
  avoid a possible duplicate. Later matches of the same alert still get new emails: `expired` never
  blocks the alert, it only counts toward the cooldown;
- otherwise nothing of that series can have been sent, so a new series starts with a new key and
  rebuilt content (cars sold meanwhile are dropped).

Permanent rejections mark that email `failed` without blocking later ones. An email that could not
be sent within seven days, with nothing possibly accepted, expires as `stale`.

### Cancellation and entry points

Every search email has a "Cancelar alerta" link and `List-Unsubscribe` / `List-Unsubscribe-Post:
List-Unsubscribe=One-Click` headers pointing at `/api/inventory-alerts/cancel`. The token is
`search.<id>.<generation>.<signature>` and is signed as `cancel.search.<id>.<generation>`, so it never
verifies as a price cancellation or a confirmation, and vice versa. It contains no email. As for price
alerts, GET only shows a confirmation form and POST cancels, which also serves RFC 8058 one-click
requests. Cancelling drops unsent emails. Signing up again starts a new generation that old links
cannot cancel.

Where alert emails are not configured (previews, local runs), the site offers no alert: the
catalog toolbar and empty state have no alert button, active vehicles have no price alert, reserved
and sold vehicle pages point to WhatsApp instead of an email alert, and a search confirmation link
says that search emails are not being sent. The signup endpoints still store a pending row for direct
API calls but send nothing. The webhook and crons do no alert work, and the sync keeps recording
availability events, which expire after 72 hours.

## Activation after PR review

1. Apply `npm run db:migrate` to the development branch, test, and then production. It applies all
   migrations and is rerunnable. The new tables and columns are not applied to production by this PR.
   Apply the search-alert delivery migration (`20261101`) **before** deploying the code that uses
   it: the catalog sync always records availability events, and its saves fail
   without the new table. The migration only adds tables, so already deployed code is unaffected.
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
   As soon as a deployment has all of these, it offers and sends price and search alerts.
4. Use `ALERTS_TEST_RECIPIENT` in preview/local runs to permit only an explicit test address.
   Other recipients are **blocked**, never redirected to that address. **Remove it from production**
   for real sending: while it is set there, every confirmation and alert to a real person fails.
   Keep the email configuration off previews by default and never point a preview worker at
   production subscriptions.
5. The catalog page reads the configuration at build time, so redeploy after changing it. The frontend uses its local database for signup
   storage, so the worker and signup route must use the same intended database/environment. A frontend
   in live mode can use the deployed catalog backend as before. Alert activation on the backend
   resolves the real publication directly, even if that deployment's public frontend is in demo mode.
6. Test a signup, confirmation mail and link, activation mail, cancellation, repeated price reductions with synthetic observations
   against development, provider acceptance, then an authenticated daily invocation. Do not edit
   Mercado Libre prices or expose the cron secret in a URL. Inspect the pending/failed/blocked counts.
7. Verify actual `items` notification delivery and acknowledgment latency on the production callback.
8. For search alerts, with `ALERTS_TEST_RECIPIENT` set on development: create and confirm a search
   alert for that address, sync a matching item (or insert a synthetic `inventory_alert_events` row
   for an active development publication), run an authenticated `/api/alerts/daily`, check the email
   and its cancellation link, and inspect `inventory_alert_deliveries` for `failed`/`expired` rows.

The connected Resend account had no Gonba domain when this was prepared. Two explicitly labeled
sample emails were sent with the Resend test sender to the user-authorized test address. They use
illustrative prices and non-functional preview cancellation links, not real subscriptions.

## Verification

`npm run test:price-alert-delivery` applies the schema twice to real local PostgreSQL (PGlite),
exercises recurring price baselines, parallel claims, immutable retries, provider acceptance followed
by DB failure, expired idempotency windows, signed cancellation generations, HTML escaping, notification
persistence and cron authorization. It never calls real Mercado Libre or sends email.

`npm run test:inventory-alert-delivery` applies every migration twice to PGlite and drives the real
catalog sync, webhook, crons, matcher, outbox and routes against fake Mercado Libre, MEP and Resend
endpoints: the shared search predicate, reserved-car release and the same model, cooldown batching,
the six-car cap, MEP conversion and missing quotes, once-per-car deduplication under concurrent
workers, frozen idempotent retries, acceptance followed by a database failure, an ambiguous outage
past the idempotency window (expired, alert still working), key rotation after definite rejections,
permanent failures, backlog expiry, scoped cancellation with one-click POST, and signup and worker
gating. `npm run test:integration` checks that the sync records each availability transition once.

`npm run test:alerts`, `npm run test:integration`, lint, type checking and the metadata contract remain
part of the regression checks. Private alert endpoints are no-store/noindex in both indexing modes.
Run the metadata contract with the same alert email configuration as the server (with and without
it): it checks that each alert is offered only
while its emails are sent.
