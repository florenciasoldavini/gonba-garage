'use client';

import { useSearchParams } from 'next/navigation';

import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import type { MepQuote } from '@/features/vehicles/domain/catalog-pricing';
import { InventoryCatalog } from './inventory-catalog';

type InventoryCatalogFromSearchParamsProps = {
  vehicles: Vehicle[];
  quote: MepQuote | null;
};

export function InventoryCatalogFromSearchParams({
  vehicles,
  quote,
}: InventoryCatalogFromSearchParamsProps) {
  const searchParams = useSearchParams();
  const initialCompareSlug = searchParams.get('comparar') || undefined;

  return <InventoryCatalog key={quote?.updatedAt ?? 'no-quote'} vehicles={vehicles} quote={quote} initialCompareSlug={initialCompareSlug} />;
}
