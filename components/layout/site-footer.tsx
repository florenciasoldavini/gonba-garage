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
      <Wordmark className="footer-wordmark" href={home ? '#inicio' : '/'} />
      <p>Autos usados seleccionados · Buenos Aires, Argentina</p>
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
          <span className="footer-link-label">Redes</span>
          <div className="footer-link-list">
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
              Instagram <ArrowUpRight aria-hidden="true" size={13} />
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
              WhatsApp <ArrowUpRight aria-hidden="true" size={13} />
            </a>
          </div>
        </nav>
      </div>
      <Link className="footer-back-to-top" href={topHref}>
        Volver arriba <ArrowUp aria-hidden="true" size={13} />
      </Link>
      <small>{note}</small>
    </footer>
  );
}
