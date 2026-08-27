# Repository instructions

## SEO and social metadata

All new public routes and all changes to URLs, inventory lifecycle, business identity, structured
data, or share previews must follow `docs/seo-and-social-metadata.md`.

When a route is added or its metadata contract changes, update `scripts/check-social-metadata.mjs`
and verify both demo mode (`SITE_INDEXING_ENABLED=false`) and production indexing mode
(`SITE_INDEXING_ENABLED=true`). Do not enable production indexing or replace the canonical origin
until the permanent-domain launch requirements in the documentation are satisfied.
