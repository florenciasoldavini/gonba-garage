'use client';

import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

export function CatalogEmptyState({ alertAction, onReset }: { alertAction: ReactNode; onReset: () => void }) {
  return (
    <div className="catalog-empty glass-panel">
      <span>0 resultados</span>
      <h2>No encontramos una unidad con esos criterios.</h2>
      <p>Guardá esta búsqueda y te avisamos cuando ingrese una unidad compatible, o ampliá los filtros para seguir explorando.</p>
      <div className="catalog-empty-actions">
        {alertAction}
        <Button type="button" variant="ghost" onClick={onReset}>
          Ver todo el inventario <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
        </Button>
      </div>
    </div>
  );
}
