'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Wordmark } from '@/components/brand/wordmark';
import { WHATSAPP_GENERAL_MESSAGE } from '@/constants/contact';
import { getWhatsAppUrl } from '@/lib/contact';

type NavigationKey = 'vehicles' | 'sell';

type SiteHeaderProps = {
  active?: NavigationKey;
};

const navigation = [
  { key: 'vehicles', label: 'Vehículos', path: '/vehiculos' },
  { key: 'sell', label: 'Vendé tu auto', path: '/vender' },
  { label: 'Servicios', path: '/#servicios' },
  { label: 'Nosotros', path: '/#nosotros' },
  { label: 'Preguntas', path: '/#preguntas' },
] as const;

export function SiteHeader({ active }: SiteHeaderProps) {
  const contactHref = getWhatsAppUrl(WHATSAPP_GENERAL_MESSAGE);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    let wasScrolled: boolean | undefined;
    const updateScrolledState = () => {
      const isScrolled = window.scrollY > 24;
      if (isScrolled === wasScrolled) return;

      wasScrolled = isScrolled;
      header.toggleAttribute('data-scrolled', isScrolled);
    };

    updateScrolledState();
    window.addEventListener('scroll', updateScrolledState, { passive: true });

    return () => window.removeEventListener('scroll', updateScrolledState);
  }, []);

  return (
    <header className="site-header" ref={headerRef}>
      <Wordmark href="/" />
      <nav className="main-nav" aria-label="Navegación principal">
        {navigation.map((item) => {
          const isCurrent = 'key' in item && item.key === active;

          return (
            <Link
              className={isCurrent ? 'nav-current' : undefined}
              href={item.path}
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
        href={contactHref}
        rel="noreferrer"
        target="_blank"
      >
        Contactar
        <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
      </Link>
    </header>
  );
}
