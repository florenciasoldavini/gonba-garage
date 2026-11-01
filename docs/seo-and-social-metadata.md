# SEO and social metadata guidelines

This document is the source of truth for SEO, Open Graph, Twitter/X cards, structured data, and
indexing behavior in Gonba's Garage. Every new public route and every change to vehicle lifecycle,
URLs, business identity, or share previews must follow these rules and update the automated metadata
check when applicable.

## Core decisions

- Public content is written for Argentina in Spanish. Use `es-AR` for structured data and `es_AR`
  for Open Graph locale values.
- Every indexable page has one stable, self-referencing canonical URL. Tracking parameters, filters,
  comparison state, and anchors never create additional canonicals.
- Page metadata is rendered through the Next.js Metadata API in a Server Component. Client
  Components must not own SEO metadata.
- Search metadata and social metadata describe the same page. Open Graph and Twitter/X titles,
  descriptions, URLs, images, and image alt text must remain aligned.
- The default social card is 1200×630. Vehicle pages use a distinct generated 1200×630 PNG at
  `/og/vehiculos/[slug]`; generic pages use the branded default image.
- Structured data must contain only facts that are visible on the page or confirmed business facts.
  Never add ratings, reviews, inventory claims, addresses, opening hours, or availability merely to
  make a rich result look more complete.
- A missing route returns a real 404 and must not claim another route's canonical URL.
- SEO-critical copy, headings, vehicle data, canonical metadata, and JSON-LD remain available in the
  initial server-rendered HTML.

## Source files and ownership

| Concern | Source of truth |
| --- | --- |
| Shared page metadata | `lib/metadata.ts` |
| Canonical origin | `lib/site-url.ts` and `NEXT_PUBLIC_SITE_URL` |
| Site-wide indexing gate | `lib/site-indexing.ts` and `SITE_INDEXING_ENABLED` |
| Site and dealer JSON-LD | `lib/structured-data.ts` |
| Safe JSON-LD rendering | `components/seo/json-ld.tsx` |
| Vehicle Product/Offer/Breadcrumb JSON-LD | `app/vehiculos/[slug]/page.tsx` |
| Dynamic vehicle share cards | `app/og/vehiculos/[slug]/route.ts` |
| Crawler rules | `app/robots.ts` |
| Discoverable URLs and freshness | `app/sitemap.ts` (empty until the indexing launch) |
| Favicon, Apple icon, and manifest | `public/favicon.svg`, `app/apple-icon.tsx`, and `app/manifest.ts` |
| Brand logo files (header, footer, share cards, dealer `logo`) | `public/brand/` |
| End-to-end metadata contract | `scripts/check-social-metadata.mjs` |

Keep shared policy in these files instead of duplicating URL construction or metadata objects across
routes.

## Required metadata for every public page

Each public route must provide:

- a unique, useful page title that includes `Gonba's Garage` once;
- a unique description that accurately summarizes the visible page;
- a canonical path matching the route's preferred URL;
- Open Graph title, description, URL, site name, `es_AR` locale, image, and descriptive image alt;
- a Twitter/X `summary_large_image` card using the same title, description, image, and alt text;
- appropriate robots behavior for the current environment and the page lifecycle;
- relevant structured data when the page represents a recognized entity or hierarchy.

Use `createPageMetadata()` from `lib/metadata.ts` for normal pages. Use `generateMetadata()` only when
metadata depends on route data, as it does for `/vehiculos/[slug]`. Pass route-relative canonical and
image paths; the root `metadataBase` resolves them against `NEXT_PUBLIC_SITE_URL`.

Do not derive the canonical URL from request headers, deployment preview hostnames, or query strings.
Do not add `keywords` metadata: it is not part of this project's SEO strategy.

## Open Graph and share-card rules

- Keep social images at 1200×630 and ensure the response has a valid image content type.
- Use one share-card URL per vehicle slug so different vehicles do not collapse into the same social
  preview cache entry.
- Include the vehicle identity, year/version, price, location, and lifecycle label only when those
  values are current and visible to users.
- Use descriptive alt text. Alt text describes the card or vehicle; it is not a list of keywords.
- Preserve safe margins and legibility at small preview sizes. Do not place critical text against the
  image edges.
- Keep the branded default image for generic pages until a page has a genuinely more useful custom
  preview.
- Open Graph currently uses `type: website` for all routes. Vehicle identity is expressed through
  Product/Vehicle JSON-LD; change this decision only after validating compatibility across the target
  sharing platforms.
- Social sharing must continue to work while pages are `noindex`.

When a vehicle's visible fields or status labels change, review both the generated card and its
metadata. Social platforms cache previews, so stable URLs should serve current content with explicit
cache behavior rather than creating arbitrary versioned URLs.

## Structured-data rules

The root layout publishes a `WebSite` and `AutoDealer` graph. Vehicle detail pages publish:

- a combined `Product` and `Vehicle` entity;
- an `Offer` with price, currency, used condition, seller, URL, and lifecycle-derived availability;
- a three-level `BreadcrumbList`: Inicio → Vehículos → current vehicle.

The business facts behind the `AutoDealer` entity and the footer live in `constants/contact.ts`.
Its `address` is locality-level only (Villa Pueyrredón, CABA, AR): the owner publishes no street
address, so never add `streetAddress` or a postal code. Opening hours are deliberately left out of
the schema. Visits are always by appointment, and `openingHours` or `openingHoursSpecification`
would let search results show the business as "open now" to walk-ins. The hours appear in the
footer next to "Siempre con cita previa" instead. `areaServed` stays at Buenos Aires because the
dealer sells to buyers outside its own neighborhood. The metadata check asserts all of this.

Use absolute URLs and stable `@id` values derived from the canonical origin. Reuse the organization
ID from `lib/structured-data.ts` rather than defining another seller entity. Escape JSON-LD through
the shared `JsonLd` component; do not interpolate unescaped JSON into a script element.

Structured data must be updated with the visible page whenever price, currency, mileage, status,
seller identity, canonical URL, or breadcrumbs change.

## Inventory lifecycle and indexing

Inventory status controls visible labels, Offer availability and listing. Keep the mapping
centralized in `features/vehicles/presentation/status.ts`.

Mercado Libre has no reserved or sold status. The seller pauses a publication when a buyer reserves
the car in person and usually leaves it paused after the sale until it expires and closes. The page
therefore shows a paused car as reserved only for `RESERVATION_WINDOW_DAYS` (14) after the pause,
measured from `updatedAt`, and as sold afterwards. A closed publication always shows as sold.

| Stored status | Shown as | Page behavior | Offer availability |
| --- | --- | --- | --- |
| `active` | Disponible | Listed in the catalog and on the home page | `InStock` |
| `paused`, within the window | Reservado | Kept, not listed | `Reserved` |
| `paused`, past the window | Vendido | Kept, not listed | `SoldOut` |
| `closed` or `sold` | Vendido | Kept, not listed | `SoldOut` |

Every car page is `noindex, nofollow` and the sitemap is empty until the final version of the site
(see the catalog indexing hold below). The policy to restore at the indexing launch: active cars are
indexable and in the sitemap; reserved and sold pages are `noindex, follow` and stay out of it.

Reserved and sold pages never imply availability: no contact-to-buy action or comparison. They keep
the published price as a visible reference (so the Offer stays truthful), offer an email alert, and
link to up to three similar available cars. Those links give the page enduring
value, so it stays reachable rather than returning 404. Once indexing launches it must stay out of
search results, because the seller often relists the same car under a new publication, which would
otherwise compete with it.
Their description states the status instead of inviting an availability query, and the share card
omits a sold car's price because it is no longer current. Never redirect every removed vehicle to the
homepage.

Each inventory record must provide a reliable `updatedAt`; sitemap `lastModified` must reflect a real
content or availability update, not the build time.

## Indexing gates and permanent-domain policy

The site never ships demo or placeholder vehicles. Every environment shows the real Mercado Libre
catalog (see «Catalog rendering»). Two separate gates keep it out of search results.

**Site-wide gate.** The safe default is:

```bash
SITE_INDEXING_ENABLED=false
```

With indexing disabled (local, preview and today's production deployments), every page emits
`noindex, nofollow`, the sitemap is empty, and `robots.txt` omits the sitemap and host.
`robots.txt` still allows page crawling so crawlers can read the `noindex` directive; blocking the
entire site in `robots.txt` would prevent that.

**Catalog indexing hold.** Until the final version of the site, `/vehiculos` and every
`/vehiculos/[slug]` page are `noindex, nofollow` and `app/sitemap.ts` returns no URLs, whatever
`SITE_INDEXING_ENABLED` says. With `SITE_INDEXING_ENABLED=true` only the home page, `/vender`,
`/privacidad` and `/terminos` become indexable, and `robots.txt` advertises the still-empty sitemap.
Lifting the hold is a code change that belongs to the indexing launch: drop the forced robots in
`app/vehiculos/page.tsx` and `app/vehiculos/[slug]/page.tsx` (keeping `noindex, follow` for reserved
and sold cars), list the public pages and active cars from `listCatalogVehicles()` in
`app/sitemap.ts` with `updatedAt` as `lastModified`, and update `scripts/check-social-metadata.mjs`.

The social image route reads the same vehicle source as the detail page. The protected Vercel API
uses `no-store` and `noindex`, requires server-side credentials and is excluded from the sitemap.

Do not enable indexing merely because a custom domain has been connected. Follow the
[custom-domain launch checklist](custom-domain-launch-checklist.md). Production indexing requires
the final version of the site, working advertised forms, the permanent canonical domain, lifting the
catalog indexing hold, and:

```bash
NEXT_PUBLIC_SITE_URL=https://<permanent-domain>
SITE_INDEXING_ENABLED=true
```

Redeploy and verify the production HTML, `robots.txt`, and sitemap before submitting the sitemap to
Search Console.

## Checklist for adding or changing a route

Before merging a new public route or an SEO-relevant change:

1. Define unique metadata with `createPageMetadata()` or server-side `generateMetadata()`.
2. Confirm the canonical excludes query strings and resolves to the preferred permanent route.
3. Confirm OG and Twitter/X values match the page and include meaningful image alt text.
4. Add or update truthful JSON-LD if the route represents a vehicle, business entity, or breadcrumb
   hierarchy.
5. Decide explicitly whether the route belongs in `app/sitemap.ts` and what reliable freshness value
   it uses.
6. Preserve the environment-wide indexing gate and add lifecycle-specific robots rules if needed.
7. Add the route and its important assertions to `scripts/check-social-metadata.mjs`.
8. Run lint, type checking, a production build, and metadata verification.
9. Visually inspect every new share-card design at 1200×630 and at a reduced preview size.
10. Update this document when a decision or contract changes.

## Verification

The metadata check expects a running production build that reads the real catalog, locally through
`MERCADO_LIBRE_BACKEND_URL` (see [the Mercado Libre setup notes](mercado-libre-local.md)). It
discovers the car pages to check from the server's own `/vehiculos` page, so the catalog must list at
least one car; no vehicle data is shipped for it. Verify both indexing modes when indexing logic or
public routes change:

```bash
npm run lint
npm run typecheck
npm run build
npm run start -- --port 3100
npm run test:metadata -- http://localhost:3100
```

Then rebuild and repeat the metadata test with `SITE_INDEXING_ENABLED=true` set for the build, the
server and the test. Confirm that disabled indexing uses `noindex` everywhere and an empty sitemap,
while enabled indexing makes the home page, `/vender` and the legal pages indexable and advertises the
sitemap, and the catalog hold keeps the catalog, car pages and sitemap as they were.

Reserved and sold pages are listed nowhere, so the check covers them only when their slugs are passed
in, comma-separated: `METADATA_UNLISTED_VEHICLES=<slug>,<slug> npm run test:metadata -- <origin>`.
The car's slug is the end of its URL. Without it the script says which checks were not covered, as it
also does for the price alert form when email delivery is disabled on the server. The
custom-domain checklist contains the separate live-launch verification.

## Catalog rendering

The home page, the catalog and vehicle details render at request time, including publication slugs
that were unknown during the build. Do not generate a static-parameter list for these pages: they
read the synced database copy at request time, so Mercado Libre API calls do not grow with page
views, crawlers or share-image requests. The home page and the catalog opt into request-time rendering
before their catalog error handler.

Each vehicle keeps the slug assigned at its first sync, even when the seller edits the listing
title. Any other slug ending in the same Mercado Libre ID returns a permanent redirect to the
canonical URL. Paused and closed publications keep their page with the lifecycle label from
`features/vehicles/presentation/status.ts` (see the table above); only active ones are listed.
`updatedAt` is the last real content or availability change recorded by the sync, never a
provider-side touch or the sync time.

When the catalog backend fails, a vehicle detail page shows a "Catálogo no disponible" message with
`noindex, nofollow` metadata instead of a server error. Only a genuinely missing vehicle returns
`notFound()` and a real 404; the metadata check asserts that missing slugs, with and without a
publication ID, still return 404, and that a non-canonical slug redirects.

## Private alert management

`/api/alerts/daily` and `/api/mercado-libre/sync` require the cron secret. `/api/price-alerts/cancel` validates a signed,
generation-scoped capability and serves a minimal cancellation confirmation.
`/api/alerts/confirm` validates a signed, generation-scoped and expiring signup confirmation
for price and inventory alerts and serves the same kind of minimal page. All three are
`private, no-store` and `noindex, nofollow` in every indexing mode and excluded from the
sitemap. Cancellation and confirmation GETs do not mutate data, so email scanners cannot cancel
or activate subscriptions. POST performs the change, including RFC 8058 one-click cancellation.
The confirmation GET page submits its own POST form on load, so a click in the email confirms in
one step; its CSP allows only that inline script by hash, and without JavaScript a button is shown.
Every confirmation outcome then redirects (303, relative `Location`) to `/alertas/confirmacion`,
a normal site page with the header and footer. Its query holds only the outcome, the alert type
and, for price alerts, the public vehicle slug: never the token or an email. The page uses
`createPageMetadata()` with a query-free canonical, is `noindex, nofollow` in every mode, and is
excluded from the sitemap.
Confirmation and cancellation tokens use distinct signed formats and cannot be swapped. No email
address is embedded in any URL. Email links use the explicit fixed `ALERTS_PUBLIC_URL` origin.

## Homepage inventory

The homepage selection uses up to three active vehicles from the same catalog source as
`/vehiculos`, including their photos, slugs and specifications. It renders at request time. An unavailable or empty catalog shows an explicit message and never falls
back to example vehicle links. Decorative photography and shared homepage metadata are
unchanged.

## Legal pages

`/privacidad` (privacy policy under Ley 25.326) and `/terminos` (terms of use) are static public
pages built with `createPageMetadata()`, the branded default card and the environment-wide indexing
gate. They are indexable once indexing is enabled. When the sitemap is filled at the indexing launch,
list them with `lastModified` taken from `LEGAL_PAGES` in `constants/legal.ts`, the same date each
page shows. Change that date with every revision. The owner's name, CUIT and location live in the same file. Every footer links both
pages, and both alert forms link the privacy policy next to the email field.

The privacy policy describes what the code actually does. Update it in the same change whenever
alert storage or retention, the sell-your-car flow, analytics or session replay, or a data
processor (Vercel, Neon, Resend, PostHog) changes. The metadata check asserts the owner's
identity, the required Ley 25.326 and AAIP wording, the named processors and every link.
