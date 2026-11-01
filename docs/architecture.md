# Technical foundation

## Product principle

The site is a sales surface first and an experimental portfolio piece second. Every vehicle,
price, description, and contact action must remain usable without WebGL or client-side animation.

## Stack

- Next.js App Router, React Server Components, and TypeScript.
- Tailwind is available for utilities; project-specific art direction can live in authored CSS.
- Cloudflare-compatible Vinext runtime for the current local and hosting foundation.
- Mercado Libre is the source of truth for inventory. The site reads a synced copy in Neon.
- Server-rendered vehicle detail routes will own metadata, canonical URLs, and structured data.
- `lib/integrations/mercado-libre/catalog.ts` is the catalog read boundary. `listCatalogVehicles`,
  `findCatalogPublication` and `findCatalogVehicle` read the synced copy through
  `lib/catalog/store.ts`, or the deployed backend's copy when `MERCADO_LIBRE_BACKEND_URL` is set
  (local development). There is no demo catalog: every environment shows the real Mercado Libre
  inventory, and the codebase ships no placeholder vehicles. Pages and the share-image route read
  inventory only through this module. The sitemap is empty until the indexing launch
  (`docs/seo-and-social-metadata.md`). The price alert signup is described under the sync section.

The experimental work should happen at the edge of the interface, not in the data or routing
foundation. Do not introduce a motion or 3D dependency until a specific interaction justifies it.

## Planned routes

| Route | Purpose | Rendering |
| --- | --- | --- |
| `/` | Brand story, featured stock, trust, primary conversion | Server-rendered |
| `/vehiculos` | Filterable inventory | Server-rendered shell and URL-based filters |
| `/vehiculos/[slug]` | Vehicle detail and conversion | Server-rendered with dynamic metadata |
| `/vender` | Vehicle acquisition lead form | Server-rendered with progressive enhancement |
| `/api/mercado-libre/webhook` | Listing-change notifications | Server route handler |
| `/api/mercado-libre/callback` | OAuth callback | Server route handler |

## Mercado Libre sync

The seller keeps managing inventory in Mercado Libre. The site never calls Mercado Libre while
rendering a page: it reads a local copy in Neon (`database/migrations/20261031_catalog_sync.sql`)
that a sync worker keeps current. Sync is one-way; nothing is edited on the site.

1. Mercado Libre sends an `items` or `items_prices` notification to `/api/mercado-libre/webhook`.
2. The webhook checks the seller and application IDs, records the item ID in `catalog_sync_jobs`
   and only then answers 200. If the job cannot be stored it answers 503 so Mercado Libre retries.
3. After the response, the worker leases the job and reads the item and description again with the
   seller token. The notification payload is never trusted, so duplicate, forged or out-of-order
   notifications cannot write wrong data.
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
queue backlog and row counts.

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

Start with CSS transforms, opacity, and native browser capabilities. Add `motion` only when a
component needs coordinated state transitions. Reserve React Three Fiber/Three.js for one
high-impact, isolated scene after real assets and a measurable user benefit exist.

The 3D scene must:

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
- Sitemap generated from current inventory.
- Sold vehicles remain useful when possible; removed URLs return an intentional status.
- Spanish semantic HTML is rendered on the server before enhancement.

The binding implementation rules, lifecycle policy, route checklist, and verification contract live
in the [SEO and social metadata guidelines](seo-and-social-metadata.md). Update that document whenever
an SEO or sharing decision changes.

## Ownership

The client should own the domain, production hosting account, Mercado Libre application, analytics,
and any paid third-party accounts. Development can remain in the creator's GitHub organization until
handoff is agreed.
