'use client';

import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, BellRing } from 'lucide-react';

import { TrackedButtonAnchor } from '@/components/analytics/tracked-anchor';
import type { AnalyticsEvent } from '@/lib/analytics/client';
import { usePriceAlert } from './price-alert';
import './vehicle-contact-dock.css';

type VehicleContactDockProps = {
  contactEvent: AnalyticsEvent;
  contactHref: string;
  formattedPrice: string;
  imageSrc: string;
  meta: string;
  name: string;
  /** The approximate dollar line under a peso price, as the purchase card shows it. */
  usdPrice: ReactNode;
};

/**
 * Shown once the purchase card has scrolled off the top of the screen, and hidden again when it comes
 * back or when the contact section at the end of the page (#consulta) is reached, so the two never
 * offer the same button at once. It stays hidden past that section too, over the footer.
 */
function useDockVisible() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const card = document.querySelector('.detail-purchase-card');
    const callout = document.getElementById('consulta');
    if (!card) return;

    let isCardPassed = false;
    let isCalloutReached = false;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const isAbove = !entry.isIntersecting && entry.boundingClientRect.bottom <= (entry.rootBounds?.top ?? 0);
        if (entry.target === card) isCardPassed = isAbove;
        else isCalloutReached = entry.isIntersecting || isAbove;
      }
      setIsVisible(isCardPassed && !isCalloutReached);
    });
    observer.observe(card);
    if (callout) observer.observe(callout);
    return () => observer.disconnect();
  }, []);

  return isVisible;
}

export function VehicleContactDock({
  contactEvent,
  contactHref,
  formattedPrice,
  imageSrc,
  meta,
  name,
  usdPrice,
}: VehicleContactDockProps) {
  const isVisible = useDockVisible();
  const openPriceAlert = usePriceAlert();

  return (
    <div className="contact-dock-shell" aria-hidden={!isVisible} data-visible={isVisible} inert={!isVisible}>
      <aside className="contact-dock glass-panel" aria-label="Consulta rápida">
        <span className="contact-dock-thumb">
          <Image src={imageSrc} alt="" fill sizes="78px" className="cover-image" />
        </span>
        <span className="contact-dock-name">
          <strong>{name}</strong>
          <small>{meta}</small>
        </span>
        <span className="contact-dock-price">
          <strong>{formattedPrice}</strong>
          {usdPrice}
        </span>
        {openPriceAlert && (
          <button
            className="contact-dock-alert"
            type="button"
            aria-label="Avisame si baja"
            onClick={() => openPriceAlert('dock')}
          >
            <BellRing aria-hidden="true" size={18} strokeWidth={2} />
          </button>
        )}
        <TrackedButtonAnchor analyticsEvent={contactEvent} href={contactHref} rel="noreferrer" target="_blank">
          <span>
            Consultar<span className="contact-dock-label-extra"> por este auto</span>
          </span>
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
        </TrackedButtonAnchor>
      </aside>
    </div>
  );
}
