'use client';

import { ArrowUpRight } from 'lucide-react';

import { ButtonAnchor } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { captureAnalyticsEvent } from '@/lib/analytics/client';

type ContactCalloutProps = {
  actionHref: string;
  actionLabel: string;
  eyebrow: string;
  id: string;
  note: string;
  title: string;
  titleId: string;
  analytics?: {
    channel: 'email' | 'whatsapp' | 'internal';
    placement: string;
    vehicleSlug?: string;
  };
  className?: string;
};

export function ContactCallout({
  actionHref,
  actionLabel,
  eyebrow,
  id,
  note,
  title,
  titleId,
  analytics,
  className = '',
}: ContactCalloutProps) {
  return (
    <section
      className={`section-shell contact-section glass-panel${className ? ` ${className}` : ''}`}
      id={id}
      aria-labelledby={titleId}
    >
      <div className="contact-glow" aria-hidden="true" />
      <div className="contact-copy">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 id={titleId}>{title}</h2>
      </div>
      <div className="contact-actions">
        <ButtonAnchor
          href={actionHref}
          onClick={() => {
            if (analytics) {
              captureAnalyticsEvent('contact_intent_clicked', {
                channel: analytics.channel,
                placement: analytics.placement,
                ...(analytics.vehicleSlug ? { vehicle_slug: analytics.vehicleSlug } : {}),
              });
            }
          }}
        >
          {actionLabel} <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
        </ButtonAnchor>
        <p>{note}</p>
      </div>
    </section>
  );
}
