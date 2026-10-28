'use client';

import { useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

if (typeof window !== 'undefined') gsap.registerPlugin(useGSAP);

/** Enhance server-rendered native disclosures; they still work without JavaScript. */
export function SpecificationAccordionMotion({ children, contentKey }: { children: ReactNode; contentKey: string }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP((_context, contextSafe) => {
    const disclosures = Array.from(rootRef.current?.querySelectorAll<HTMLDetailsElement>('details') ?? []);
    let active = disclosures.find(detail => detail.open) ?? null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const animate = contextSafe!((detail: HTMLDetailsElement, opening: boolean) => {
      const summary = detail.querySelector('summary');
      const panel = detail.querySelector<HTMLElement>('.detail-specs-panel');
      const arrow = summary?.querySelector('svg');
      if (!panel || !summary) return;

      gsap.killTweensOf(panel);
      if (arrow) gsap.killTweensOf(arrow);
      summary.setAttribute('aria-expanded', String(opening));
      panel.inert = !opening;
      panel.setAttribute('aria-hidden', String(!opening));

      if (reducedMotion.matches) {
        detail.open = opening;
        gsap.set(panel, { clearProps: 'height,opacity,visibility' });
        if (arrow) gsap.set(arrow, { clearProps: 'transform' });
        return;
      }

      if (opening && !detail.open) {
        gsap.set(panel, { height: 0, autoAlpha: 0 });
        if (arrow) gsap.set(arrow, { rotation: 0 });
        detail.open = true;
      }

      // Real height keeps the surrounding document moving with the disclosure;
      // scaling the content would distort text and leave an empty layout gap.
      const targetHeight = opening ? panel.firstElementChild?.getBoundingClientRect().height ?? 0 : 0;
      gsap.to(panel, {
        height: targetHeight,
        autoAlpha: opening ? 1 : 0,
        duration: opening ? 0.36 : 0.28,
        ease: 'power2.inOut',
        onComplete: contextSafe!(() => {
          if (opening && active === detail) gsap.set(panel, { height: 'auto' });
          else if (!opening && active !== detail) {
            detail.open = false;
            gsap.set(panel, { clearProps: 'height,opacity,visibility' });
          }
        }),
      });
      if (arrow) gsap.to(arrow, { rotation: opening ? 180 : 0, duration: 0.28, ease: 'power2.inOut' });
    });

    const cleanups = disclosures.map(detail => {
      const summary = detail.querySelector('summary');
      const nativeGroup = detail.getAttribute('name');
      // Native exclusive groups close immediately. Manage exclusivity while the
      // outgoing section finishes its animation, then restore native behavior on cleanup.
      detail.removeAttribute('name');
      summary?.setAttribute('aria-expanded', String(detail === active));
      const click = contextSafe!((event: MouseEvent) => {
        event.preventDefault();
        const previous = active;
        active = active === detail ? null : detail;
        if (previous && previous !== active) animate(previous, false);
        if (active) animate(active, true);
      });
      summary?.addEventListener('click', click);
      return () => {
        summary?.removeEventListener('click', click);
        summary?.removeAttribute('aria-expanded');
        detail.open = detail === active;
        if (nativeGroup) detail.setAttribute('name', nativeGroup);
        const panel = detail.querySelector<HTMLElement>('.detail-specs-panel');
        if (panel) {
          panel.inert = false;
          panel.removeAttribute('aria-hidden');
        }
      };
    });
    return () => cleanups.forEach(cleanup => cleanup());
  }, { scope: rootRef, dependencies: [contentKey], revertOnUpdate: true });

  return <div ref={rootRef} className="detail-specs-groups">{children}</div>;
}
