'use client';

import { useEffect, useId, useRef, useState, type FocusEvent } from 'react';
import { Info } from 'lucide-react';

import type { CatalogMepQuote } from '@/features/vehicles/domain/catalog-pricing';

const arsPerUsdFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

/** Disclosure next to the USD price filter label explaining which MEP quote converts peso prices. */
export function MepQuoteInfo({ quote }: { quote: CatalogMepQuote }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    // Captured and cancelled so that inside the mobile filters dialog Escape closes this popover
    // first instead of the whole sheet.
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [isOpen]);

  const closeOnFocusOut = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (isOpen && nextTarget instanceof Node && !rootRef.current?.contains(nextTarget)) setIsOpen(false);
  };

  return (
    <div className="mep-quote-info" ref={rootRef} onBlur={closeOnFocusOut}>
      <button
        className="mep-quote-info-trigger"
        type="button"
        ref={triggerRef}
        aria-label="Cotización usada para el precio en USD"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Info aria-hidden="true" size={13} strokeWidth={2} />
      </button>
      <div className="mep-quote-info-panel" id={panelId} hidden={!isOpen}>
        <dl>
          <div><dt>Referencia</dt><dd>Dólar MEP venta, $ {arsPerUsdFormatter.format(quote.arsPerUsd)} por USD</dd></div>
          <div><dt>Fuente</dt><dd><a href="https://dolarapi.com" target="_blank" rel="noreferrer">DolarAPI</a></dd></div>
          <div><dt>Actualización</dt><dd>{quote.updatedAtLabel} (Argentina)</dd></div>
        </dl>
        <p>Conversión orientativa para filtrar y ordenar; cotización de pago a confirmar con la agencia.</p>
      </div>
    </div>
  );
}
