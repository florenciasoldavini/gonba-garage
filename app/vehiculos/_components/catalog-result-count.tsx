'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// The hero is rendered by the server page, outside InventoryCatalog, so the filtered count reaches it
// through context. null means no filter is active. The setter has its own context so the catalog does
// not re-render when the count it published changes.
const ResultCountContext = createContext<number | null>(null);
const SetResultCountContext = createContext<((count: number | null) => void) | null>(null);

export function CatalogResultCountProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState<number | null>(null);

  return (
    <SetResultCountContext value={setCount}>
      <ResultCountContext value={count}>{children}</ResultCountContext>
    </SetResultCountContext>
  );
}

export function usePublishCatalogResultCount(count: number | null) {
  const setCount = useContext(SetResultCountContext);

  useEffect(() => {
    setCount?.(count);
    return () => setCount?.(null);
  }, [count, setCount]);
}

// Not a live region: the toolbar already announces the count to screen readers.
export function CatalogHeroCount({ total }: { total: number }) {
  const count = useContext(ResultCountContext);
  const unit = total === 1 ? 'unidad' : 'unidades';

  if (count === null) return <span className="catalog-hero-count">{total} {unit} {total === 1 ? 'publicada' : 'publicadas'}</span>;

  return (
    <span className="catalog-hero-count catalog-hero-count-filtered">
      Mostrando {count} de {total} {unit}
    </span>
  );
}
