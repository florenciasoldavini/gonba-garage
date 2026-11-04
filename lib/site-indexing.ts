import 'server-only';
import { siteEnv } from '@/lib/env';

export function isSiteIndexingEnabled() {
  return siteEnv.indexingEnabled();
}
