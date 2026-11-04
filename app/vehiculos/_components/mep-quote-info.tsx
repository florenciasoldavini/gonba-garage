'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Info } from 'lucide-react';

import type { CatalogMepQuote } from '@/features/vehicles/domain/catalog-pricing';
import './mep-quote-info.css';

const arsPerUsdFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

/**
 * Disclosure next to the USD price filter label explaining which MEP quote converts peso prices.
 * The panel opens in the flow of the filter panel, pushing the slider down instead of covering it.
 */
export function MepQuoteInfo({ quote }: { quote: CatalogMepQuote }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Cancelled so that inside the mobile filters dialog Escape folds this panel first instead of
  // closing the whole sheet.
  const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !isOpen) return;
    event.preventDefault();
    event.stopPropagation();
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="mep-quote-info" onKeyDown={closeOnEscape}>
      <button
        className="mep-quote-info-trigger"
        type="button"
        ref={triggerRef}
        aria-label="Cotización usada para el precio en USD"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen(current => !current)}
      >
        <Info aria-hidden="true" size={13} strokeWidth={2} />
      </button>
      <div className="mep-quote-info-panel" id={panelId} hidden={!isOpen}>
        <dl>
          <div>
            <dt>Referencia</dt>
            <dd>Dólar MEP venta, $ {arsPerUsdFormatter.format(quote.arsPerUsd)} por USD</dd>
          </div>
          <div>
            <dt>Fuente</dt>
            <dd>
              <a href="https://dolarapi.com" target="_blank" rel="noreferrer">
                DolarAPI
              </a>
            </dd>
          </div>
          <div>
            <dt>Actualización</dt>
            <dd>{quote.updatedAtLabel} (Argentina)</dd>
          </div>
        </dl>
        <p>Conversión orientativa para filtrar y ordenar; cotización de pago a confirmar con la agencia.</p>
      </div>
    </div>
  );
}
