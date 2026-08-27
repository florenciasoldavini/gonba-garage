'use client';

import { useRef } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

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
  const searchRef = useRef<HTMLInputElement>(null);

  return (
    <div className="catalog-toolbar">
      <div className="catalog-toolbar-search">
        <label className="sr-only" htmlFor="inventory-search">Buscar vehículos</label>
        <Search aria-hidden="true" size={16} />
        <input
          id="inventory-search"
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Marca, modelo o año"
        />
        {query ? (
          <button
            className="search-clear-button"
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => {
              onQueryChange('');
              searchRef.current?.focus();
            }}
          >
            <X aria-hidden="true" size={14} strokeWidth={1.8} />
          </button>
        ) : null}
      </div>
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
