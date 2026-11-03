# Repository instructions

## SEO and social metadata

All new public routes and all changes to URLs, inventory lifecycle, business identity, structured
data, or share previews must follow `docs/seo-and-social-metadata.md`.

When a route is added or its metadata contract changes, update `scripts/check-social-metadata.mjs`
and verify both demo mode (`SITE_INDEXING_ENABLED=false`) and production indexing mode
(`SITE_INDEXING_ENABLED=true`). Do not enable production indexing or replace the canonical origin
until the permanent-domain launch requirements in the documentation are satisfied.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
