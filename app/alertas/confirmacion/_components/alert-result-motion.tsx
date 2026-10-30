'use client';

import { useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

/** Same entrance as the valuation success view: the icon pops, then the content rises in. */
export function AlertResultMotion({ children, labelledBy }: { children: ReactNode; labelledBy: string }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.alert-result-icon', { scale: 0.35, rotation: -12, autoAlpha: 0, duration: 0.6, ease: 'back.out(1.8)' })
        .from('.alert-result > :not(.alert-result-icon)', { y: 24, autoAlpha: 0, stagger: 0.08, duration: 0.52 }, '<0.14');
      // Only confirmations list next steps.
      if (root.current?.querySelector('.alert-result-next')) {
        timeline.from('.alert-result-next li', { x: 20, autoAlpha: 0, stagger: 0.08, duration: 0.42 }, '<0.1');
      }
    },
    { scope: root },
  );

  return (
    <section className="alert-result glass-panel" aria-labelledby={labelledBy} ref={root}>
      {children}
    </section>
  );
}
