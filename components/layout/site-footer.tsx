import Link from 'next/link';
import { ArrowUp, ArrowUpRight } from 'lucide-react';

import { Wordmark } from '@/components/brand/wordmark';
import { INSTAGRAM_URL } from '@/constants/contact';

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
      <nav aria-label="Navegación del pie de página">
        <Link href={home ? '#vehiculos' : '/vehiculos'}>Vehículos</Link>
        <Link href={home ? '#servicios' : '/#servicios'}>Servicios</Link>
        <Link href={home ? '#preguntas' : '/#preguntas'}>FAQ</Link>
        <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
          Instagram <ArrowUpRight aria-hidden="true" size={13} />
        </a>
        <Link href={topHref}>
          Volver arriba <ArrowUp aria-hidden="true" size={13} />
        </Link>
      </nav>
      <small>{note}</small>
    </footer>
  );
}
