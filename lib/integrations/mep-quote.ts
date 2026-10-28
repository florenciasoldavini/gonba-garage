import 'server-only';
import { cache } from 'react';
import { parseMepQuote } from '@/features/vehicles/domain/catalog-pricing';

// One server-side cached response shared across page requests, refreshed on demand.
// Filtering/sorting in the browser never invokes this provider.
export const getMepQuote = cache(async () => {
  try {
    const response = await fetch('https://dolarapi.com/v1/dolares/bolsa', {
      next: { revalidate: 15 * 60 }, signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    return parseMepQuote(await response.json());
  } catch {
    return null;
  }
});
