'use client';

import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';

/** Without `alertAction` (alert emails not configured) the copy promises no alert. */
export function CatalogEmptyState({ alertAction, onReset }: { alertAction: ReactNode; onReset: () => void }) {
  return (
    <div className="catalog-empty status-panel glass-panel">
      <Eyebrow>0 resultados</Eyebrow>
      <h2>No encontramos una unidad con esos criterios.</h2>
      <p>{alertAction
        ? 'Guardá esta búsqueda y te avisamos cuando ingrese una unidad compatible, o ampliá los filtros para seguir explorando.'
        : 'Ampliá los filtros para seguir explorando, o contanos qué buscás: el inventario cambia seguido.'}</p>
      <div className="status-actions">
        {alertAction}
        <Button type="button" variant="ghost" onClick={onReset}>
          Ver todo el inventario <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
        </Button>
      </div>
    </div>
  );
}
