'use client';

import { useSearchParams } from 'next/navigation';

import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import type { CatalogMepQuote } from '@/features/vehicles/domain/catalog-pricing';
import { InventoryCatalog } from './inventory-catalog';

type InventoryCatalogFromSearchParamsProps = {
  vehicles: Vehicle[];
  quote: CatalogMepQuote | null;
  alertsEnabled: boolean;
};

export function InventoryCatalogFromSearchParams({
  vehicles,
  quote,
  alertsEnabled,
}: InventoryCatalogFromSearchParamsProps) {
  const searchParams = useSearchParams();

  return <InventoryCatalog key={quote?.updatedAt ?? 'no-quote'} vehicles={vehicles} quote={quote} alertsEnabled={alertsEnabled} searchParams={searchParams.toString()} />;
}
