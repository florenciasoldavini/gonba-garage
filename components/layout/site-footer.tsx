import Link from 'next/link';
import { ArrowUp, ArrowUpRight } from 'lucide-react';

import { TrackedAnchor } from '@/components/analytics/tracked-anchor';
import { Wordmark } from '@/components/brand/wordmark';
import { FooterMotion } from '@/components/motion/footer-motion';
import {
  BUSINESS_AREA,
  BUSINESS_HOURS,
  BUSINESS_VISIT_POLICY,
  INSTAGRAM_URL,
  WHATSAPP_APPOINTMENT_MESSAGE,
  WHATSAPP_URL,
} from '@/constants/contact';
import { LEGAL_PAGES } from '@/constants/legal';
import { getWhatsAppUrl } from '@/lib/contact';
import { siteNavigation } from './navigation';

type SiteFooterProps = {
  topHref: string;
  note?: string;
  home?: boolean;
};

export function SiteFooter({
  topHref,
  note,
  home = false,
}: SiteFooterProps) {
  return (
    <FooterMotion className="site-footer section-shell">
      <div className="footer-intro">
        <Wordmark className="footer-wordmark" href={home ? '#inicio' : '/'} />
        <p>Autos usados seleccionados · Buenos Aires, Argentina</p>
      </div>

      <a
        className="footer-instagram"
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Seguir a Gonba Garage en Instagram"
      >
        <span className="footer-instagram-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="18" height="18" x="3" y="3" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span className="footer-instagram-copy">
          <span>Seguinos en Instagram</span>
          <strong>@gonbagarage</strong>
          <small>Nuevos ingresos, novedades y contenido del garage.</small>
        </span>
        <span className="footer-instagram-action">
          Seguir <ArrowUpRight aria-hidden="true" size={16} />
        </span>
      </a>

      <div className="footer-columns">
        <section className="footer-visits" aria-label="Visitas">
          <span className="footer-visits-label">Visitas · {BUSINESS_VISIT_POLICY}</span>
          <ul>
            <li>{`${BUSINESS_AREA.locality}, ${BUSINESS_AREA.region}`}</li>
            {BUSINESS_HOURS.map((hours) => <li key={hours}>{hours}</li>)}
          </ul>
          <TrackedAnchor
            analyticsEvent={{ name: 'contact_intent_clicked', properties: { channel: 'whatsapp', placement: 'footer' } }}
            href={getWhatsAppUrl(WHATSAPP_APPOINTMENT_MESSAGE)}
            target="_blank"
            rel="noreferrer"
          >
            Pedí tu cita <ArrowUpRight aria-hidden="true" size={13} />
          </TrackedAnchor>
        </section>

        <div className="footer-navigation">
          <nav className="footer-link-group" aria-label="Secciones">
            <span className="footer-link-label">Secciones</span>
            <div className="footer-link-list">
              {siteNavigation.map((item) => (
                <Link href={item.path} key={item.label}>{item.label}</Link>
              ))}
            </div>
          </nav>
          <nav className="footer-link-group" aria-label="Contacto">
            <span className="footer-link-label">Contacto</span>
            <div className="footer-link-list">
              <TrackedAnchor
                analyticsEvent={{ name: 'contact_intent_clicked', properties: { channel: 'whatsapp', placement: 'footer' } }}
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp <ArrowUpRight aria-hidden="true" size={13} />
              </TrackedAnchor>
            </div>
          </nav>
        </div>
      </div>
      <div className="footer-legal">
        <nav className="footer-legal-links" aria-label="Legal">
          <Link href={LEGAL_PAGES.privacy.path}>Política de privacidad</Link>
          <Link href={LEGAL_PAGES.terms.path}>Términos y condiciones</Link>
        </nav>
        <Link className="footer-back-to-top" href={topHref}>
          Volver arriba <ArrowUp aria-hidden="true" size={13} />
        </Link>
      </div>
      {note && <small className="footer-note">{note}</small>}
    </FooterMotion>
  );
}
