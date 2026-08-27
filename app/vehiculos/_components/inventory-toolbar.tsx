'use client';

import { Search, SlidersHorizontal } from 'lucide-react';

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
  activeFilterCount: number;
  count: number;
  onOpenFilters: () => void;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: InventorySort) => void;
  query: string;
  sort: InventorySort;
};

export function InventoryToolbar({ activeFilterCount, count, onOpenFilters, onQueryChange, onSortChange, query, sort }: InventoryToolbarProps) {
  return (
    <div className="catalog-toolbar">
      <label className="catalog-toolbar-search">
        <span className="sr-only">Buscar vehículos</span>
        <Search aria-hidden="true" size={16} />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Marca, modelo o año"
        />
      </label>
      <div className="catalog-toolbar-controls">
        <button className="catalog-mobile-filter-trigger" type="button" onClick={onOpenFilters}>
          <SlidersHorizontal aria-hidden="true" size={15} />
          Filtros
          {activeFilterCount > 0 ? <span>{activeFilterCount}</span> : null}
        </button>
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
    </div>
  );
}
