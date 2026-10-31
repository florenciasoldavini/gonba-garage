import 'server-only';
import { cache } from 'react';
import { formatMepQuoteUpdatedAt, parseMepQuote, type CatalogMepQuote } from '@/features/vehicles/domain/catalog-pricing';

// One server-side cached response shared across page requests, refreshed on demand.
// Filtering/sorting in the browser never invokes this provider.
export const getMepQuote = cache(async (): Promise<CatalogMepQuote | null> => {
  try {
    const response = await fetch('https://dolarapi.com/v1/dolares/bolsa', {
      next: { revalidate: 15 * 60 }, signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const quote = parseMepQuote(await response.json());
    return quote && { ...quote, updatedAtLabel: formatMepQuoteUpdatedAt(quote.updatedAt) };
  } catch {
    return null;
  }
});
