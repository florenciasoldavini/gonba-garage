# Gonba Garage

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

Copy `.env.example` to `.env.local` only when Mercado Libre application details are available.

## Principles

- Server-render the product and SEO-critical content.
- Treat motion and 3D as progressive enhancement.
- Keep Mercado Libre behind a domain-level repository boundary.
- Make performance budgets part of acceptance criteria.

See [architecture](docs/architecture.md) and [performance budget](docs/performance-budget.md).
