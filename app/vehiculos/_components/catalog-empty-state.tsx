'use client';

import { ArrowUpRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function CatalogEmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="catalog-empty glass-panel">
      <span>0 resultados</span>
      <h2>No encontramos una unidad con esos criterios.</h2>
      <p>Probá ampliando el precio o quitando alguno de los filtros.</p>
      <Button type="button" onClick={onReset}>
        Ver todo el inventario <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
      </Button>
    </div>
  );
}
