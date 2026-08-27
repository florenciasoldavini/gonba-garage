'use client';

import { CustomSelect } from '@/components/ui/custom-select';

export type InventorySort = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'mileage';

const sortOptions: Array<{ value: InventorySort; label: string }> = [
  { value: 'featured', label: 'Destacados' },
  { value: 'newest', label: 'Más recientes' },
  { value: 'price-asc', label: 'Menor precio' },
  { value: 'price-desc', label: 'Mayor precio' },
  { value: 'mileage', label: 'Menor kilometraje' },
];

type InventoryToolbarProps = {
  count: number;
  onSortChange: (sort: InventorySort) => void;
  sort: InventorySort;
};

export function InventoryToolbar({ count, onSortChange, sort }: InventoryToolbarProps) {
  return (
    <div className="catalog-toolbar">
      <p aria-live="polite"><strong>{count}</strong> {count === 1 ? 'vehículo' : 'vehículos'}</p>
      <div className="catalog-sort">
        <span className="catalog-sort-label">Ordenar por</span>
        <CustomSelect
          ariaLabel="Ordenar vehículos"
          value={sort}
          onChange={(value) => onSortChange(value as InventorySort)}
          options={sortOptions}
        />
      </div>
    </div>
  );
}
