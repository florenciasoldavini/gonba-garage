import { ArrowUpRight } from 'lucide-react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { ButtonAnchor } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { WHATSAPP_GENERAL_MESSAGE } from '@/constants/contact';
import { getWhatsAppUrl } from '@/lib/contact';
import { RetryButton } from './retry-button';

/**
 * Shown when the live catalog backend fails. The catalog header is left out on purpose: it would
 * announce an inventory that is not there and compete with the message.
 */
export function CatalogUnavailable({ title }: { title: string }) {
  return (
    <main className="catalog-unavailable-page" id="catalog-unavailable-top">
      <div className="catalog-unavailable-screen">
        <SiteHeader active="vehicles" />
        <section className="section-shell catalog-unavailable" aria-labelledby="catalog-unavailable-title">
          <div className="catalog-unavailable-door" aria-hidden="true">
            <p>Portón 1 · <b>Trabado</b></p>
          </div>
          <div className="catalog-unavailable-body">
            <div>
              <Eyebrow>Catálogo no disponible</Eyebrow>
              <h1 id="catalog-unavailable-title">{title}</h1>
            </div>
            <div>
              <p>El problema es nuestro, no de tu conexión. Probá de nuevo en unos segundos o escribinos por WhatsApp y te contamos qué autos hay disponibles.</p>
              <div className="status-actions">
                <RetryButton />
                <ButtonAnchor href={getWhatsAppUrl(WHATSAPP_GENERAL_MESSAGE)} target="_blank" rel="noopener noreferrer" variant="glass">
                  Escribinos por WhatsApp <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
                </ButtonAnchor>
              </div>
            </div>
          </div>
        </section>
      </div>
      <SiteFooter topHref="#catalog-unavailable-top" />
    </main>
  );
}
