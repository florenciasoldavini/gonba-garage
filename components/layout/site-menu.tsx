'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight, X } from 'lucide-react';
import { useEffect, useState, type MouseEvent } from 'react';

import { Wordmark } from '@/components/brand/wordmark';
import { useDialogMotion } from '@/components/motion/use-dialog-motion';
import { ButtonAnchor } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { INSTAGRAM_URL } from '@/constants/contact';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { siteNavigation, type NavigationKey } from './navigation';

type SiteMenuProps = {
  active?: NavigationKey;
  contactHref: string;
};

const MENU_ID = 'site-menu';
// Matches the breakpoint where `.main-nav` takes over again.
const DESKTOP_QUERY = '(min-width: 1001px)';

export function SiteMenu({ active, contactHref }: SiteMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { closeDialog, dialogRef } = useDialogMotion({
    isOpen,
    // Not `.site-menu-top`: it holds the autofocused close button, which would lose focus while
    // the stagger briefly hides it.
    itemSelector: '.site-menu-nav .eyebrow, .site-menu-list li, .site-menu-contact',
    panelSelector: '.site-menu-panel',
    variant: 'overlay',
  });

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const closeOnDesktop = () => {
      if (desktop.matches) dialogRef.current?.close();
    };

    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, [dialogRef]);

  // Close without animating before a link navigates, so the scroll lock is already gone when an
  // in-page `/#…` link scrolls to its section.
  const closeOnLinkClick = (event: MouseEvent<HTMLDialogElement>) => {
    if ((event.target as Element).closest('a')) dialogRef.current?.close();
  };

  return (
    <>
      <button
        className="site-menu-trigger"
        type="button"
        aria-label="Abrir menú"
        aria-controls={MENU_ID}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
      >
        <span className="site-menu-bars" aria-hidden="true">
          <i />
          <i />
        </span>
      </button>

      <dialog
        className="site-menu-dialog"
        id={MENU_ID}
        ref={dialogRef}
        aria-label="Menú"
        onClose={() => setIsOpen(false)}
        onCancel={(event) => { event.preventDefault(); closeDialog(); }}
        onClick={closeOnLinkClick}
      >
        <div className="site-menu-panel">
          <div className="site-menu-top">
            <Wordmark href="/" />
            <button
              className="site-menu-close"
              type="button"
              aria-label="Cerrar menú"
              onClick={closeDialog}
              // showModal() focuses the [autofocus] element before the open animation hides the
              // panel, so focus starts here rather than on the wordmark. React's `autoFocus` prop
              // only focuses on mount and never writes the attribute.
              ref={(button) => button?.setAttribute('autofocus', '')}
            >
              Cerrar
              <X aria-hidden="true" size={18} strokeWidth={2} />
            </button>
          </div>

          <nav className="site-menu-nav" aria-label="Navegación principal">
            <Eyebrow>Menú</Eyebrow>
            <ol className="site-menu-list">
              {siteNavigation.map((item, index) => {
                const isCurrent = item.key !== undefined && item.key === active;

                return (
                  <li key={item.label}>
                    <Link
                      className="site-menu-link"
                      href={item.path}
                      aria-current={isCurrent ? 'page' : undefined}
                    >
                      <span className="site-menu-index" aria-hidden="true">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="site-menu-link-text">
                        <span className="site-menu-link-label">{item.label}</span>
                        {isCurrent && <span className="site-menu-current" aria-hidden="true">Estás acá</span>}
                      </span>
                      {!isCurrent && <ArrowRight aria-hidden="true" size={20} strokeWidth={1.8} />}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="site-menu-contact">
            <ButtonAnchor
              href={contactHref}
              onClick={() => captureAnalyticsEvent('contact_intent_clicked', { channel: 'whatsapp', placement: 'menu' })}
              target="_blank"
              rel="noreferrer"
            >
              Escribinos por WhatsApp
              <ArrowUpRight aria-hidden="true" size={17} strokeWidth={1.8} />
            </ButtonAnchor>
            <div className="site-menu-contact-meta">
              <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
                Instagram · @gonbagarage
              </a>
              <span>Buenos Aires, Argentina</span>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
