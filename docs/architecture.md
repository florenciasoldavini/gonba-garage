# Technical foundation

## Product principle

The site is a sales surface first and an experimental portfolio piece second. Every vehicle,
price, description, and contact action must remain usable without WebGL or client-side animation.

## Stack

- Next.js App Router, React Server Components, and TypeScript.
- Tailwind is available for utilities; project-specific art direction can live in authored CSS.
- Cloudflare-compatible Vinext runtime for the current local and hosting foundation.
- Mercado Libre is the planned source of truth for inventory.
- Server-rendered vehicle detail routes will own metadata, canonical URLs, and structured data.
- A repository boundary in `features/vehicles/domain` keeps Mercado Libre transport details out of pages.

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

1. Mercado Libre sends an item notification.
2. The webhook acknowledges it quickly and records the item ID.
3. The server fetches the authoritative item and price resources with the seller token.
4. Normalized vehicle data is cached or persisted behind `VehicleRepository`.
5. Relevant pages are invalidated without rebuilding the whole site.
6. A scheduled reconciliation repairs missed notifications.

OAuth tokens and client secrets are server-only. The seller should own the Mercado Libre app and
production credentials.

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
