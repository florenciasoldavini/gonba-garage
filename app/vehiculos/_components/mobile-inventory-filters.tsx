'use client';

import { useEffect, useRef } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { InventoryFilters, type InventoryFiltersProps } from './inventory-filters';

type MobileInventoryFiltersProps = {
  filters: InventoryFiltersProps;
  isOpen: boolean;
  onClose: () => void;
  resultCount: number;
};

export function MobileInventoryFilters({ filters, isOpen, onClose, resultCount }: MobileInventoryFiltersProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      className="mobile-filter-dialog"
      ref={dialogRef}
      aria-labelledby="mobile-filter-title"
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="mobile-filter-sheet">
        <header className="mobile-filter-header">
          <div>
            <span><SlidersHorizontal aria-hidden="true" size={15} /></span>
            <div><strong id="mobile-filter-title">Filtrar vehículos</strong><small>{filters.activeFilterCount} filtros activos</small></div>
          </div>
          <div className="mobile-filter-header-actions">
            {filters.activeFilterCount > 0 ? (
              <button className="mobile-filter-clear" type="button" onClick={filters.onReset}>Limpiar</button>
            ) : null}
            <button type="button" aria-label="Cerrar filtros" onClick={onClose}>
              <X aria-hidden="true" size={18} />
            </button>
          </div>
        </header>
        <div className="mobile-filter-scroll">
          <InventoryFilters {...filters} className="catalog-filters-mobile" />
        </div>
        <footer className="mobile-filter-footer">
          <Button type="button" onClick={onClose}>
            Ver {resultCount} {resultCount === 1 ? 'vehículo' : 'vehículos'}
          </Button>
        </footer>
      </div>
    </dialog>
  );
}
