import Link from 'next/link';
import { ArrowUp, ArrowUpRight } from 'lucide-react';

import { Wordmark } from '@/components/brand/wordmark';
import { INSTAGRAM_URL, WHATSAPP_URL } from '@/constants/contact';

type SiteFooterProps = {
  topHref: string;
  note?: string;
  home?: boolean;
};

export function SiteFooter({
  topHref,
  note = 'Demo visual · Contenido e información comercial a confirmar',
  home = false,
}: SiteFooterProps) {
  return (
    <footer className="site-footer section-shell">
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

      <div className="footer-navigation">
        <nav className="footer-link-group" aria-label="Secciones">
          <span className="footer-link-label">Secciones</span>
          <div className="footer-link-list">
            <Link href={home ? '#vehiculos' : '/vehiculos'}>Vehículos</Link>
            <Link href={home ? '#servicios' : '/#servicios'}>Servicios</Link>
            <Link href={home ? '#preguntas' : '/#preguntas'}>FAQ</Link>
          </div>
        </nav>
        <nav className="footer-link-group" aria-label="Redes sociales">
          <span className="footer-link-label">Contacto</span>
          <div className="footer-link-list">
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
              WhatsApp <ArrowUpRight aria-hidden="true" size={13} />
            </a>
          </div>
        </nav>
      </div>
      <Link className="footer-back-to-top" href={topHref}>
        Volver arriba <ArrowUp aria-hidden="true" size={13} />
      </Link>
      <small className="footer-note">{note}</small>
    </footer>
  );
}
