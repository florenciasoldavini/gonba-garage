import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { Wordmark } from '@/components/brand/wordmark';
import { WHATSAPP_GENERAL_MESSAGE } from '@/constants/contact';
import { getWhatsAppUrl } from '@/lib/contact';

type NavigationKey = 'vehicles' | 'sell';

type SiteHeaderProps = {
  active?: NavigationKey;
  ctaHref?: string;
  ctaLabel?: string;
  home?: boolean;
};

const navigation = [
  { key: 'vehicles', label: 'Vehículos', path: '/vehiculos' },
  { key: 'sell', label: 'Vendé tu auto', path: '/vender' },
  { label: 'Servicios', path: '#servicios' },
  { label: 'Nosotros', path: '#nosotros' },
  { label: 'Preguntas', path: '#preguntas' },
] as const;

export function SiteHeader({
  active,
  ctaHref,
  ctaLabel = 'Contactar',
  home = false,
}: SiteHeaderProps) {
  const resolvedCtaHref = ctaHref ?? getWhatsAppUrl(WHATSAPP_GENERAL_MESSAGE);
  const opensExternally = resolvedCtaHref.startsWith('http');

  return (
    <header className={`site-header${home ? '' : ' detail-header'}`}>
      <Wordmark href={home ? '#inicio' : '/'} />
      <nav className="main-nav" aria-label="Navegación principal">
        {navigation.map((item) => {
          const href = item.path.startsWith('#') && !home ? `/${item.path}` : item.path;
          const isCurrent = 'key' in item && item.key === active;

          return (
            <Link
              className={isCurrent ? 'nav-current' : undefined}
              href={href}
              aria-current={isCurrent ? 'page' : undefined}
              key={item.label}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Link
        className="header-cta"
        href={resolvedCtaHref}
        rel={opensExternally ? 'noreferrer' : undefined}
        target={opensExternally ? '_blank' : undefined}
      >
        {ctaLabel}
        <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
      </Link>
    </header>
  );
}
