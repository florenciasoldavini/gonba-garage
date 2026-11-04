import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { ButtonAnchor } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { WHATSAPP_GENERAL_MESSAGE } from '@/constants/contact';
import { getWhatsAppUrl } from '@/lib/contact';
import './stuck-door.css';

export const GENERIC_ERROR_COPY = {
  eyebrow: 'Error · Algo falló',
  title: 'No pudimos mostrar esta página.',
  text: 'El problema es nuestro, no de tu conexión. Probá de nuevo en unos segundos o escribinos por WhatsApp.',
};

type StuckDoorCardProps = {
  eyebrow: string;
  title: string;
  text: string;
  /** The retry control; each caller knows how to retry. */
  action: ReactNode;
};

/** The garage door that won't open: every failure on our side, where trying again is the way out. */
export function StuckDoorCard({ eyebrow, title, text, action }: StuckDoorCardProps) {
  return (
    <section className="section-shell stuck-door" aria-labelledby="stuck-door-title">
      <div className="stuck-door-panel" aria-hidden="true">
        <p>
          Portón 1 · <b>Trabado</b>
        </p>
      </div>
      <div className="stuck-door-body">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 id="stuck-door-title">{title}</h1>
        </div>
        <div>
          <p>{text}</p>
          <div className="status-actions">
            {action}
            <ButtonAnchor
              href={getWhatsAppUrl(WHATSAPP_GENERAL_MESSAGE)}
              target="_blank"
              rel="noopener noreferrer"
              variant="glass"
            >
              Escribinos por WhatsApp <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
            </ButtonAnchor>
          </div>
        </div>
      </div>
    </section>
  );
}

type StuckDoorPageProps = StuckDoorCardProps & { active?: 'vehicles' };

/** The card with the site header and footer around it. */
export function StuckDoorPage({ active, ...card }: StuckDoorPageProps) {
  return (
    <main className="stuck-door-page" id="stuck-door-top">
      <div className="stuck-door-screen">
        <SiteHeader active={active} />
        <StuckDoorCard {...card} />
      </div>
      <SiteFooter topHref="#stuck-door-top" />
    </main>
  );
}
