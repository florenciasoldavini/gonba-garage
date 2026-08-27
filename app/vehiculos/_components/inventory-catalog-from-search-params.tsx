'use client';

import { useSearchParams } from 'next/navigation';

import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import { InventoryCatalog } from './inventory-catalog';

type InventoryCatalogFromSearchParamsProps = {
  vehicles: Vehicle[];
};

export function InventoryCatalogFromSearchParams({
  vehicles,
}: InventoryCatalogFromSearchParamsProps) {
  const searchParams = useSearchParams();
  const initialCompareSlug = searchParams.get('comparar') || undefined;

  return <InventoryCatalog vehicles={vehicles} initialCompareSlug={initialCompareSlug} />;
}
