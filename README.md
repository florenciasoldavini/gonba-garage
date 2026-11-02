# Gonba's Garage

Performance-led vehicle marketplace website with a progressive, editorial interaction layer and a
planned Mercado Libre inventory integration.

## Current status

The repository contains the technical foundation and a provisional visual study. Business copy,
brand assets, vehicle fields, and final interaction concepts will be revised after client discovery.

## Development

```bash
npm install
npm run dev
```

Quality checks (CI runs all four on every pull request):

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` runs the Vitest suites in `tests/`. They need no credentials or network: database code
runs against real PostgreSQL in memory (PGlite) with every migration applied twice, and Mercado
Libre, the MEP quote and Resend are replaced with fakes. Test fixtures live in the test files and
`tests/fixtures/`; the application never imports them. `npm run test:watch` reruns them on change,
and `npm run test:live` adds the checks against the live Mercado Libre category schema and the
Neon database in `.env.local`.

`npm run test:metadata` checks the SEO and social metadata contract against a running production
server that reads the real catalog (see
[Verification](docs/seo-and-social-metadata.md#verification)). CI runs it in both indexing modes
when the `MERCADO_LIBRE_CATALOG_API_KEY` repository secret is set, and skips it with a notice
otherwise.

## Project structure

- `app/` contains routes, layouts, and thin API handlers. Route-only components live in private
  `_components` folders beside the route that owns them.
- `components/ui/` contains reusable interface controls.
- `features/vehicles/` contains the vehicle domain model, Mercado Libre item mapper, and
  presentation helpers. The site ships no demo vehicles: every environment shows the real Mercado
  Libre catalog. Locally, read it through the deployed backend
  ([Mercado Libre setup notes](docs/mercado-libre-local.md#desarrollo-local)).
- `lib/integrations/` contains server-only adapters for external services.
- `lib/catalog/` and `lib/alerts/` contain the server-only database access for the synced catalog and
  alerts (Neon PostgreSQL).
- `database/migrations/` contains versioned database migrations, applied with `npm run db:migrate`.

Copy `.env.example` to `.env.local` and fill in the environment values that are available. The
database is reached only from server code through the server-only `DATABASE_URL`; never expose it to
browser code. See [Neon storage](docs/neon-alert-storage.md) for environments and migrations.

### Indexing safety

The site defaults to `SITE_INDEXING_ENABLED=false`. With indexing disabled, deployments emit
`noindex, nofollow` and an empty sitemap while preserving Open Graph and social sharing. Separately,
the catalog, car pages and sitemap stay out of search results until the final version of the site,
even with indexing enabled ([catalog indexing hold](docs/seo-and-social-metadata.md#indexing-gates-and-permanent-domain-policy)).

When the permanent URL is connected and the final site, forms, and business details are ready, the
production launch must lift the catalog indexing hold in code and include both environment changes
below, followed by a redeploy:

```bash
NEXT_PUBLIC_SITE_URL=https://<permanent-domain>
SITE_INDEXING_ENABLED=true
```

Do not submit the sitemap to Search Console until the production deployment has been verified with
those values. Follow the [custom-domain launch checklist](docs/custom-domain-launch-checklist.md).

## Principles

- Server-render the product and SEO-critical content.
- Treat motion and 3D as progressive enhancement.
- Pages read inventory only through `lib/integrations/mercado-libre/catalog.ts`, never Mercado Libre directly.
- Make performance budgets part of acceptance criteria.

See [architecture](docs/architecture.md), [design system](docs/design-system.md), and
[performance budget](docs/performance-budget.md). Analytics activation, event definitions, and
Search Console setup are documented in [analytics](docs/analytics.md). Use the
[custom-domain launch checklist](docs/custom-domain-launch-checklist.md) when replacing the temporary
Vercel hostname. All public routes and inventory changes must follow the
[SEO and social metadata guidelines](docs/seo-and-social-metadata.md).
