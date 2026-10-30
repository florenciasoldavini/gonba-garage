'use client';

import type { RefObject } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

/** Entrance for in-page status panels: the icon pops, then the content and any steps rise in. */
export function useStatusMotion(root: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
      if (root.current?.querySelector(':scope > .status-icon')) {
        timeline.from(':scope > .status-icon', { scale: 0.35, rotation: -12, autoAlpha: 0, duration: 0.6, ease: 'back.out(1.8)' });
      }
      timeline.from(':scope > :not(.status-icon)', { y: 24, autoAlpha: 0, stagger: 0.08, duration: 0.52 }, '<0.14');
      if (root.current?.querySelector('.status-steps li')) {
        timeline.from('.status-steps li', { x: 20, autoAlpha: 0, stagger: 0.08, duration: 0.42 }, '<0.1');
      }
    },
    { scope: root },
  );
}
