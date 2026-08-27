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

Quality checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Project structure

- `app/` contains routes, layouts, and thin API handlers. Route-only components live in private
  `_components` folders beside the route that owns them.
- `components/ui/` contains reusable interface controls.
- `features/vehicles/` contains the vehicle domain model, repository boundary, and provisional data.
- `lib/integrations/` contains server-only adapters for external services.
- `lib/supabase/` contains Supabase clients and generated database types.
- `supabase/migrations/` contains versioned database migrations.

Copy `.env.example` to `.env.local` and fill in the environment values that are available. Supabase
has separate clients for browser components, request-scoped server code, and trusted server-only sync
jobs in `lib/supabase`. Never expose `SUPABASE_SECRET_KEY` to browser code.

### Demo indexing safety

The site defaults to `SITE_INDEXING_ENABLED=false`. Demo deployments emit `noindex, nofollow` and
an empty sitemap while preserving Open Graph and social sharing.

When the permanent URL is connected and the real inventory, forms, and business details are ready,
the production launch must include both environment changes below, followed by a redeploy:

```bash
NEXT_PUBLIC_SITE_URL=https://<permanent-domain>
SITE_INDEXING_ENABLED=true
```

Do not submit the sitemap to Search Console until the production deployment has been verified with
those values. Follow the [custom-domain launch checklist](docs/custom-domain-launch-checklist.md).

Generated database types live in `lib/supabase/generated/database.types.ts` and should be
regenerated after every schema change.

## Principles

- Server-render the product and SEO-critical content.
- Treat motion and 3D as progressive enhancement.
- Keep Mercado Libre behind the repository boundary in `features/vehicles/domain`.
- Make performance budgets part of acceptance criteria.

See [architecture](docs/architecture.md), [design system](docs/design-system.md), and
[performance budget](docs/performance-budget.md). Analytics activation, event definitions, and
Search Console setup are documented in [analytics](docs/analytics.md). Use the
[custom-domain launch checklist](docs/custom-domain-launch-checklist.md) when replacing the temporary
Vercel hostname.
