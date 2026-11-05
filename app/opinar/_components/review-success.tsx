'use client';

import { useEffect, useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';

import { useStatusMotion } from '@/components/motion/use-status-motion';
import { ButtonLink } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';

/** The same for every rating: it never says whether the opinion will be shown. */
export function ReviewSuccess() {
  const root = useRef<HTMLElement>(null);
  useStatusMotion(root);
  // On a phone the form is several screens tall, and this panel replaces it where it was.
  useEffect(() => {
    root.current?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <section className="review-success status-panel glass-panel" aria-live="polite" ref={root}>
      <Eyebrow>Opinión enviada</Eyebrow>
      <h2>Gracias por contarnos.</h2>
      <p>Tu opinión ya quedó registrada. Nos ayuda a seguir mejorando.</p>
      <div className="status-actions">
        <ButtonLink href="/vehiculos">
          Ver vehículos <ArrowUpRight aria-hidden="true" size={16} />
        </ButtonLink>
      </div>
    </section>
  );
}
