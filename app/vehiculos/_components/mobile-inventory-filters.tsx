'use client';

import { SlidersHorizontal, X } from 'lucide-react';

import { useDialogMotion } from '@/components/motion/use-dialog-motion';
import { Button } from '@/components/ui/button';
import { InventoryFilters, type InventoryFiltersProps } from './inventory-filters';

type MobileInventoryFiltersProps = {
  filters: InventoryFiltersProps;
  isOpen: boolean;
  onClose: () => void;
  resultCount: number;
};

export function MobileInventoryFilters({ filters, isOpen, onClose, resultCount }: MobileInventoryFiltersProps) {
  const { closeDialog, dialogRef } = useDialogMotion({
    isOpen,
    itemSelector: '.mobile-filter-header, .catalog-filter-group, .mobile-filter-footer',
    panelSelector: '.mobile-filter-sheet',
    variant: 'sheet',
  });

  return (
    <dialog
      className="mobile-filter-dialog"
      ref={dialogRef}
      aria-labelledby="mobile-filter-title"
      onClose={onClose}
      onCancel={(event) => { event.preventDefault(); closeDialog(); }}
      onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}
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
            <button type="button" aria-label="Cerrar filtros" onClick={closeDialog}>
              <X aria-hidden="true" size={18} />
            </button>
          </div>
        </header>
        <div className="mobile-filter-scroll">
          <InventoryFilters {...filters} className="catalog-filters-mobile" />
        </div>
        <footer className="mobile-filter-footer">
          <Button type="button" onClick={closeDialog}>
            Ver {resultCount} {resultCount === 1 ? 'vehículo' : 'vehículos'}
          </Button>
        </footer>
      </div>
    </dialog>
  );
}
