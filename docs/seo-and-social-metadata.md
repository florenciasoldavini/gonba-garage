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
| Demo/production indexing gate | `lib/site-indexing.ts` and `SITE_INDEXING_ENABLED` |
| Site and dealer JSON-LD | `lib/structured-data.ts` |
| Safe JSON-LD rendering | `components/seo/json-ld.tsx` |
| Vehicle Product/Offer/Breadcrumb JSON-LD | `app/vehiculos/[slug]/page.tsx` |
| Dynamic vehicle share cards | `app/og/vehiculos/[slug]/route.ts` |
| Crawler rules | `app/robots.ts` |
| Discoverable URLs and freshness | `app/sitemap.ts` |
| Favicon, Apple icon, and manifest | `public/favicon.svg`, `app/apple-icon.tsx`, and `app/manifest.ts` |
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
- Social sharing must continue to work while the demo is `noindex`.

When a vehicle's visible fields or status labels change, review both the generated card and its
metadata. Social platforms cache previews, so stable URLs should serve current content with explicit
cache behavior rather than creating arbitrary versioned URLs.

## Structured-data rules

The root layout publishes a `WebSite` and `AutoDealer` graph. Vehicle detail pages publish:

- a combined `Product` and `Vehicle` entity;
- an `Offer` with price, currency, used condition, seller, URL, and lifecycle-derived availability;
- a three-level `BreadcrumbList`: Inicio → Vehículos → current vehicle.

Use absolute URLs and stable `@id` values derived from the canonical origin. Reuse the organization
ID from `lib/structured-data.ts` rather than defining another seller entity. Escape JSON-LD through
the shared `JsonLd` component; do not interpolate unescaped JSON into a script element.

Structured data must be updated with the visible page whenever price, currency, mileage, status,
seller identity, canonical URL, or breadcrumbs change.

## Inventory lifecycle and indexing

Inventory status controls visible labels, Offer availability, sitemap membership, and sometimes page
robots metadata. Keep the mapping centralized in `features/vehicles/presentation/status.ts`.

| Status | Page behavior | Sitemap | Offer availability |
| --- | --- | --- | --- |
| `active` | Available and eligible for indexing | Included | `InStock` |
| `paused` | Temporarily unavailable and `noindex, follow` in production mode | Excluded | `OutOfStock` |
| `sold` | Retain a useful stable page when possible; do not imply availability | Excluded | `SoldOut` |

If a sold page has no enduring value or replacement, return an intentional 404 or redirect to the
closest legitimate equivalent. Never redirect every removed vehicle to the homepage.

Each inventory record must provide a reliable `updatedAt`; sitemap `lastModified` must reflect a real
content or availability update, not the build time.

## Demo and permanent-domain policy

The safe default is:

```bash
SITE_INDEXING_ENABLED=false
```

Demo and preview deployments emit `noindex, nofollow`, serve an empty sitemap, and omit the sitemap
and host from `robots.txt`. `robots.txt` still allows page crawling so crawlers can read the `noindex`
directive; blocking the entire site in `robots.txt` would prevent that.

Do not enable indexing merely because a custom domain has been connected. Follow the
[custom-domain launch checklist](custom-domain-launch-checklist.md). Production indexing requires
real inventory and business content, working advertised forms, the permanent canonical domain, and:

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

The metadata check expects a running production build. Verify both safety modes when indexing logic
or public routes change:

```bash
npm run lint
npm run typecheck
npm run build
npm run start -- --port 3100
npm run test:metadata -- http://localhost:3100
```

Then rebuild and repeat the metadata test with `SITE_INDEXING_ENABLED=true`. Confirm that demo mode
uses `noindex` and an empty sitemap, while production mode exposes indexable routes and advertises the
sitemap. The custom-domain checklist contains the separate live-launch verification.
