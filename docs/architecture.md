# Technical foundation

## Product principle

The site is a sales surface first and an experimental portfolio piece second. Every vehicle,
price, description, and contact action must remain usable without WebGL or client-side animation.

## Stack

- Next.js 16 App Router, React 19 Server Components, and TypeScript.
- Authored CSS with semantic design tokens (`styles/tokens.css`, `app/globals.css`); no CSS
  framework. GSAP is the only animation dependency (see "Motion and 3D strategy").
- Hosted on Vercel (Hobby plan): Node.js route handlers, the cron jobs in `vercel.json`, and a
  private Blob store for the encrypted Mercado Libre credentials.
- Neon PostgreSQL is the only database: the synced catalog, alert subscriptions and their queues
  (`database/migrations/`, applied with `npm run db:migrate`).
- Mercado Libre is the source of truth for inventory. The site reads a synced copy in Neon.
- Server-rendered vehicle detail routes own metadata, canonical URLs, and structured data.
- `lib/integrations/mercado-libre/catalog.ts` is the catalog read boundary. `listCatalogVehicles`,
  `findCatalogPublication` and `findCatalogVehicle` read the synced copy through
  `lib/catalog/store.ts`, or the deployed backend's copy when `MERCADO_LIBRE_BACKEND_URL` is set
  (local development). There is no demo catalog: every environment shows the real Mercado Libre
  inventory, and the codebase ships no placeholder vehicles. Pages and the share-image route read
  inventory only through this module. The sitemap is deliberately empty until the indexing launch
  (`docs/seo-and-social-metadata.md`). The price alert signup is described under the sync section.

The experimental work should happen at the edge of the interface, not in the data or routing
foundation. Do not introduce another motion or 3D dependency until a specific interaction justifies
it.

## Routes

Pages (all server-rendered; client components only add interaction):

| Route | Purpose | Rendering |
| --- | --- | --- |
| `/` | Brand story, up to three available cars, FAQ, contact | Request time (`connection()`) |
| `/vehiculos` | Catalog with URL-based filters, comparison and search alerts | Request time (`connection()`) |
| `/vehiculos/[slug]` | Vehicle detail in any status, price alert, contact | Request time (`force-dynamic`), `generateMetadata`; other slugs for the same ID redirect permanently |
| `/vender` | Sell-your-car valuation form that opens WhatsApp with a prefilled message | Server page, client form |
| `/privacidad`, `/terminos` | Privacy policy and terms of use | Static |
| `/alertas/confirmacion` | Result page after an emailed confirmation link | Request time, always `noindex` |

Metadata and asset routes: `/og/vehiculos/[slug]` (1200×630 share card), `/sitemap.xml`,
`/robots.txt`, `/manifest.webmanifest` and `/apple-icon`.

Route handlers (`robots.txt` disallows `/api/`; the private ones send `no-store` and `noindex`):

| Route | Method | Access | Purpose |
| --- | --- | --- | --- |
| `/api/mercado-libre/connect` | GET | Catalog API key (Basic or Bearer) | Starts OAuth with PKCE |
| `/api/mercado-libre/callback` | GET | OAuth state and PKCE cookies | Exchanges the code, checks the seller, stores the encrypted token |
| `/api/mercado-libre/webhook` | POST | Seller and application ID check | Queues the item for sync and price alerts |
| `/api/mercado-libre/sync` | GET | `CRON_SECRET` | Daily reconciliation, then drains the queue |
| `/api/mercado-libre/catalog` | GET | Catalog API key | Synced copy for local development servers |
| `/api/mercado-libre/diagnostics` | GET | Catalog API key | Publication diagnostics; `?connection=1` credential state; `?sync=1` sync health |
| `/api/price-alerts` | POST | Same-site JSON, rate limits | Price alert signup |
| `/api/inventory-alerts` | POST | Same-site JSON, rate limits | Search alert signup |
| `/api/alerts/confirm` | GET, POST | Signed, expiring token | GET shows a page that posts itself; POST confirms |
| `/api/price-alerts/cancel`, `/api/inventory-alerts/cancel` | GET, POST | Signed token | GET shows a form; POST cancels (RFC 8058 one-click) |
| `/api/alerts/daily` | GET | `CRON_SECRET` | Daily price review and pending alert email |
| `/api/vehicle-catalog` | GET | Public, CDN-cached | Arg Autos makes, models and versions for `/vender` |

## Mercado Libre sync

The seller keeps managing inventory in Mercado Libre. The site never calls Mercado Libre while
rendering a page: it reads a local copy in Neon (`database/migrations/20261031_catalog_sync.sql`)
that a sync worker keeps current. Sync is one-way; nothing is edited on the site.

1. Mercado Libre sends an `items` or `items_prices` notification to `/api/mercado-libre/webhook`.
2. The webhook checks the seller and application IDs, records the item ID in `catalog_sync_jobs`
   and only then answers 200. If the job cannot be stored it answers 503 so Mercado Libre retries.
3. After the response, the worker leases the job and reads the item and description again with the
   seller token. The notification payload is never trusted, so duplicate, forged or out-of-order
   notifications cannot write wrong data. The safeguards below keep them cheap as well.
4. Cars, pickups and motorcycles of the configured seller are saved in `catalog_publications`
   (public presentation fields only) in any status: active, paused or closed. Items that no longer
   exist are marked `closed`. Other sellers' items and anything else (trucks, boats, savings plans,
   the seller's scale models and accessories) are never stored. The Mercado Libre category decides:
   it must be, or sit below, one of the categories in
   `lib/integrations/mercado-libre/vehicle-categories.ts` (Autos y Camionetas, new, classic and
   damaged cars, and Motos). Categories are looked up once each; an item without a readable category
   is retried, never guessed. Each row records its qualifying category in `vehicle_category`, and
   the database rejects any insert or update without one of those categories
   (`catalog_publications_vehicle_category_check`), so no other code path can store anything else.
5. Pages and the share-image route read the copy at request time, so a change is visible on the next
   request. There is no page cache to invalidate. The price alert signup reads the copy only while
   alert delivery is disabled (see below).
6. `/api/mercado-libre/sync` (Vercel cron, `CRON_SECRET`) reconciles: it scans every publication of
   the seller in any status, keeps the vehicles, and queues each one that is missing from the copy,
   changed (status or last update), no longer listed or not refreshed for a day, then drains the
   queue. This also backfills vehicles that were paused or closed before the copy existed, so every
   car the seller ever listed keeps its page. It never closes or edits a vehicle from the listing
   alone, so a partial or empty provider response cannot remove vehicles from the site.

Ownership of fields: Mercado Libre owns price, currency, status, title, attributes, pictures and
description. The copy owns the slug (fixed at the first sync, so URLs survive title edits; other slugs
for the same ID redirect permanently), `published_at`, `closed_at`, `content_changed_at` (used as the
vehicle's `updatedAt`) and `catalog_price_history`.

Safety properties: one job row per item with a revision counter, so a notification arriving during a
read makes the item due again; writes require the item's current job lease, so a worker whose lease
expired cannot overwrite a newer read; failed reads back off exponentially up to an hour and are given
up after eight attempts with the error kept for diagnostics; a single-row lease allows one
reconciliation at a time. `GET /api/mercado-libre/diagnostics?sync=1` reports the last reconciliation,
queue backlog (`jobs.deferred` counts jobs from unlisted addresses) and row counts.

### Forged and repeated notifications

Mercado Libre does not sign notifications, and the seller ID is public, so anyone can post a
plausible one. It can never write data (step 3), but each one used to cost a queue row, a drain in a
300-second function and two or three Mercado Libre calls on the seller token. Mercado Libre also
sends many copies of one change. No safeguard rejects a notification: every one that passes the ID
checks is either queued durably or already covered by queued work, so a genuine notification can
be delayed but never lost.

- **Copies of queued work** (`enqueueCatalogNotification` in `lib/catalog/store.ts`). A notification
  for a job that is already due changes nothing and starts no drain: the drain already on its way
  reads the current item. It keeps any backoff. A notification for a job being read adds a revision,
  as before. A finished job is made due again. A due job that no worker has picked up for two
  minutes (an interrupted drain) does get a new drain. The price-alert queue works the same way
  (`enqueuePriceItem`).
- **One webhook drain at a time.** The drain holds a single-row lease (`notification_drain` in
  `catalog_sync_runs`), renewed per item and expiring after 90 seconds if the function dies. A
  notification that finds it taken starts nothing, so a drain checks once more for due work after
  releasing it. The cron drains on its own, alongside it; job leases keep the two apart.
- **Items that are not ours.** When a read finds that an item never stored belongs to another seller,
  notifications for it are ignored for a day; when it does not exist, for an hour, in case a brand
  new listing was read too early (`skip_until`). A stored vehicle is never skipped, and the
  reconciliation clears the skip, since the seller's own listing vouches for the item.
- **Unlisted source addresses** (optional). Mercado Libre publishes the addresses it sends
  notifications from, in [Recibe notificaciones](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones),
  but its pages disagree (the Spanish page lists far more than the English one and the
  [security guide](https://developers.mercadolibre.com.ar/es_ar/seguridad-apps)) and say the list can
  change. Set `MERCADO_LIBRE_WEBHOOK_IPS` to the comma-separated list from the Spanish page to use it.
  The webhook compares `x-vercel-forwarded-for`, which Vercel sets itself, never the first
  `x-forwarded-for` entry. A notification from any other address is still queued and answered 200,
  but as `deferred`: the webhook never drains it, and the daily cron reads it after every other job.
  So an outdated list only delays notifications to the daily sync, and each one is logged
  (`mercado_libre_webhook_unlisted_address`, with the address) so the list can be updated. Unset, as
  locally and in tests, every address is accepted. A proxy in front of Vercel would make every
  address look unlisted.
- **Bounded queue** (`pruneCatalogJobs`). Each successful reconciliation deletes jobs of items never
  stored that are not leased and were last touched before it started: finished jobs once any skip has
  expired, given-up jobs after 14 days, and deferred jobs when the listing was complete (a genuine
  one is a seller vehicle missing from the copy, which the same reconciliation queued again). Jobs of
  stored vehicles are never deleted, since their lease and revision guard every write, and nothing
  touches `catalog_publications`.

There is no cap on notification volume per time window. A cap that rejected notifications could
drop genuine ones, and one that only skipped drains would add little: the drain lease already
allows a single drain at a time. Configuring the addresses is the strongest lever. Forged
notifications then cost one statement each, start nothing, and are read at most within the cron's
200-item budget per day.

The cron runs daily so it also works on the Vercel Hobby plan, which rejects more frequent crons.
Webhooks carry real-time changes; on a Pro plan, change the schedule in `vercel.json` to
`*/15 * * * *` to repair missed notifications within 15 minutes.

Price alerts keep their own queue and read Mercado Libre directly before sending, for an
authoritative price. Where alert emails are configured, the signup route
(`app/api/price-alerts/route.ts`) does not use the copy either: it reads the item from Mercado Libre
with the seller token, rejects items of other sellers and takes the starting price from that read.
Without that configuration the signup resolves the vehicle from the synced copy with
`findCatalogVehicle` and only stores the subscription. See [the Mercado Libre setup notes](mercado-libre-local.md).

Search alerts work from the copy instead. When a save turns an item active (a new listing, or a
reserved one released), the same statement records an `inventory_alert_events` row; the alert worker
then matches it against active search alerts with the catalog's own filter predicate and emails the
matches through an outbox. See "Search alerts" in [price-alert-delivery.md](price-alert-delivery.md).

OAuth tokens and client secrets are server-only. The current access token is stored encrypted next to
the refresh token and shared by every server instance until it expires, so the one-use refresh
token rotates about once per token lifetime rather than once per instance. The seller should own the Mercado Libre app and
production credentials.

## Response headers

`next.config.ts` sends `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and a
`Permissions-Policy` that turns off unused device features on every route. Every route outside `/api`
also gets `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none';
form-action 'self'` and `Referrer-Policy: strict-origin-when-cross-origin`. With `next start`, config
headers are written before a route handler's own headers, and Next drops a handler header whose name
is already set. The CSP and Referrer-Policy rules therefore skip `/api`, so the emailed alert pages
keep their stricter `default-src 'none'` CSP and `no-referrer` (`lib/alerts/page.ts`,
`privateHeaders`). The site-wide CSP has no `script-src`: Next's inline bootstrap, the JSON-LD blocks
and PostHog would need per-request nonces. Framing the site, including in PostHog's in-app heatmap
view, is blocked.

## Motion and 3D strategy

Motion is progressive enhancement. CSS handles control and hover transitions. GSAP (`gsap` and
`@gsap/react`) runs the coordinated entrance, accordion, dialog and comparison-dock animations from
client components (`components/motion/` and route `_components/`). Animations honor
`prefers-reduced-motion`, and no content, price or contact action depends on them.

There is no 3D scene. Reserve React Three Fiber/Three.js for one high-impact, isolated scene after
real assets and a measurable user benefit exist. Such a scene must:

- load dynamically after primary content;
- have a designed static image fallback;
- respect `prefers-reduced-motion` and `Save-Data`;
- disable itself on constrained devices;
- never contain essential copy, navigation, price, or contact actions;
- release its renderer and assets when no longer visible.

## SEO foundation

- One stable URL per active or sold vehicle.
- Unique title, description, canonical URL, and social metadata per vehicle.
- `Vehicle`/`Product`, `LocalBusiness`, and breadcrumb structured data where valid.
- Sitemap deliberately empty until the indexing launch; from then on, generated from the public
  pages and active inventory.
- Sold vehicles remain useful when possible; removed URLs return an intentional status.
- Spanish semantic HTML is rendered on the server before enhancement.

The binding implementation rules, lifecycle policy, route checklist, and verification contract live
in the [SEO and social metadata guidelines](seo-and-social-metadata.md). Update that document whenever
an SEO or sharing decision changes.

## Ownership

The client should own the domain, production hosting account, Mercado Libre application, analytics,
and any paid third-party accounts. Development can remain in the creator's GitHub organization until
handoff is agreed.
