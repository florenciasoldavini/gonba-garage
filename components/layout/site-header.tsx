'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Wordmark } from '@/components/brand/wordmark';
import { WHATSAPP_GENERAL_MESSAGE } from '@/constants/contact';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { getWhatsAppUrl } from '@/lib/contact';
import { siteNavigation, type NavigationKey } from './navigation';
import { SiteMenu } from './site-menu';

type SiteHeaderProps = {
  active?: NavigationKey;
};

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
        {siteNavigation.map((item) => {
          const isCurrent = item.key !== undefined && item.key === active;

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
      <div className="header-actions">
        <SiteMenu active={active} contactHref={contactHref} />
        <Link
          className="header-cta"
          href={contactHref}
          onClick={() => captureAnalyticsEvent('contact_intent_clicked', { channel: 'whatsapp', placement: 'header' })}
          rel="noreferrer"
          target="_blank"
        >
          Contactar
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
        </Link>
      </div>
    </header>
  );
}
