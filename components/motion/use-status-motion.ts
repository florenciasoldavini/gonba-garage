'use client';

import type { RefObject } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

/** Entrance for in-page status panels: the content rises in, then any next steps. */
export function useStatusMotion(root: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from(':scope > *', { y: 24, autoAlpha: 0, stagger: 0.08, duration: 0.52 });
      if (root.current?.querySelector('.status-steps li')) {
        timeline.from('.status-steps li', { x: 20, autoAlpha: 0, stagger: 0.08, duration: 0.42 }, '<0.1');
      }
    },
    { scope: root },
  );
}
