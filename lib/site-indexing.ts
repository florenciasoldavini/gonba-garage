import 'server-only';

export function isSiteIndexingEnabled() {
  return process.env.SITE_INDEXING_ENABLED === 'true';
}
